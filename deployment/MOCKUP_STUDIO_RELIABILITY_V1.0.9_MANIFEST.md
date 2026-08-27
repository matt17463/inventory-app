# Mockup Studio Reliability Repair v1.0.9

This repair release hardens the full Mockup Studio workflow without deleting existing projects, images, WooCommerce products, or variations.

## Included repairs

- WooCommerce REST reads now reject empty or non-JSON success responses, add cache-bypass headers, retry safe reads, and return useful diagnostics.
- WooCommerce option discovery runs sequentially and includes categories, shipping classes, and tags.
- A malformed optional category, tag, or shipping-class response no longer blocks the core WooCommerce connection. The form reports the affected endpoint and provides manual ID/slug fields until discovery succeeds.
- Variable-product exports use collision-resistant SKUs, 25-row variation batches, one-at-a-time image updates, partial-batch validation, and final variation reconciliation.
- Existing non-Mockup-Studio gallery images are preserved during updates.
- Exact Clean generation runs as a Netlify background function to avoid memory/time limits in the browser request.
- AI generation cleans up partial database rows and R2 files when a multi-output job fails.
- R2 signed downloads are limited to database-backed Mockup Studio records; abandoned uploads can be cancelled.
- Failed R2 deletion work is placed in a durable cleanup queue with an admin retry action.
- Project image lists use R2 previews by default and refresh expiring URLs without reloading the entire application.
- Artwork Vault data is loaded only when its tab is opened, reducing Supabase and R2 egress.
- Selecting a mockup no longer silently approves it. Internal approval, customer review, and production readiness use guarded database functions.
- Production Ready now requires preflighted artwork, physical placement width, and a selected approved output for every active placement.
- Editing caption appearance marks the existing pixels stale; WooCommerce export is blocked until the mockup is regenerated.
- WooCommerce connection status can be retried directly from the export screen.

## Database files

- `deployment/sql/34_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql` — required migration.
- `deployment/sql/35_VERIFY_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql` — read-only verification.

## Validation performed

- Netlify JavaScript ESM validation
- 83 automated application tests
- ESLint
- Vite production build
- Production bundle feature verification

## New environment variables

None. Existing Supabase, R2, OpenAI, and WooCommerce variables remain in use.
