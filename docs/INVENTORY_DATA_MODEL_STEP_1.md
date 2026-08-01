# Inventory Data Model — Step 1 Safe Consolidation

## Authoritative relations

| Business purpose | Authoritative relation | Treatment in Step 1 |
|---|---|---|
| Blank product master | `public.blank_products` | Keep and use |
| Blank inventory quantity/history | `public.blank_inventory_movements` | Keep as the inventory ledger |
| WooCommerce products and variations | `public.products` | Keep; this is the Woo catalog and blank-product mapping table, not the inventory ledger |
| Production orders | `public.jobs` and `public.job_items` | Keep |
| Reserved blank inventory | `public.inventory_reservations` | Keep |
| Physical locations | `public.bins` | Keep |
| Standalone samples | `public.sample_products` | Keep as the active sample model |
| Sample type lookup/display | `public.sample_product_types` and `public.sample_products_with_bins` | Keep or create if missing |

## Preserved legacy relations

| Relation | Why it remains | Step 1 rule |
|---|---|---|
| `public.bin_items` | Old direct product-to-bin assignment model | Do not drop, rename, migrate, or write from the new application code |
| `public.sample_inventory` | Older samples linked to `blank_products` | Do not drop or migrate until its row count and usage are reviewed |

## Important clarification about `products`

`public.products` is not being retired. Pull-sheet and WooCommerce synchronization code uses it to resolve an ordered SKU to `blank_product_id`. Only the obsolete manual `CreateProduct.jsx` screen is retired because it writes incomplete catalog rows and then attempts to use `bin_items`.

## Quantity rule

The canonical blank quantity for a bin/product pair is the sum of `blank_inventory_movements.quantity_change`. New receiving, transfer, adjustment, reservation, job completion, return, and spoilage workflows should use their existing RPC functions and movement records. They should not insert into `bin_items`.

## Why Step 1 does not migrate old rows

The application is already operational. Moving old rows before verifying their meaning could duplicate inventory or alter quantities. Step 1 therefore:

1. Declares the authoritative model in metadata.
2. Adds a database health function.
3. Ensures the active standalone sample objects exist.
4. Removes legacy writes from the obsolete React screens.
5. Keeps all old rows available for review and rollback.

No legacy table should be removed until monitoring and reconciliation prove that its rows are either unused or already represented in the authoritative ledger.
