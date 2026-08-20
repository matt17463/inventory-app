# Using Supplier Confirmation Receiving

## Purpose

This workflow turns an S&S Activewear or Momentec order-confirmation PDF into reviewed receiving rows. Uploading does **not** change inventory. Inventory changes only after you review the rows and click the blue Receive button.

## Normal workflow

1. Open **Inventory → Add Items to Bin**.
2. In **Receiving Defaults**, choose the bin where the shipment will be stored.
3. In **Import Supplier Order Confirmation**, choose the PDF.
4. Click **Read Confirmation**.
5. Compare the supplier name, order number, line count, unit count, and total with the PDF.
6. Review each row:

   - **Green / matched:** a blank product is already identified.
   - **Yellow / review:** most fields matched, but you must confirm or complete them.
   - **Red / unmatched:** choose Brand, Style, Color, and Size.

7. Enter the number physically received in **Receive now**. It defaults to the remaining ordered quantity.
8. Choose a different bin on any row that should not use the default bin.
9. Correct unit cost if the confirmation needs an adjustment.
10. Leave **Remember** checked to save the supplier SKU → blank-product mapping.
11. Uncheck rows that are backordered, missing, damaged, or not being received today.
12. Add an optional receipt note.
13. Click **Receive Selected Units**.

## Partial shipments

If 12 were ordered but only 8 arrived, enter `8` in **Receive now**. When the remaining 4 arrive, upload the same confirmation again. The application will show:

- Ordered: 12
- Previously received: 8
- Remaining / Receive now: 4

This prevents the same units from being received twice.

## Manual corrections and missing products

When a row is not matched, select Brand, Style, Color, and Size. If **Create missing blank products while receiving** is enabled, the application creates the blank-product record after you click Receive. If it is disabled, only an existing exact blank-product combination can be received.

Momentec confirmations may not print a manufacturer brand in every item row. The first receipt can require a brand selection; keeping **Remember** checked makes subsequent receipts automatic for that vendor SKU.

## Receiving history and original PDFs

Expand **Supplier receiving history** to see the 50 latest imported orders and their receipt batches. **Open Original PDF** creates a private, five-minute link; the storage bucket itself is not public.

## Rollback

Use rollback only to reverse an incorrect receiving batch. Enter a reason when prompted. The application checks that the received quantity is still available in the original bin. It refuses rollback if the units have since been consumed or moved, preventing negative stock.

## What the importer intentionally does not do

- It does not receive inventory immediately after upload.
- It does not assume the ordered quantity physically arrived.
- It does not guess an unmatched Brand/Style/Color/Size and silently save it.
- It does not use OpenAI or consume image/text AI credits.
- It does not process scans with no embedded text. Those require OCR support in a later update.
