# Package Manifest — 0.9.0

## Upgrade ZIP files

- `package.json`
- `package-lock.json`
- `src/App.jsx`
- `src/App.css`
- `src/navigationConfig.js`
- `src/InventoryImport.jsx`
- `src/SupplierCatalogImport.jsx`
- `src/ProductIntegrityCenter.jsx`
- `src/lib/productIntegrityApi.js`
- `src/lib/spreadsheetFiles.js`
- `src/lib/zipCsvExtract.js`
- `netlify/functions/supplier-confirmation-parse.js`
- `scripts/build_vite.mjs`
- `scripts/verify_build_features.mjs`
- `scripts/tests/static-contract.test.mjs`
- `scripts/tests/spreadsheet-import-safety.test.mjs`
- `deployment/sql/27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql`
- `APPLICATION_WIDE_AUDIT_v0.9.0.md`
- `DEPLOYMENT_GUIDE_v0.9.0.md`
- `RELEASE_NOTES_v0.9.0.md`
- `PACKAGE_MANIFEST_v0.9.0.md`

## Complete ZIP exclusions

The complete source ZIP excludes:

- `.git`
- `.env` and `.env.*` files except `.env.example`
- `node_modules`
- `dist`
- editor/OS temporary files
- previously generated ZIP archives

## Checksums

See the separately supplied `SHA256SUMS_v0.9.0.txt`.
