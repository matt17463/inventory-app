# NAS Backup — Skilled Crafting deployment runbook

Cloudflare R2 remains the authoritative live asset store. Neither NAS serves application requests, and the backup script NEVER deletes local files or R2 objects.

## Current implementation
- Storage Administration is the existing `/asset-storage-health` page, now reporting business/home NAS status alongside R2 migration information.
- `nas-backup-health` endpoint: administrator/manager GET; authenticated machine POST using `SC_NAS_REPORT_TOKEN` (32+ characters).
- `scripts/nas-r2-backup.sh` runs separately on each NAS or a trusted Linux computer with that NAS mounted. Uses `rclone copy`, not `sync`, and publishes last backup / object count / copied bytes.
- The dashboard displays agent-reported copy status, not independent data integrity proof or automatic restore verification. No automated R2 eviction.

## Site discovery required before enabling the backup schedule
1. Determine business and home NAS **models**, firmware, RAID/volume free space, snapshots, SMART health and SMB/NFS availability. Existing Tailscale device `synserver` could be one NAS, but do not assume which site.
2. Confirm each backup computer has direct local access to its NAS mount and reliable internet; if running on Pi, verify the NAS mount is available before scheduling.
3. Configure rclone on each backup computer with Cloudflare R2 endpoint/account ID and a **read-only** token limited to the needed bucket(s). If the app has several buckets, run separate backup jobs and prefixes. Do not use the Netlify write token or an unscoped API key.
4. Generate an independent long-lived `SC_NAS_REPORT_TOKEN` of at least 32 random characters and set it privately in Netlify and on both reporting agents. **Do not paste secrets into a chat or GitHub.** Rotate if disclosed.
5. Mount the NAS share securely at a stable absolute path. Make a directory owned by the backup user. Never use destination `/`. Enable snapshots/versioned backup at the NAS level.
6. On each host, install `rclone`, `curl`, `python3`, `flock`. Set environment variables locally and run `scripts/nas-r2-backup.sh` once as the dedicated backup user. For example:
   ```bash
   export SC_NAS_SITE=business    # 'home' on the other host
   export SC_R2_REMOTE='r2:ACTUAL_R2_BUCKET'
   export SC_NAS_DEST='/mnt/ACTUAL_NAS_MOUNT/skilledcrafting-backups'
   export SC_APP_URL='https://inventory.skilledcrafting.com'
   # Provide SC_NAS_REPORT_TOKEN securely, not in command history.
   bash /opt/skilledcrafting/nas-r2-backup.sh
   ```
7. Check Storage Administration for reporting and confirm source object count/size using `rclone size`. Check files individually and restore a sample into a distinct temporary directory; record the restoration evidence. The dashboard does not allow arbitrary agent-supplied claims of verified restore tests.
8. Set a daily overnight timer separately at each site after initial transfer and successful restores. Alert when no successful report in 36 hours, NAS volume exceeds 80%, or object counts diverge. Implement alerting separately; the initial page shows timestamps and errors.
9. Back up database schema/data and WooCommerce/WordPress separately. An R2 asset copy is not a full system backup.

## Security
- No NAS HTTP admin UI or SMB/NFS port should be exposed to the public internet.
- If NAS-to-NAS replication is used, use Tailscale/WireGuard and dedicated, restricted credentials.
- NAS must have versioned snapshots/immutable or offline historical copies to protect against ransomware or accidental overwrite. `rclone copy` alone is NOT a versioned backup for changes to the same object key.
- R2 live originals remain until a separately reviewed cold-archive/restore workflow exists.
- Use native NAS backup software if more reliable than the supplied script, but keep the same reporting contract.

## Before declaring production backup ready
Two actual NAS backup runs, on different hardware/locations, and at least one verified restore test from each are mandatory.
