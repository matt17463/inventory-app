# Release Notes — 0.6.19

## Purchasing and purchase-order reconciliation

The Purchasing Report and Purchase Order screens previously used different
recommendation sources. This caused items—especially Pending Stock demand—to
appear in the Purchasing Report but not on Create Purchase Order.

Version 0.6.19:

- Makes the Purchasing Report's Recommended Orders list the source of truth for
  Create Purchase Order.
- Makes the Purchasing Report's Current Shortages list the source of truth for
  What Am I Waiting On?
- Calculates quantities already covered by open purchase orders.
- Shows every purchasing-report recommendation on Create Purchase Order.
- Separately displays:
  - Report Need
  - On Open PO
  - Still To Order
- Keeps fully covered rows visible and labels them Covered by Open PO.
- Prevents covered rows from being selected for another PO.
- Shows Pending Stock quantities on the PO generator.
- Excludes Pending Stock from PO receiving destination bins.
- Requires no Supabase SQL migration.
