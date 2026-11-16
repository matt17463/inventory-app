#!/usr/bin/env python3
"""Read recent Omni health responses from xTool Studio without modifying its logs."""
import argparse
from datetime import datetime, timezone
import hashlib
from http.client import HTTPSConnection, HTTPException
import ipaddress
import json
import os
from pathlib import Path
import re

HEADER = re.compile(r"^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\] \[\w+\]", re.M)
RESULT = re.compile(
    r"^\s*\(renderer:editor\)\s*\[\s*'streamRequest result',\s*"
    r"'\[DT002\]\[V2\]\[[^\]\n]+\]\[WIFI\]\[([^\]\n]+)\]',\s*",
)
NUMBER = r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?"
MAX_BYTES = 2 * 1024 * 1024
BRIDGE_HOST = "inventory.skilledcrafting.com"
BRIDGE_PATH = "/.netlify/functions/printer-activity-bridge"


def number(record, key, low, high):
    match = re.search(rf"\b{key}:\s*({NUMBER})(?=\s*(?:[,}}]|$))", record)
    if match:
        value = float(match[1])
        if low <= value <= high:
            return value
    return None


def extract(record):
    heads = re.search(r"\bprinter_head_param:\s*\[(.*?)\]", record, re.S)
    if heads:
        for head in re.findall(r"\{([^{}]+)\}", heads[1]):
            road = number(head, "ink_road", 1, 2)
            temp = number(head, "temp", -20, 120)
            if road in (1, 2) and temp is not None:
                yield f"uv_head_{int(road)}_c", temp
    else:
        humidity = number(record, "humity", 0, 100)
        ambient = number(record, "temp", -30, 100)
        if humidity is not None and ambient is not None:
            yield "humidity_pct", humidity
            yield "ambient_c", ambient

    tanks = re.search(r"\bmoisturizing:\s*\[(.*?)\]", record, re.S)
    if tanks:
        entries = re.findall(r"\{([^{}]+)\}", tanks[1])
        if len(entries) == 2:
            for slot, tank in enumerate(entries, 1):
                remaining = number(tank, "remain_ml", 0, 10000)
                capacity = number(tank, "full_ml", 1, 10000)
                if re.search(r"\bexist:\s*true\b", tank) and remaining is not None and capacity and remaining <= capacity:
                    yield f"moisturizing_liquid_{slot}_pct", round(100 * remaining / capacity, 1)
        waste = re.search(r"\bwaste:\s*\{[^{}]*\bexist:\s*(true|false)\b", record)
        if waste:
            yield "waste_ink_installed", waste[1] == "true"


def collect(paths, host, now, max_age):
    readings = {}
    for path in paths:
        with path.open("rb") as file:
            file.seek(max(0, file.seek(0, 2) - MAX_BYTES))
            contents = file.read(MAX_BYTES).decode(errors="replace")
        headers = list(HEADER.finditer(contents))
        for i, header in enumerate(headers):
            end = headers[i + 1].start() if i + 1 < len(headers) else len(contents)
            record = contents[header.end():end].strip()
            result = RESULT.match(record)
            if not result or result[1] != host or not record.endswith("]"):
                continue
            stamp = datetime.fromisoformat(header[1]).astimezone(timezone.utc)
            if not 0 <= (now - stamp).total_seconds() <= max_age:
                continue
            for key, value in extract(record[result.end():]):
                if key not in readings or stamp > readings[key][0]:
                    readings[key] = (stamp, value)
    return {
        "metrics": {
            key: {"observed_at": stamp.isoformat(), "value": value}
            for key, (stamp, value) in readings.items()
        },
    }


def relay_event(metrics):
    if not metrics:
        return None
    signature = hashlib.sha256(json.dumps(metrics, sort_keys=True).encode()).hexdigest()
    return {
        "printer_id": "omni",
        "kind": "telemetry",
        "event_key": f"omni:studio:{signature[:32]}",
        "occurred_at": min(metric["observed_at"] for metric in metrics.values()),
        "observed_mode": "unknown",
        "readings": {key: metric["value"] for key, metric in metrics.items()},
    }


def send(event, token_file):
    with token_file.open() as credentials:
        if os.fstat(credentials.fileno()).st_mode & 0o077:
            raise ValueError("The Omni token file must be private (chmod 600)")
        token = credentials.read(66).strip()
    if not re.fullmatch(r"[0-9a-f]{64}", token):
        raise ValueError("Invalid Omni bridge credential")
    connection = HTTPSConnection(BRIDGE_HOST, timeout=10)
    try:
        connection.request("POST", BRIDGE_PATH, json.dumps(event), {
            "Authorization": f"Bearer {token}", "Content-Type": "application/json",
        })
        status = connection.getresponse().status
        if not 200 <= status < 300:
            raise ValueError(f"Printer bridge returned HTTP {status}")
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True, type=ipaddress.IPv4Address)
    parser.add_argument("--logs", type=Path, default=Path.home() / "Library/Application Support/xTool Studio/logs")
    parser.add_argument("--max-age", type=int, default=180, help="Maximum sample age in seconds")
    delivery = parser.add_mutually_exclusive_group()
    delivery.add_argument("--relay-event", action="store_true", help="Print the printer bridge event without sending it")
    delivery.add_argument("--send-with-token", type=Path, help="Send fresh telemetry using a private Omni token file")
    args = parser.parse_args()
    paths = sorted(args.logs.glob("????-??-??/main.log"), reverse=True)[:3]
    report = collect(paths, str(args.host), datetime.now(timezone.utc), args.max_age)
    if args.relay_event or args.send_with_token:
        report = relay_event(report["metrics"])
    if args.send_with_token:
        if report:
            try:
                send(report, args.send_with_token)
            except (OSError, HTTPException, ValueError) as error:
                parser.exit(1, f"Omni delivery failed: {error}\n")
        return
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
