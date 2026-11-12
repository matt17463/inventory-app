#!/usr/bin/env python3
"""Skilled Crafting local Ollama layout planner (Mac). No cloud API calls.

Usage:
  python3 scripts/local-ai/ollama-layout-smoke.py --model qwen2.5:7b \
    --client "Greywolf Elementary" --category school --color '#173a61'
Only uses 127.0.0.1:11434. No client information is persisted or uploaded.
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

ALLOWED_CATEGORIES = {"school", "team", "business", "nonprofit", "wedding", "general"}
ALLOWED_COMPOSITIONS = {"diagonal", "centered", "split"}
SYSTEM = (
    "You are a design assistant for a custom apparel business. Return ONLY a JSON object "
    "with keys headline, subheadline, benefits, composition, art_direction. "
    "benefits must be a list of exactly three short strings. "
    "composition must be one of diagonal, centered, split. "
    "Do not invent prices, fundraising percentages, contacts, official logos, product claims, "
    "or school-specific facts. Do not embed text or logos in generated imagery. "
    "Copy is a draft and requires human approval."
)


def validate(data):
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    for key in ("headline", "subheadline", "art_direction"):
        if not isinstance(data.get(key), str) or not 1 <= len(data[key]) <= 250:
            raise ValueError("Invalid " + key)
    if data.get("composition") not in ALLOWED_COMPOSITIONS:
        raise ValueError("Unsupported composition")
    benefits = data.get("benefits")
    if not isinstance(benefits, list) or len(benefits) != 3 or any(
        not isinstance(v, str) or not 1 <= len(v) <= 160 for v in benefits
    ):
        raise ValueError("Invalid benefits")
    return {k: data[k] for k in ("headline", "subheadline", "benefits", "composition", "art_direction")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="qwen2.5:7b")
    parser.add_argument("--client", required=True)
    parser.add_argument("--category", default="school", choices=sorted(ALLOWED_CATEGORIES))
    parser.add_argument("--color", default="#173a61")
    args = parser.parse_args()
    if len(args.client) > 150 or not re.fullmatch(r"#[0-9a-fA-F]{6}", args.color):
        parser.error("Client name must be <=150 characters and color must be #RRGGBB")
    payload = json.dumps({
        "model": args.model,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.35, "num_predict": 450},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps({
                "client": args.client, "category": args.category, "primary_color": args.color,
                "task": "Draft one client-neutral flyer copy/layout concept. Do not infer facts about the client."
            })},
        ],
    }).encode()
    request = urllib.request.Request(
        "http://127.0.0.1:11434/api/chat", data=payload,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
        raw = result.get("message", {}).get("content", "")
        plan = validate(json.loads(raw))
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as error:
        print("Local Ollama planning failed: " + str(error), file=sys.stderr)
        return 1
    print(json.dumps(plan, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
