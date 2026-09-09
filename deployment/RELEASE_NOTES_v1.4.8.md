# Skilled Crafting Inventory App v1.4.8
## Purchasing Source-less Suggested Item Repair

### Why this release exists

v1.4.7 added **Fix Pairing** for Purchasing rows that expose an order / pull-sheet source with a `job_item_id`. Recommended Orders can also contain rows that have no usable pull-sheet source, including:

- low-stock threshold / shelf-stock recommendations;
- active reservations that are not tied to an existing `job_item`;
- mixed source-less reservation + threshold recommendations.

Those rows previously showed **No source details** or a dash and could not be corrected from Purchasing.

### What changed

v1.4.8 adds **Fix Suggested Item** to source-less Purchasing rows. The correction dialog can:

- search and select the correct replacement blank;
- inspect how many active source-less reservations can safely be moved;
- move active reservations only when they do not point to an existing pull-sheet line;
- move the source blank's low-stock threshold to the replacement blank, preserving the higher target threshold;
- remember a durable Purchasing replacement preference for that source blank;
- automatically reload Purchasing after the correction.

If a saved Purchasing replacement preference already exists, the dialog preselects it the next time the same source-less suggestion needs attention.

### Important scope distinction

The new replacement preference is **Purchasing-only**. It does not pretend to be a WooCommerce mapping when no Woo variation/SKU/product identity exists. Existing v1.4.7 line-level **Fix Pairing** remains the correct workflow for a real order / pull-sheet source and can still save WooCommerce mapping rules.

### Safety behavior

The source-less repair intentionally does **not**:

- move or deduct physical on-hand inventory;
- create or rewrite inventory movement history;
- rewrite WooCommerce product mappings;
- bulk-reassign existing pull-sheet lines;
- move active reservations tied to inactive/closed job items.

If the preview finds active pull-sheet lines, the dialog warns that they are not changed by the source-less repair and should be corrected using the existing line-level **Fix Pairing** button.

### Database objects added

- `public.sc_purchasing_blank_replacement_rules`
- `public.sc_purchasing_row_repair_log`
- `public.sc_purchasing_suggested_item_preview_v1(uuid)`
- `public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)`


### v1.4.7 SQL repository reconciliation

The live Supabase database was successfully installed with the corrected v1.4.7 SQL 58/59 after PostgreSQL rejected the original view-column rename. v1.4.8 also updates the repository copies of SQL 58 and 59 to those corrected versions so a future clone/redeploy matches the migration that actually succeeded in production. SQL 60 does not recreate the demand-source view.

### Migration numbering

v1.4.7 already uses SQL 58 and 59. v1.4.8 correctly continues with:

- `60_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql`
- `61_VERIFY_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql`

### No plugin/environment changes

No WooCommerce/WordPress plugin update is required. No Netlify environment variables are added or changed.
