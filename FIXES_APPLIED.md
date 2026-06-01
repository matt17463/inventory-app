# Fixes Applied

## Add Item search fix

The Add Blank Item to Bin search now:

- Searches across blank SKU, item name, brand name/code, product type name/code, color name/code, and size name/code.
- Handles normalized searches, so values like `AT203`, `AT-203`, and `at 203` can match each other.
- Shows a result count after searching.
- Auto-selects the item when exactly one result is found.
- Shows a clear message when no blank items match.

## Shared inventory API fix

`src/lib/inventoryApi.js` was updated with the same improved blank-product search behavior.

## Receive Blank Inventory compatibility fix

`ReceiveBlankInventory.jsx` now supports both `id` and `blank_product_id` row shapes so it works with the corrected `getBlankProducts()` helper.

## Build verification

The app was successfully built with `npm run build` after the changes.
