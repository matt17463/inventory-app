# Mockup Studio v0.7.1 update

This patch extends the v0.7.0 WooCommerce phase. It does not require a Supabase SQL migration.

## Included

- WooCommerce Brand and Style dropdowns populated from the existing global attributes.
- Color, Size, and Logo Selection variation planning.
- A Color + Logo to mockup-image mapping table. Sizes reuse that mapped image.
- Variation-specific WooCommerce images.
- Unique variation SKUs containing Color, Size, and Logo codes.
- Creation and update of matching variations in batches of 100, up to 500 combinations.
- Reuse of previously uploaded WooCommerce media when the project is exported again.
- Catalog-linked blank assets now remember Brand, Style, Color, Size, and base SKU metadata for later projects.
- The earlier explicit form-submit button correction remains included in `src/MockupStudio.jsx`.

## WooCommerce requirements

The following global attributes must already exist in WooCommerce:

- `pa_brand`
- `pa_style`
- `pa_color`
- `pa_size`

Every Brand, Style, Color, and Size entered in Mockup Studio must already exist as a term under the corresponding WooCommerce attribute. This prevents near-duplicate catalog values.

Logo Selection is created as a product-level variation attribute from the artwork names in the Mockup Studio project. No global Logo attribute is required.

## Existing products

When an existing WooCommerce product ID is supplied, matching variations are updated and missing variations are created. Existing variations that do not match the requested matrix are left untouched for safety. Review those variations in the WooCommerce draft and manually disable or remove any that are no longer wanted.

## Database

No SQL is required. Woo configuration and image mappings are stored in the existing `mockup_projects.woo_config` JSON column, and Woo media IDs use the existing `mockup_outputs.woo_media_id` column.

## Required validation

Run:

```bash
npm ci
npm run check
```

Then create a WooCommerce **draft** with at least two colors, two sizes, and two logos. Confirm the variation count and images before publishing.
