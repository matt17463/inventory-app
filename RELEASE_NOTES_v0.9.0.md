# Release Notes — 0.9.0

## Added

- Read-only Product Integrity Center and Supabase diagnostic RPCs.
- Duplicate blank identity, SKU, barcode, lookup-name, incomplete-product, and archived-color diagnostics.
- XLSX/XLSM/CSV/TSV/TXT import utility with bounded parsing.
- ZIP size, entry size, and total extraction limits.
- Route-level lazy loading.
- Local/CI Vite build wrapper.
- Spreadsheet safety and application integrity tests.

## Changed

- Supplier confirmation matching now queries exact identities rather than scanning a 5,000-row blank-product subset.
- Inventory and supplier catalog templates download as CSV.
- React Router, Sharp, Vite, and supporting dependencies were updated.

## Removed

- Vulnerable `xlsx` dependency.
- Legacy XLS import support. Save these files as XLSX or CSV first.

## Data safety

- No existing application records are modified by the migration.
- No new environment variables are required.
- The Product Integrity Center is read-only.

## Verification

- 64 automated tests passed.
- Production build and feature verification passed.
- Production dependency audit reports zero known vulnerabilities.
- ESLint reports zero errors and 40 documented warnings.
