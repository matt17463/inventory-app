#!/usr/bin/env bash
# Dedicated Linux NAS/backup host. R2 read-only; no sync/delete/purge operations.
set -euo pipefail
umask 077
: "${SC_NAS_SITE:?business or home}"
: "${SC_R2_REMOTE:?rclone remote including the actual bucket}"
: "${SC_NAS_DEST:?dedicated absolute backup directory}"
: "${SC_NAS_MOUNT:?exact mounted NAS volume/share path}"
: "${SC_NAS_EXPECTED_SOURCE:?source from /proc/self/mountinfo}"
: "${SC_RCLONE_CONFIG:?private read-only R2 configuration file}"
: "${SC_APP_URL:?HTTPS application base}"
: "${SC_NAS_REPORT_TOKEN:?private reporting token}"
[[ "$SC_NAS_SITE" == business || "$SC_NAS_SITE" == home ]] || exit 2
[[ "$SC_APP_URL" == https://* && ${#SC_NAS_REPORT_TOKEN} -ge 32 ]] || exit 2
for command in python3 rclone curl flock; do command -v "$command" >/dev/null; done
state="${SC_NAS_STATE_DIR:-${HOME:?}/.local/state/sc-nas-backup/$SC_NAS_SITE}"
mkdir -p "$state"
exec 9>"$state/lock"
flock -n 9 || { echo 'Another backup is running' >&2; exit 1; }
headers="$(mktemp "$state/report-headers.XXXXXX")"
printf 'Content-Type: application/json\nx-sc-nas-report-token: %s\n' "$SC_NAS_REPORT_TOKEN" > "$headers"
report() {
 SC_STATUS="$1" SC_ERROR="${2:-}" SC_COUNT="${3:-0}" SC_BYTES="${4:-0}" SC_COMPLETED="${5:-}" python3 - <<'PY' > "$state/report-pending.json"
import json,os
p=dict(site=os.environ['SC_NAS_SITE'],status=os.environ['SC_STATUS'],error_summary=os.environ['SC_ERROR'][:400],agent_version='nas-backup-v2')
if p['status']=='success':
 p.update(object_count=int(os.environ['SC_COUNT']),bytes_stored=int(os.environ['SC_BYTES']),last_backup_at=os.environ['SC_COMPLETED'])
print(json.dumps(p))
PY
 curl --fail --silent --show-error --max-time 25 --retry 3 --retry-delay 5 \
  -X POST --header "@$headers" --data-binary "@$state/report-pending.json" \
  "${SC_APP_URL%/}/.netlify/functions/nas-backup-health" > "$state/report-response.json"
}
finish() {
 local code=$?
 trap - EXIT
 if ((code != 0)); then
  echo 'Backup or reporting failed; inspect the private local state directory.' >&2
  if ! report failed 'Backup or reporting failed. Review private host logs; no R2 objects were modified.'; then
   echo 'Failure report could not be delivered; pending report retained locally.' >&2
  fi
 fi
 rm -f "$headers"
 exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Validate the exact mount/source before creating ANY directory on the destination.
# Missing mounts must never turn into an apparently successful copy to host storage.
python3 - <<'PY'
import os,pathlib,re,shutil
mount=pathlib.Path(os.environ['SC_NAS_MOUNT']).resolve()
dest=pathlib.Path(os.environ['SC_NAS_DEST']).resolve()
assert str(mount)!='/' and dest!=mount and mount in dest.parents,'Destination must be inside a dedicated mounted volume'
assert os.path.isabs(os.environ['SC_NAS_DEST']),'Absolute destination required'
def unescape(s):return re.sub(r'\\([0-7]{3})',lambda m:chr(int(m[1],8)),s)
match=[]
for line in pathlib.Path('/proc/self/mountinfo').read_text().splitlines():
 a,b=line.split(' - ',1);left=a.split();right=b.split()
 if unescape(left[4])==str(mount):match.append((right[0],unescape(right[1]),left[5]))
assert len(match)==1,'Configured NAS mount is absent'
fs,source,options=match[0]
assert source==os.environ['SC_NAS_EXPECTED_SOURCE'],'Mounted source does not match the approved NAS volume'
assert fs in ('cifs','nfs','nfs4','btrfs','ext4','ext3','xfs'),'Unapproved destination filesystem'
assert 'rw' in options.split(','),'NAS volume is read-only'
u=shutil.disk_usage(mount)
minimum=int(os.environ.get('SC_NAS_MIN_FREE_BYTES',str(10*1024**3)))
assert u.free>=minimum and u.used/u.total<0.90,'NAS free space below the configured reserve or volume at least 90% full'
PY
report running
mkdir -p "$SC_NAS_DEST/r2" "$SC_NAS_DEST/Versions" "$SC_NAS_DEST/Backup-Reports"
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
common=(--config "$SC_RCLONE_CONFIG" --contimeout 30s --timeout 5m --retries 3 --low-level-retries 10)
rclone size "$SC_R2_REMOTE" --json "${common[@]}" > "$state/source-before.json"
rclone copy "$SC_R2_REMOTE" "$SC_NAS_DEST/r2" "${common[@]}" \
 --backup-dir "$SC_NAS_DEST/Versions/$stamp" \
 --transfers "${SC_NAS_TRANSFERS:-2}" --checkers 4 --bwlimit "${SC_NAS_BWLIMIT:-10M}" \
 --log-file "$state/rclone.log" --log-level INFO
rclone size "$SC_NAS_DEST/r2" --json "${common[@]}" > "$state/destination-after.json"
rclone size "$SC_R2_REMOTE" --json "${common[@]}" > "$state/source-after.json"
python3 - "$state/source-before.json" "$state/source-after.json" <<'PYVERIFY'
import json,sys
before,after=(json.load(open(p)) for p in sys.argv[1:])
assert (before['count'],before['bytes'])==(after['count'],after['bytes']),'Source totals changed during the copy; rerun to complete a stable pass'
PYVERIFY
read -r count bytes < <(python3 - "$state/destination-after.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]));print(x['count'],x['bytes'])
PY
)
cp "$state/source-before.json" "$state/source-after.json" "$state/destination-after.json" "$SC_NAS_DEST/Backup-Reports/"
completed="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
report success '' "$count" "$bytes" "$completed"
printf 'Agent-reported copy completed: %s; files=%s; bytes=%s. Independent restore verification is separate.\n' "$completed" "$count" "$bytes"
