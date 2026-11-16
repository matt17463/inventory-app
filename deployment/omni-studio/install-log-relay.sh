#!/bin/bash
set -euo pipefail
umask 077

if [[ $# != 2 ]]; then
    echo "Usage: $0 OMNI_IP PATH_TO_PRIVATE_TOKEN_FILE" >&2
    exit 2
fi

reader_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
python_bin="$(command -v python3)"
support="$HOME/Library/Application Support/SkilledCraftingOmni"
agent_dir="$HOME/Library/LaunchAgents"
label=com.skilledcrafting.omni-studio-relay
plist="$agent_dir/$label.plist"
mkdir -p "$support" "$agent_dir"

"$python_bin" - "$1" "$2" "$reader_dir/read-studio-log.py" "$support" "$plist" "$label" <<'PY'
import ipaddress
from pathlib import Path
import os
import plistlib
import re
import sys

host, token_path, reader_path, support_path, plist_path, label = sys.argv[1:]
host = str(ipaddress.IPv4Address(host))
with Path(token_path).expanduser().open() as source:
    token = source.read(66).strip()
if not re.fullmatch(r"[0-9a-f]{64}", token):
    raise SystemExit("The token file must contain one 64-character lowercase hex Omni token.")

support = Path(support_path)
token_file = support / "bridge-token"
reader_file = support / "read-studio-log.py"
plist = Path(plist_path)
for path, content in (
    (token_file, (token + "\n").encode()),
    (reader_file, Path(reader_path).read_bytes()),
    (plist, plistlib.dumps({
        "Label": label,
        "ProgramArguments": [
            sys.executable, str(reader_file), "--host", host, "--send-with-token", str(token_file),
        ],
        "RunAtLoad": True,
        "StartInterval": 60,
        "StandardErrorPath": str(support / "relay-error.log"),
    })),
):
    temporary = path.with_suffix(".new")
    with temporary.open("xb") as output:
        output.write(content)
    os.replace(temporary, path)
PY

domain="gui/$(id -u)"
if launchctl print "$domain/$label" >/dev/null 2>&1; then
    launchctl bootout "$domain/$label"
fi
launchctl bootstrap "$domain" "$plist"
launchctl print "$domain/$label" >/dev/null
echo "Installed the Omni Studio relay for the logged-in user."
