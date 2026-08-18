# Release notes — v0.7.1

## WooCommerce variable-product completion

- Adds required Brand and Style assignment using existing WooCommerce global attributes.
- Adds customer-facing Logo Selection choices from project artwork.
- Generates Color × Size × Logo variations.
- Assigns the correct selected mockup to each Color + Logo combination.
- Generates unique variation SKUs.
- Creates or updates variation batches safely up to 500 combinations.
- Keeps unmatched existing variations unchanged for manual review.
- Adds Woo attribute discovery with authenticated employee access.
- Requires no database migration.

## Validation result

`npm run check` passes, including ESM validation, static tests, security tests, calendar tests, Mockup Studio tests, lint with pre-existing warnings only, production build, and production feature verification.
