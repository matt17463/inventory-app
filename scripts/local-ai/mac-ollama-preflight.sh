#!/usr/bin/env bash
# Skilled Crafting — safe Mac Ollama preflight.
# This script does NOT install software, open network ports, or modify system settings.
set -euo pipefail
printf '\nSkilled Crafting local AI — Mac preflight\n'
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This preflight is for macOS." >&2
  exit 1
fi
echo "Architecture: $(uname -m)"
echo "macOS: $(sw_vers -productVersion)"
echo "Memory (GiB): $(sysctl -n hw.memsize | awk '{printf "%.1f", $1/1073741824}')"
if command -v ollama >/dev/null 2>&1; then
  echo "Ollama executable: $(command -v ollama)"
  ollama --version || true
else
  echo "Ollama not installed. Official installer: https://ollama.com/download/mac"
fi
if curl --silent --show-error --max-time 3 --fail http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Local Ollama service: responding on loopback"
  curl --silent --show-error --max-time 3 --fail http://127.0.0.1:11434/api/tags | python3 -c 'import json,sys; d=json.load(sys.stdin); print("Installed models:", ", ".join(m.get("name","?") for m in d.get("models",[])) or "(none)")'
else
  echo "Local Ollama service: not running or not installed"
fi
echo "No changes were made."
