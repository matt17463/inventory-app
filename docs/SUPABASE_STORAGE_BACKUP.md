# Weekly Supabase Storage file backup

Database exports contain Storage metadata, not object bytes. The NAS agent needs a separate, read-only export token to retrieve those bytes.

`nas-storage-read` accepts POST requests authenticated by the dedicated `SC_STORAGE_BACKUP_READ_TOKEN` server secret (at least 48 characters). It can list only the nine existing application buckets and create download links valid for 30 minutes. It has no upload, delete, SQL, arbitrary URL, or role-management operation. Unknown buckets and invalid prefixes/pagination are rejected. Responses disable caching and no permissive cross-origin headers are sent. The token is independent of `SC_NAS_REPORT_TOKEN`, which remains reporting-only.

Keep the token in Netlify production Functions secrets and the protected Pi backup configuration. Do not use a generated Supabase S3 key as a substitute: those keys grant full Storage operations across all buckets. Application RLS and employee permissions are unchanged.

The backup agent must preserve bucket/path metadata, validate downloaded sizes, calculate content checksums, and encrypt an archive before writing to either NAS. Retain old snapshots; never delete source objects. A component is complete only after its initial copy and recovery check succeed. The existing R2 health report does not certify this additional component.

The allowlist is intentionally fixed. Adding a future application bucket requires an explicit code/configuration update, rather than silently broadening the backup credential.
