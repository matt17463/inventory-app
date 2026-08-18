-- Skilled Crafting Inventory Application
-- STEP 1 POST-INSTALL VERIFICATION
-- Read-only checks after the two required migrations.

select public.sc_inventory_model_health_v1() as inventory_model_health;

select
  id,
  blank_catalog_relation,
  blank_ledger_relation,
  woo_catalog_relation,
  sample_catalog_relation,
  legacy_bin_relation,
  legacy_sample_relation,
  migration_phase,
  legacy_writes_blocked,
  installed_at,
  updated_at
from public.sc_inventory_model_registry
where id = 1;

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'blank_products',
    'blank_inventory_movements',
    'products',
    'sample_products',
    'sample_product_types'
  )
order by table_name, ordinal_position;

select
  to_regclass('public.blank_products') as blank_products,
  to_regclass('public.blank_inventory_movements') as blank_inventory_movements,
  to_regclass('public.products') as woo_products,
  to_regclass('public.sample_products') as sample_products,
  to_regclass('public.sample_product_types') as sample_product_types,
  to_regclass('public.sample_products_with_bins') as sample_products_with_bins,
  to_regclass('public.bin_items') as legacy_bin_items_preserved,
  to_regclass('public.sample_inventory') as legacy_sample_inventory_preserved;
