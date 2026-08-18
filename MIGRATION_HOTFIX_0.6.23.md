# 0.6.23 Migration Hotfix

The first 0.6.23 migration incorrectly stopped when
`public.non_inventory_product_rules` was absent.

The replacement migration is self-contained. It:

- Creates `public.non_inventory_product_rules` when missing.
- Adds the purchasing-report columns.
- Installs all RPC functions required by the 0.6.23 application.
- Preserves existing non-inventory behavior.
- Applies a saved rule's purchasing choice to newly generated pull sheets.
- Can be run safely after the failed migration because the failed transaction
  was rolled back.
