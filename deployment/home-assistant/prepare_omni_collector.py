#!/usr/bin/env python3
"""Prepare a pinned, read-only xTool collector for isolated Home Assistant testing."""
import argparse
import hashlib
import io
import ipaddress
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path


UPSTREAM = "97596521a9ac91fe18d2ef9b705a1d1fef53d113"
PROTOCOL = Path("custom_components/xtool/protocols/ws_v2/protocol.py")
PROTOCOL_SHA256 = "d19a2dcf2dfc73699642befcb7c7bc3dfd063c200b2618894bcdb6a984f33744"


def pin_protocol(raw, host, fingerprint):
    if hashlib.sha256(raw).hexdigest() != PROTOCOL_SHA256:
        raise ValueError("Unexpected upstream protocol file")
    source = raw.decode()
    source = source.replace("import ssl\n", "").replace(
        "from homeassistant.util.ssl import get_default_no_verify_context\n", ""
    )
    start = source.index("def _ssl_context(")
    end = source.index("async def probe_v2(", start)
    source = source[:start] + f'''_OMNI_HOST = {host!r}
_OMNI_PIN = bytes.fromhex({fingerprint!r})


def _ssl_context(host: str) -> aiohttp.Fingerprint:
    if host != _OMNI_HOST:
        raise ConnectionError("Host does not match the pinned Omni")
    return aiohttp.Fingerprint(_OMNI_PIN)


def _blocked_file_stream():
    raise PermissionError("File transfers are disabled in the Omni monitoring build")


''' + source[end:]
    for argument in ("host", "self.host", None, None):
        offset = source.index("ssl=_ssl_context(),")
        replacement = f"_ssl_context({argument})" if argument else "_blocked_file_stream()"
        source = source[:offset] + source[offset:].replace(
            "ssl=_ssl_context(),", f"ssl={replacement},", 1
        )
    marker = "        if not _skip_connect and (not self._connected or self._ws_instr is None):"
    source = source.replace(marker, '''        if method != "GET":
            raise PermissionError("Printer writes are disabled in the Omni monitoring build")
''' + marker, 1)
    compile(source, str(PROTOCOL), "exec")
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("upstream_checkout", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--host", required=True, help="Reserved business LAN IPv4 address")
    parser.add_argument("--fingerprint", required=True, help="Independently verified SHA-256 device certificate fingerprint")
    args = parser.parse_args()
    host = ipaddress.IPv4Address(args.host)
    private_networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
    if not any(host in ipaddress.IPv4Network(network) for network in private_networks):
        parser.error("Use the Omni's reserved private LAN address")
    fingerprint = args.fingerprint.replace(":", "").lower()
    if not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        parser.error("Provide a SHA-256 certificate fingerprint")
    if args.output.exists():
        parser.error("Choose a new output directory")

    archive = subprocess.check_output(
        ["git", "-C", str(args.upstream_checkout), "archive", UPSTREAM, "custom_components/xtool", "LICENSE"]
    )
    with tempfile.TemporaryDirectory(dir=args.output.parent) as temp:
        staging = Path(temp)
        with tarfile.open(fileobj=io.BytesIO(archive)) as package:
            for member in package:
                target = staging / member.name
                if Path(member.name).is_absolute() or ".." in Path(member.name).parts:
                    raise ValueError("Unexpected upstream archive path")
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                elif member.isfile():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(package.extractfile(member).read())
                else:
                    raise ValueError("Unexpected upstream archive entry")
        protocol = staging / PROTOCOL
        protocol.write_text(pin_protocol(protocol.read_bytes(), str(host), fingerprint))
        prepared = staging / "custom_components/xtool"
        (staging / "LICENSE").rename(prepared / "LICENSE")
        prepared.rename(args.output)
    print(f"Prepared read-only xTool component at {args.output}")


if __name__ == "__main__":
    main()
