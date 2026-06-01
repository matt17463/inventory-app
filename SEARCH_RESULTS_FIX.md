# Search Results Fix

This update fixes the Scan page product lookup so broad searches such as `Gildan 18500` show all matching blank items instead of automatically selecting only the first match.

## Changed files

- `src/ScanInventory.jsx`
  - Shows multiple matching products in a selectable result list.
  - Requires the user to choose the exact blank item before receiving or reserving inventory.

- `src/lib/inventoryApi.js`
  - Adds `findBlankProductsByScannedValue()`.
  - Keeps `findBlankProductByScannedValue()` for older pages.
  - Raises the blank product query limit to 5000 rows.

- `src/App.css`
  - Adds styling for the selectable search result list.

## Result

Searching for `Gildan 18500` should now return all matching Gildan 18500 blank products/colors/sizes available in Supabase.
