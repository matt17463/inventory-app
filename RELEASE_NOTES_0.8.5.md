# Release notes — v0.8.5

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

## Validation

- Full `npm run check` passes.
- 47 automated tests pass, including 16 Mockup Studio tests.
- Production bundle feature verification passes.
- ESLint reports no errors; pre-existing warnings remain.

