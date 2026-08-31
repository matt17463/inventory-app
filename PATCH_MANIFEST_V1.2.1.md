# Patch Manifest — v1.2.1

## Visual fixes

- `src/MockupStudio.jsx`
- `src/MockupStudio.css`
- `src/App.css`
- `src/lib/productBlankMappingApi.js`

## Complete v1.2.0 dependency set retained

- `src/AssetStorageHealth.jsx`
- `src/ProductBlankMappings.jsx`
- `src/PullSheetView.jsx`
- `src/App.jsx`
- `src/components/AppShell.jsx`
- `src/navigationConfig.js`
- `netlify/functions/asset-storage-health.js`
- `netlify/functions/_shared/operationalStorage.js`
- `netlify/functions/product-blank-mapping.js`
- `netlify/functions/mockup-publish-woocommerce.js`
- `netlify/functions/woocommerce-webhook.js`
- `netlify/functions/manual-pullsheet.js`
- `deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`
- `deployment/sql/45_VERIFY_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`

## Validation and release metadata

- `scripts/tests/mockup-studio.test.mjs`
- `scripts/tests/product-blank-mapping-lifecycle.test.mjs`
- `package.json`
- `package-lock.json`
- `VISUAL_LAYOUT_V1.2.1_DEPLOYMENT_GUIDE.md`
- `PATCH_MANIFEST_V1.2.1.md`

Validation completed with the complete automated test suite, ESLint, Vite production build, and production-bundle verification passing.
