# Skilled Crafting — User administration and multi-location artwork retention

## User administration
- Tools & Admin → User Management, admin-only. Server-side invitation and role changes through Supabase Admin API.
- Do not publish service-role keys in the browser. The Netlify function authenticates and authorizes every request.
- Supported roles: admin, manager, operator, viewer. The current database role constraint does not define an independent contractor role. Contractor records/time entries are separate until a role integration is designed.
- Supabase Auth SMTP, URL configuration and invitation delivery must be configured. Deactivating the application role denies new authorized application calls, but does not forcibly revoke all current access tokens. For emergency removal revoke sessions through the Supabase dashboard.
- Create account via invite, avoid passwords chosen by administrators. Preserve historical user IDs for job audit.
- Verify invitations on a test email before operational use. Audit admin role modifications and review the feasibility of preventing removal of the last active admin in a future phase.

## Storage architecture — proposed, NOT deployed to the NAS devices
Recommendation: continue Cloudflare R2 for actively accessed production files and customer proof delivery; implement backups on both business and home NAS, with versioned encrypted offsite retention. Keep R2 URLs, asset IDs and database references unchanged.
- At ~300 GB, R2 Standard storage is approximately $4.35/month after the 10 GB free storage allowance (excluding requests). The availability benefit generally exceeds this savings.
- R2 should not be treated as a backup of its own content. Prevent synchronization of deletions across every copy.
- The business NAS may be a local working/archive mirror; the home NAS is an independent offsite backup. Periodic recovery tests, snapshots, immutable/WORM retention where supported, and restricted backup credentials protect against ransomware.
- If supported by actual NAS models, choose an R2/S3 pull/sync capability for independent *download* of production objects, followed by versioned NAS-to-NAS replication. If not supported, use a least-privilege Linux agent on the Pi or NAS using an S3-compatible client for R2 fetch, a manifest/checksum database and Tailscale-based encrypted connection between sites.
- Credentials: R2 read-only API token scoped to exact bucket/prefix, stored only on NAS/Pi; do not store R2 credentials in browser or share publicly. Use dedicated non-admin NAS users, no WAN port forwarding.
- Phases: (1) inventory current R2 object counts/bytes, superseded versions and Supabase references; (2) configure NAS health/capacity and encrypted connectivity; (3) run read-only baseline inventory and first full backup; (4) compare object key, size, SHA-256/checksum when available and test random restores; (5) enable incrementals with alerts and retention; (6) optionally use archival lifecycle after written retention rules and proven restores.
- Do NOT delete or move R2 files while customer portals, traveler artwork links, proofs, or approvals depend on existing URLs. Future 'archive' storage tier needs a restore-to-R2 and signed-download workflow before R2 removal.
- Keep accounting receipts, invoices, source artwork, approved artwork, manufacturing recipes, recipe snapshots, customer proofs and immutable audit history according to their individual retention requirements. Apply lifecycle expiration only to well-defined temporary cache/export prefixes; Cloudflare R2 can expire by prefix, but these rules would otherwise delete originals.
- Budget at least 3–5× projected active asset storage per NAS after allowing for versions, snapshots, backup retention and other business shares (model dependent). Establish monitoring at 70%, 85% thresholds.
- 3-2-1 minimum: cloud active copy, local NAS copy and separate offsite NAS copy; add offline/immutable copy for high-value source artwork. Ensure backups of Supabase PostgreSQL, Supabase Storage metadata, WordPress/WooCommerce and Netlify configuration in addition to R2 object payloads.
- Future application screen: Storage Administration with R2 usage, asset category, owner/client/order, last accessed, backups at both NAS sites, verification dates, failed items and restore requests. A separate scheduler/worker is required to move bytes; Netlify serverless functions and browser should not act as bulk backup workers.
- NAS make/model, usable free space, filesystem/snapshot support, Tailscale routing, upload bandwidth and credentials still require on-site discovery. This document does not claim any NAS mirroring has been activated.

## Sources
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 object lifecycle: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Synology Hyper Backup (only if NAS supports DSM): https://kb.synology.com/en-global/DSM/tutorial/How_to_back_up_your_data_to_a_remote_Synology_NAS_or_file_server_with_Hyper_Backup
