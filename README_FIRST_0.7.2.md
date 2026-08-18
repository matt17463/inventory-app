# Mockup Studio v0.7.2 cumulative update

This cumulative replacement-file patch can be installed directly over v0.7.0 or v0.7.1. No SQL is required.

## Adds

- Brand and Style selection from existing WooCommerce terms.
- Color × Size × Logo Selection variation creation and updating.
- Unique variation SKUs and variation-specific mockup images.
- Explicit main product image selection and product gallery ordering.
- WooCommerce category checkboxes.
- Shipping class, packaged weight, length, width, and height.
- WooCommerce media reuse on repeat exports.
- Existing form-submission fixes remain included.

## Required WooCommerce records

- Global attributes: Brand (`pa_brand`), Style (`pa_style`), Color (`pa_color`), Size (`pa_size`).
- Required terms under those attributes.
- At least one product category.
- At least one product shipping class.

## Install verification

Run:

```bash
npm ci
npm run check
```

Then use the included EPO workflow guide to create WooCommerce drafts and verify them before publishing.
