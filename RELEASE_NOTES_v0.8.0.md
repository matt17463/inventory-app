# Inventory Application v0.8.0

## Supplier confirmation receiving

- Added bulk PDF receiving for S&S Activewear and Momentec order confirmations.
- Added supplier/order/PO/date/line/quantity/cost extraction.
- Added vendor-SKU, Supplier Catalog, and item-attribute matching.
- Added review states and manual corrections before inventory is changed.
- Added actual received quantity, partial shipments, per-line bins, and receipt notes.
- Added duplicate-order and idempotent-request protection.
- Added persistent supplier SKU mappings.
- Added private original-document history and time-limited document links.
- Added receipt batch rollback with available-stock checks.
- Added parser tests for both supplier layouts.

Database installation file: `deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql`

Deployment instructions: `deployment/SUPPLIER_CONFIRMATION_RECEIVING_DEPLOYMENT.md`

User instructions: `docs/SUPPLIER_CONFIRMATION_RECEIVING_GUIDE.md`
