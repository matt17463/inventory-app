# Patch Manifest — v1.2.0

## Database

- `deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`
- `deployment/sql/45_VERIFY_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`

## Netlify functions

- `netlify/functions/product-blank-mapping.js`
- `netlify/functions/mockup-publish-woocommerce.js`
- `netlify/functions/woocommerce-webhook.js`
- `netlify/functions/manual-pullsheet.js`

## Application

- `src/ProductBlankMappings.jsx`
- `src/PullSheetView.jsx`
- `src/lib/productBlankMappingApi.js`
- `src/App.jsx`
- `src/App.css`
- `src/components/AppShell.jsx`
- `src/navigationConfig.js`

## Validation and release metadata

- `scripts/tests/product-blank-mapping-lifecycle.test.mjs`
- `package.json`
- `package-lock.json`
- `PRODUCT_BLANK_MAPPING_V1.2.0_DEPLOYMENT_GUIDE.md`
- `PATCH_MANIFEST_V1.2.0.md`

Validation completed with `npm run check`: ESM validation, all regression tests, lint, and production build passed.
