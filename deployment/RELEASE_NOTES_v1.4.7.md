# Skilled Crafting Inventory App v1.4.7
## Purchasing Report Inline Pairing Repair

### Problem
The Purchasing Report can show a blank as needing to be purchased because one or more open order/pull-sheet lines were paired to the wrong blank. Previously the report exposed the related Order / Pull Sheet links, but the correction had to be made elsewhere.

### Added
- **Fix Pairing** action beside each purchasing demand source that has a pull-sheet line ID.
- Search and select the correct active blank directly from Purchasing.
- Uses the same `override_job_item_blank_pairing` operation as Pull Sheets, so the current `job_items.blank_product_id` and its existing reservation follow the corrected blank.
- Optional **Remember this pairing for future orders** control.
- Durable mapping priority:
  1. WooCommerce variation ID when captured.
  2. Real ordered SKU when captured.
  3. WooCommerce product ID for simple products when no variation/useful SKU exists.
- `MANUAL-<order>-LINE-<line>` placeholders are never saved as reusable SKU mappings.
- Purchasing data refreshes immediately after the correction so the wrong purchasing recommendation can disappear or move to the correct blank.
- Purchasing demand-source JSON now exposes the exact job item, Woo product/variation IDs, current blank, and manual-order identifiers needed for safe correction.

### Existing behavior preserved
- Purchasing formulas are unchanged.
- Supplier Summary is unchanged.
- Pull-sheet override audit behavior is reused.
- Product-to-Blank Mapping Lifecycle remains the authoritative future mapping system.
- Existing inventory movement history is not rewritten.

### Dependencies
This feature expects the existing Pull Sheet blank override and Product-to-Blank Mapping Lifecycle (`44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`) to already be installed. SQL 58 performs a preflight and stops before making changes if those prerequisites are missing.
