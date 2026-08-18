# Release notes — v0.7.2

## WooCommerce product completion

- Adds an explicit main product image selector.
- Sends every other selected output to the WooCommerce product gallery.
- Loads WooCommerce categories and provides a checkbox category selector.
- Loads existing WooCommerce shipping classes.
- Adds required shipping class, packaged weight, length, width, and height fields.
- Sends `shipping_class`, `weight`, and `dimensions` through the WooCommerce product API.
- Validates main image, category, and physical shipping values before creating or updating a draft.
- Retains all cumulative v0.7.1 Brand, Style, Color × Size × Logo, SKU, and variation-image mapping functionality.
- Requires no Supabase SQL migration.

## Validation result

`npm run check` passes, including ESM validation, application tests, Mockup Studio tests, lint with pre-existing warnings only, production build, and production feature verification.
