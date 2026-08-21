# Release notes — v0.8.6

## Mockup Studio Cloudflare R2 storage

- Keeps Supabase for project records, mappings, inventory data, and authentication.
- Stores new Mockup Studio source images and outputs in a private Cloudflare R2 bucket.
- Uses server-generated presigned URLs; R2 credentials never enter the browser bundle.
- Supports existing Supabase and new R2 assets simultaneously.
- Adds resumable per-project migration from Supabase Storage to R2.
- Verifies each R2 upload before updating the database and deleting the Supabase copy.
- Generates 800-pixel WebP previews for supported images.
- Loads image URLs only for the active Mockup Studio phase.
- Adds native lazy loading for gallery, approval, customer review, WooCommerce, and production images.
- Updates AI generation, customer review, WooCommerce export, project deletion, output deletion, and local archives for both storage providers.
- Preserves older local archive manifests and restores files to their original provider.
- Adds a read-only per-project storage inventory view.
- Adds Cloudflare CORS configuration and complete deployment instructions.
- Adds Artwork Requests, Reorders, and individual request mockups to the Mockup Studio Artwork Vault selector.
- Imports a selected external artwork file into private R2 exactly once instead of repeatedly rendering the external URL.
- Keeps the original external URL as provenance while all Mockup Studio display, AI generation, review, archive, deletion, and WooCommerce work uses the R2 copy.
- Revalidates every external redirect against the configured hostname allowlist and rejects files larger than 50 MB or unsupported content types.

## Validation

- Full `npm run check` passes.
- 48 automated tests pass, including 17 Mockup Studio tests.
- Production bundle feature verification passes.
- ESLint reports no errors; pre-existing warnings remain.
