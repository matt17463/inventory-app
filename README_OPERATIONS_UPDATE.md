# Skilled Crafting Inventory Operations Update

This ZIP includes:

- Updated React/Vite inventory app
- Supabase SQL migration: `supabase_inventory_operations_update.sql`
- Novice deployment guide: `docs/DEPLOYMENT_GUIDE.md`
- Business use guide: `docs/USE_GUIDE.md`

Major features added:

1. Barcode / QR inventory scanning with manual fallback
2. Inventory transfers between bins
3. Bin audit / cycle-count mode
4. Low-stock alert page
5. Inventory valuation page
6. WooCommerce sync queue foundation
7. Internal inventory reservations that do not block online ordering
8. NFC bin dashboard integration
9. Home dashboard KPIs
10. Activity feed / audit trail

Run the SQL first, then deploy the app.
