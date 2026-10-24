#!/usr/bin/env bash
# Run independently on each NAS or a trusted Linux backup host with the NAS mounted.
# Requires: rclone, curl, python3, flock, POSIX tools. Never deletes R2 or local files.
set -euo pipefail
umask 077
: "${SC_NAS_SITE:?business or home}"
: "${SC_R2_REMOTE:?rclone remote/bucket, e.g. r2:skilledcrafting}"
: "${SC_NAS_DEST:?mounted NAS backup directory}"
: "${SC_APP_URL:?https application base}"
: "${SC_NAS_REPORT_TOKEN:?private reporting token}"
[[ "$SC_NAS_SITE" == business || "$SC_NAS_SITE" == home ]] || exit 2
[[ "$SC_APP_URL" == https://* ]] || exit 2
[[ "$SC_NAS_DEST" = /* && "$SC_NAS_DEST" != / ]] || exit 2
mkdir -p "$SC_NAS_DEST" "$SC_NAS_DEST/.sc-backup"
exec 9>"$SC_NAS_DEST/.sc-backup/lock"
flock -n 9 || { echo "Another backup is running" >&2; exit 1; }
report() {
 local status="$1" description="${2:-}" files="${3:-0}" bytes="${4:-0}" completed="${5:-}"
 local payload
 payload="$(SC_STATUS="$status" SC_ERROR="$description" SC_COUNT="$files" SC_BYTES="$bytes" SC_COMPLETED="$completed" python3 - <<'PY'
import json,os
print(json.dumps(dict(site=os.environ['SC_NAS_SITE'],status=os.environ['SC_STATUS'],
 object_count=int(os.environ['SC_COUNT']),bytes_stored=int(os.environ['SC_BYTES']),
 last_backup_at=os.environ['SC_COMPLETED'] or None,error_summary=os.environ['SC_ERROR'][:400],
 agent_version='nas-backup-v1')))
PY
)"
 curl --fail --silent --show-error --max-time 25 -X POST \
 -H 'Content-Type: application/json' -H "x-sc-nas-report-token: $SC_NAS_REPORT_TOKEN" \
 --data-binary "$payload" "${SC_APP_URL%/}/.netlify/functions/nas-backup-health" >/dev/null || true
}
report running
# 'copy' preserves files no longer in R2 and NEVER removes R2 source content.
if rclone copy "$SC_R2_REMOTE" "$SC_NAS_DEST/r2" \
 --config "${SC_RCLONE_CONFIG:-$HOME/.config/rclone/rclone.conf}" \
 --log-file "$SC_NAS_DEST/.sc-backup/rclone.log" --log-level INFO --transfers 4 --checkers 8; then
  stats="$(rclone size "$SC_NAS_DEST/r2" --json)"
  read -r count bytes < <(printf '%s' "$stats" | python3 -c 'import json,sys; x=json.load(sys.stdin);print(x.get("count",0),x.get("bytes",0))')
  stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'Backup completed: %s; files=%s; bytes=%s\n' "$stamp" "$count" "$bytes"
  report success "" "$count" "$bytes" "$stamp"
else
  report failed "R2-to-NAS copy failed. Review local log."
  exit 1
fi
