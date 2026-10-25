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

## Hardened agent deployment

The current agent also requires `SC_NAS_MOUNT`, `SC_NAS_EXPECTED_SOURCE`, and `SC_RCLONE_CONFIG`. Use `deployment/nas-backup/agent.env.example`; keep the completed environment file private. Match the exact NAS mount and source in `/proc/self/mountinfo`. A missing or unexpected mount fails before creating any destination directory. Keep local state and locks on the backup host rather than an unavailable network share.

The systemd templates are installation templates, not proof of an active schedule. Adapt their mount dependencies and writable paths to the actual host. Proposed daily business/home times are 01:00/04:00 America/Los_Angeles. DSM may use its native Task Scheduler with the dedicated local user instead. First run manually, compare content, and restore samples before enabling either schedule.

The agent retains replaced destination files in `Versions/<UTC-run-id>/`, preserves the original bucket-relative keys under `r2/`, and keeps deleted-at-source objects locally. No automatic history pruning is installed. History writable by the backup user is not immutable ransomware protection; protect historical snapshots separately with administrator-controlled NAS snapshots or offline media. Do not enable unsupported snapshot features or reformat existing volumes.

Running and failed reports preserve the last successful date and totals. Reporting failure makes the job fail and retains a pending report in its private state directory. Report freshness and backup age beyond 36 hours are visible on the dashboard; this does not itself deliver an external notification. Schedule failures must also be monitored through the host's supported notification facilities. Agent requests cannot supply or clear `last_restore_test_at`.

## Recovery procedure

1. Confirm the affected bucket and exact original object key from the application reference or retained manifest. Pause that site's backup schedule if investigating a destructive change.
2. Choose the current `r2/<original-key>` copy, an earlier `Versions/<run-id>/<original-key>` copy, or an administrator-protected snapshot predating the incident. Preserve the source backup.
3. Copy the selected files to a new, separate `Recovery/<incident-id>/` location. Never test by overwriting a live application file or R2 object.
4. Compute SHA-256 on the selected backup and recovered copy and compare them. When the current R2 original is valid, independently download it using the read-only account to another test location and compare its bytes as well. Matching names/counts alone is insufficient.
5. Open representative artwork, mockups, documents, and production files in suitable applications. Include the largest available file and actual layered graphics when present. Record file keys, lengths, hashes, timestamps, source snapshot/version, and reviewer. Keep private object names out of public reports.
6. An administrator records `last_restore_test_at` only after this independent test, through the protected database administration process. The reporting agent cannot certify its own restore.
7. Restoring into R2 is a separate, explicitly approved recovery operation requiring a suitably scoped write credential. The backup accounts are read-only and cannot perform it. Review application references and the intended overwrite before a live restore.
8. Resume the schedule and verify the next report. Retain recovery evidence and incident notes. Never delete the sole good backup during cleanup.

A rerun resumes at file level: completed unchanged objects are skipped, incomplete files are retried. Do not claim byte-level continuation for the installed rclone version. Use an isolated fixture to simulate interruption, source deletion, and replacement; do not alter live R2 objects for testing.
