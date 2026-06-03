# Skilled Crafting Blank Product Master Source-of-Truth Build

## Purpose

This build changes the inventory architecture:

- `public.blank_products` is now the source of truth for blank products.
- WooCommerce no longer creates or rebuilds blank products.
- The app imports/replaces `blank_products` from your spreadsheet.
- The spreadsheet also initializes bin quantities, bin assignments, unit costs, and low-stock thresholds.
- If Brand, Style, Color, Size, or Bin values do not exist, the import creates them.
- WooCommerce sync writes Woo products to `public.products`, then links them to the Supabase blank master by Brand + Style + Color + Size.
- Finished products are created/updated from WooCommerce when synced products include Customer and/or Logo attributes, and are linked back to `blank_products`.

## Spreadsheet columns supported

Required:

```text
Brand
Style
Color
Size
Quantity
Bin
Unit Cost
Low Stock Threshold
```

Accepted typo:

```text
Low Stock Threshhold
```

Optional:

```text
SKU Base
Blank SKU
Barcode
Product Name
Image URL
Supplier
Supplier SKU
Notes
```

If `SKU Base` is blank, the app/Supabase generate:

```text
BRAND-STYLE-COLOR-SIZE
```

Example:

```text
BELLA-CANVAS-3001-BLACK-YS
```

## Deployment order

1. Run `supabase_blank_master_source_of_truth.sql` in Supabase SQL Editor.
2. Deploy the updated app files.
3. Replace the WordPress plugin file with `wc-supabase-sync.php`.
4. Open the app:
   `/inventory/import`
5. Upload the completed blank product master spreadsheet.
6. Check the confirmation box and click:
   `Replace Blank Product Master`
7. In WordPress, run WooCommerce → Supabase Sync.
8. In Supabase, review:

```sql
select * from public.woo_products_unmatched_to_blank_master;
select * from public.finished_products_linked_to_blank_master;
```

## What is cleared during blank master import

The replacement import clears:

- existing `blank_products`
- existing blank inventory movements / quantities
- existing finished products and finished inventory movements
- existing reservations

This is intentional because the blank master spreadsheet becomes the new source of truth.

## What is preserved

The import preserves and reuses:

- bins, and creates missing bins
- brands, and creates missing brands
- product_types/styles, and creates missing styles
- colors, and creates missing colors
- sizes, and creates missing sizes
- WooCommerce product rows in `products`, but resets their `blank_product_id` links until Woo sync relinks them

## SKU Builder notes

No SKU Builder change is required if WooCommerce variations have accurate Brand, Style, Color, and Size attributes.

Recommended: keep WooCommerce variation SKUs descriptive, but the matching now relies primarily on:

```text
Brand + Style + Color + Size
```

not on WooCommerce creating blank products.
