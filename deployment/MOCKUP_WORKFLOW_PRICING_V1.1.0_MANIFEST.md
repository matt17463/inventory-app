# Mockup Studio Workflow and Pricing v1.1.0

## Included changes

### WooCommerce

- Clearly labeled Product Description field on the WooCommerce tab.
- Optional Short Description remains available.
- Both values are preserved in the saved project WooCommerce configuration and sent to the correct WooCommerce REST fields.

### Placement consistency

- Placement and Generate previews now use the blank image's real aspect ratio.
- Artwork percentages are calculated against the displayed product image instead of differently sized card containers.
- Placement and Generate screens use the same product canvas.
- Generated outputs and captioned outputs display at their natural aspect ratios.
- Captions are appended below the unchanged product canvas.
- Automated pixel comparison verifies that Exact Clean and Exact + Caption have identical product pixels.
- AI Assist is explicitly identified as generative; Exact modes are the geometry-locked paths.

### Pricing

- Separate Direct Retail and Wholesale paths.
- Direct Retail fields: Label, Quantity, Unit Cost, Retail Price.
- Wholesale fields: Label, Quantity, Unit Cost, Wholesale Price, Retail Price.
- Separate totals and breakdowns for each path.
- Existing pricing items migrate safely to Direct Retail.

## SQL

- `deployment/sql/36_MOCKUP_STUDIO_PLACEMENT_PRICING.sql` — required additive migration.
- `deployment/sql/37_VERIFY_MOCKUP_STUDIO_PLACEMENT_PRICING.sql` — read-only verification.

## Files included

- `src/MockupStudio.jsx`
- `src/MockupStudio.css`
- `src/lib/mockupStudioApi.js`
- `netlify/functions/mockup-publish-woocommerce.js`
- `scripts/tests/mockup-studio.test.mjs`
- `deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql`
- `deployment/sql/36_MOCKUP_STUDIO_PLACEMENT_PRICING.sql`
- `deployment/sql/37_VERIFY_MOCKUP_STUDIO_PLACEMENT_PRICING.sql`
- `package.json`
- `package-lock.json`
- deployment guide and manifest

## Validation

- 24 Mockup Studio tests
- 86 total automated tests
- Netlify JavaScript ESM validation
- ESLint
- Vite production build
- Production bundle verification

## Environment variables

No new variables.
