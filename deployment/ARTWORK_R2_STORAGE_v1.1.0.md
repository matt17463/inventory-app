# Artwork R2 Storage & Review Reliability v1.1.0

This is a companion to the existing **Skilled Crafting Artwork System**. It does not replace the main Artwork System or the Inventory Auto Sync add-on.

## Source of truth

After a file is verified in R2:

- **R2 object** = durable master bytes.
- **WordPress database** = request/workflow/approval metadata and durable proxy URL.
- **WordPress Media Library** = retained compatibility copy in v1.1.0.
- **WooCommerce Media Library** = publishing copy only when a product needs the image.

## Why the WordPress copy is retained in this release

The current Artwork System still has legacy actions such as DTF readiness checks that call `get_attached_file()` against the WordPress Media attachment. Deleting local files immediately would break those paths. v1.1.0 therefore migrates and verifies R2 without deleting the local compatibility copy. A future main Artwork System upgrade can retire those copies after every legacy file-dependent path uses R2.

## Private file delivery

The Artwork System stores a durable URL such as:

`https://skilledcrafting.com/wp-json/sc-artwork-r2/v1/file/123?sig=...`

That URL does not contain R2 credentials and does not expose the bucket publicly. WordPress validates the HMAC capability signature, calls the private Netlify bridge, and redirects to a fresh private R2 URL that expires after five minutes.

## Existing migration

The migration discovers:

- `sc_artwork_mockups`;
- known request/reference-file tables when installed;
- other Artwork System file/reference/mockup tables that expose a file URL;
- Media-Library-backed Artwork Vault `file_url` / `mockup_url` fields when their WordPress attachment can be resolved.

Each pass processes at most 25 source files. Run it repeatedly until Remaining / unresolved reaches zero or only intentional/unrecoverable legacy rows remain.

## Verification metadata

For each successful R2 object the companion stores:

- source table / row / field;
- request ID when available;
- WordPress attachment ID when available;
- R2 bucket and object key;
- MIME type and original filename;
- file size;
- SHA-256;
- R2 ETag;
- migration timestamp/status.

Approval snapshots record the exact R2 object key, SHA-256 and file size of the selected approved mockup.
