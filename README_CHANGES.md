# Skilled Crafting Inventory App Updates

This version adds:

1. Individual bin contents pages at `/bin/:binId`
2. Quantity editing directly from each bin contents page
3. Add blank items directly from each bin contents page
4. NFC writing for bins
5. NFC read/verify page
6. Add new bin form on the home page and bins page
7. Redesigned home page using the provided Skilled Crafting logo
8. Purple/blue/gold design system to complement the logo

## Important Supabase Step

Run `supabase_inventory_app_updates.sql` in the Supabase SQL Editor before using the updated bin contents pages.

The SQL adds/updates:

- `bins.nfc_url`
- `bin_blank_inventory_contents` view
- `blank_inventory_movements` table if missing
- `receive_blank_inventory(...)` function
- `set_bin_blank_inventory_quantity(...)` function
- optional `create_inventory_bin(...)` helper

## NFC Notes

Web NFC works only on supported devices/browsers, typically Chrome on Android over HTTPS.
iOS Safari and most desktop browsers do not support NFC writing.
