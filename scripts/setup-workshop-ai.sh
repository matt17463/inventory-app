#!/usr/bin/env bash
# Safe, repeatable local AI workshop deployment. Run on the Tailscale-connected Pi or Mac,
# from a checkout of the Skilled Crafting inventory-app repository. Never run on Netlify.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACTION="${1:---check}"
PORT="${SC_LOCAL_AI_PORT:-8788}"
HTTPS_PORT="${SC_TAILSCALE_AI_HTTPS_PORT:-8443}"
MODEL="${SC_LOCAL_AI_MODEL:-qwen3.5:2b}"
if [[ "$(uname -s)" == "Darwin" ]]; then
  CONFIG_DIR="${HOME}/.config/skilled-crafting"
else
  CONFIG_DIR="${HOME}/.config/skilled-crafting"
fi
ENV_FILE="${CONFIG_DIR}/local-ai.env"
fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }
has(){ command -v "$1" >/dev/null 2>&1; }
info(){ printf '[Skilled Crafting] %s\n' "$*"; }
require_software(){
  for cmd in node npm ollama tailscale; do
    has "$cmd" || fail "$cmd not installed. See docs/creative-automation-platform-setup.md.";
  done
  local NODE_MAJOR; NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && ((NODE_MAJOR>=20)) || fail 'Node.js 20+ required.'
}
write_template(){
 mkdir -p "$CONFIG_DIR"
 chmod 700 "$CONFIG_DIR"
 if [[ -f "$ENV_FILE" ]];then info "Existing config preserved at $ENV_FILE";return;fi
 cat > "$ENV_FILE" <<'EOF'
# This file stays on the trusted workshop computer (chmod 600).
# Use the public Supabase ANON key; do NOT use the service-role key.
SUPABASE_URL=
SUPABASE_ANON_KEY=
SC_LOCAL_AI_MODEL=qwen3.5:2b
SC_LOCAL_AI_ORIGIN=https://inventory.skilledcrafting.com
SC_LOCAL_AI_PORT=8788
SC_OLLAMA_URL=http://127.0.0.1:11434

# Optional business-manual sync: explicitly choose an approved folder.
SC_MANUAL_SYNC_ENABLED=0
SC_MANUAL_SOURCE_DIR=
# R2 credentials needed ONLY if manual mirror sync is enabled. Do not commit secrets.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
EOF
 chmod 600 "$ENV_FILE"
 info "Created local config template: $ENV_FILE"
}
load_env(){
 [[ -f "$ENV_FILE" ]] || fail "No config. Run: bash scripts/setup-workshop-ai.sh --init"
 # Shell environment loading requires a file owned by the logged-in account, not a shared NAS.
 [[ ! -L "$ENV_FILE" ]] || fail 'Config must not be a symlink.'
 if [[ "$(uname -s)" == "Darwin" ]];then
   OWNER="$(stat -f %u "$ENV_FILE")";MODE="$(stat -f %Lp "$ENV_FILE")"
 else
   OWNER="$(stat -c %u "$ENV_FILE")";MODE="$(stat -c %a "$ENV_FILE")"
 fi
 [[ "$OWNER" == "$(id -u)" ]] || fail 'Config must be owned by the current user.'
 [[ "$MODE" == "600" ]] || fail "Run chmod 600 $ENV_FILE first."
 set -a
 # Only source this locally owned, private file. Never source a NAS file or untrusted config.
 # shellcheck disable=SC1090
 . "$ENV_FILE"
 set +a
 [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_ANON_KEY:-}" ]] || fail 'Fill SUPABASE_URL and SUPABASE_ANON_KEY in the local config.'
 [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || fail 'Do not put a service-role credential on this machine.'
 [[ "${SC_OLLAMA_URL:-}" == "http://127.0.0.1:11434" ]] || fail 'Ollama must be bound to 127.0.0.1.'
}
status(){
 info "Host: $(hostname), OS: $(uname -s), arch: $(uname -m)"
 for cmd in node npm ollama tailscale; do
   if has "$cmd";then info "$cmd present";else info "$cmd MISSING";fi
 done
 if has tailscale;then tailscale status --self 2>/dev/null || info 'Tailscale not signed in';fi
 if has ollama;then
   ollama list 2>/dev/null | head -n 8 || true
   if has curl;then curl -fsS --connect-timeout 2 http://127.0.0.1:11434/api/tags >/dev/null && info 'Ollama loopback API responds' || info 'Ollama loopback API offline';fi
 fi
 [[ -f "$ENV_FILE" ]] && info "Private config found: $ENV_FILE" || info "Config missing: use --init"
 if has tailscale;then tailscale serve status 2>/dev/null || true;fi
}
case "$ACTION" in
 --init) write_template; status;;
 --check) status;;
 --model)
   require_software
   load_env
   info "Downloading open-weight $MODEL (verify license and hardware memory)."
   ollama pull "${SC_LOCAL_AI_MODEL:-$MODEL}"
   info "Model available. Verify locally: ollama run ${SC_LOCAL_AI_MODEL:-$MODEL}"
   ;;
 --run)
   require_software
   load_env
   cd "$ROOT"
   [[ -d node_modules/@supabase/supabase-js ]] || fail 'Run npm ci in the repository first.'
   exec node scripts/local-knowledge-agent.mjs
   ;;
 --serve)
   has tailscale || fail 'Tailscale CLI not installed.'
   info "Configuring private tailnet Serve on HTTPS port $HTTPS_PORT -> 127.0.0.1:$PORT"
   info 'Tailscale Serve is tailnet-only. Do NOT run tailscale funnel.'
   tailscale serve --bg --https="$HTTPS_PORT" "http://127.0.0.1:$PORT"
   tailscale serve status
   ;;
 --sync)
   require_software
   load_env
   [[ "${SC_MANUAL_SYNC_ENABLED:-0}" == "1" ]] || fail 'Set SC_MANUAL_SYNC_ENABLED=1 and explicitly approve a business-manual directory.'
   cd "$ROOT"
   exec node scripts/sync-approved-manuals.mjs
   ;;
 --help|-h)
   printf '%s\n' 'Usage: bash scripts/setup-workshop-ai.sh --init|--check|--model|--run|--serve|--sync' \
     '--init  creates private env template; --model downloads selected Ollama model;' \
     '--run starts loopback-only authenticated gateway; --serve configures Tailscale HTTPS port 8443;' \
     '--sync mirrors only the explicitly approved business-manual directory.'
   ;;
 *) fail "Unknown action $ACTION (run --help).";;
esac
