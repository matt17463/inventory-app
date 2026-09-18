# SanMar Excel Supplier Receiving — v1.4.15

This release extends **Add Blank Items to Bin → Import Supplier Order Confirmation** to accept S&S Activewear PDF, Momentec PDF, SanMar Excel 97–2003 `.xls`, and SanMar `.xlsx`.

## Security-compatible spreadsheet handling

The application intentionally does **not** use the `xlsx` package. Legacy SanMar `.xls` files are parsed by a small bounded OLE/BIFF8 reader that only extracts worksheet cell values needed by this receipt format. Modern `.xlsx` uses the application's existing `read-excel-file` dependency.

The legacy reader enforces file, stream, row, column, allocation-chain, and cycle bounds and ignores macros, formulas, embedded objects, external links, and arbitrary workbook execution.

## Receiving behavior

The importer reads Style, Color, Size, Pieces, Price, Amount, Warehouse, order date, customer number, and customer PO when present. SanMar files that omit a vendor SKU receive a stable `Style | Color | Size` supplier key. Repeated Style/Color/Size rows split across warehouses are aggregated before receiving.

No database migration is required.

## Production smoke test

1. Merge the feature branch and wait for Netlify production to publish.
2. Open **Add Item to Bin** and choose the normal receiving bin.
3. Under **Import Supplier Order Confirmation**, select a SanMar `.xls` file.
4. Click **Read Confirmation**.
5. Confirm the summary identifies **SanMar** and displays the expected order and line totals.
6. Confirm Style, Color, Size, Pieces, and Unit Cost populate.
7. Review any yellow/red match rows rather than accepting an ambiguous pairing.
8. Receive one small known line first.
9. Confirm inventory increased and the receiving-history entry exists.
10. Re-import the same receipt and confirm previously received quantities reduce Remaining.

## Rollback

Revert the v1.4.15 merge commit if needed. No SQL migration or destructive schema change is introduced by this release.
