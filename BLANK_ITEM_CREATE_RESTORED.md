# Blank Item Creation Restored

This update restores and expands the ability to create a new blank inventory item.

## Where it is available

1. Home page → Add Blank Item tile
2. Top navigation → Add Item
3. Scan page → + Create New Blank Item
4. When a scan/search has no matches, the create form opens automatically

## What can be entered

- Brand
- Product type / style
- Color
- Size
- SKU base
- Name
- Barcode / UPC
- Unit cost
- Low stock threshold
- Image URL

The Scan page lets you create the blank item and immediately select it for receiving or reservation.

## Optional SQL

If creating a blank item fails because a column is missing, run:

`ensure_blank_product_create_columns.sql`

This safely adds optional columns used by the create form.
