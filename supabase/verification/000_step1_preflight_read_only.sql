-- Skilled Crafting Inventory Application
-- STEP 1 PREFLIGHT (READ ONLY)
-- Safe to run before any migration. This script creates only temporary objects.
-- It does not insert, update, delete, rename, truncate, or drop production data.

set statement_timeout = '120s';

create temporary table if not exists sc_step1_preflight_results (
  section text not null,
  check_name text not null,
  status text not null,
  details jsonb
);

truncate table sc_step1_preflight_results;

insert into sc_step1_preflight_results(section, check_name, status, details)
select
  'relation',
  relation_name,
  case when to_regclass('public.' || relation_name) is null then 'MISSING' else 'PRESENT' end,
  jsonb_build_object(
    'relation', 'public.' || relation_name,
    'intended_role', intended_role
  )
from (values
  ('blank_products', 'Authoritative blank-product catalog'),
  ('blank_inventory_movements', 'Authoritative blank-inventory ledger'),
  ('products', 'WooCommerce product/variation catalog and blank-product mapping; not an inventory ledger'),
  ('jobs', 'Production job/order header'),
  ('job_items', 'Production job/order lines'),
  ('inventory_reservations', 'Inventory reservation ledger'),
  ('bins', 'Physical storage locations'),
  ('sample_products', 'Authoritative standalone sample inventory'),
  ('sample_product_types', 'Sample product-type lookup'),
  ('sample_products_with_bins', 'Sample display view'),
  ('bin_items', 'Legacy inventory assignment table; retained temporarily'),
  ('sample_inventory', 'Older blank-linked sample model; retained temporarily')
) as required(relation_name, intended_role);

-- Relation row counts. Counts are informational and do not modify data.
do $$
declare
  r record;
  v_count bigint;
begin
  for r in
    select * from (values
      ('blank_products'),
      ('blank_inventory_movements'),
      ('products'),
      ('jobs'),
      ('job_items'),
      ('inventory_reservations'),
      ('bins'),
      ('sample_products'),
      ('sample_product_types'),
      ('bin_items'),
      ('sample_inventory')
    ) as x(relation_name)
  loop
    if to_regclass('public.' || r.relation_name) is not null then
      execute format('select count(*) from public.%I', r.relation_name) into v_count;
      insert into sc_step1_preflight_results(section, check_name, status, details)
      values ('row_count', r.relation_name, 'INFO', jsonb_build_object('rows', v_count));
    end if;
  end loop;
end $$;

-- Required canonical blank-product columns.
insert into sc_step1_preflight_results(section, check_name, status, details)
select
  'column',
  'blank_products.' || required_column,
  case when c.column_name is null then 'MISSING' else 'PRESENT' end,
  jsonb_build_object('data_type', c.data_type, 'udt_name', c.udt_name)
from (values
  ('id'), ('sku_base'), ('name'), ('brand_id'), ('product_type_id'),
  ('color_id'), ('size_id'), ('unit_cost'), ('low_stock_threshold')
) as required(required_column)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'blank_products'
 and c.column_name = required.required_column;

-- Required canonical movement columns.
insert into sc_step1_preflight_results(section, check_name, status, details)
select
  'column',
  'blank_inventory_movements.' || required_column,
  case when c.column_name is null then 'MISSING' else 'PRESENT' end,
  jsonb_build_object('data_type', c.data_type, 'udt_name', c.udt_name)
from (values
  ('id'), ('blank_product_id'), ('bin_id'), ('quantity_change'), ('created_at'), ('notes')
) as required(required_column)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'blank_inventory_movements'
 and c.column_name = required.required_column;

-- Required standalone sample columns.
insert into sc_step1_preflight_results(section, check_name, status, details)
select
  'column',
  'sample_products.' || required_column,
  case when c.column_name is null then 'MISSING' else 'PRESENT' end,
  jsonb_build_object('data_type', c.data_type, 'udt_name', c.udt_name)
from (values
  ('id'), ('brand'), ('style'), ('price'), ('vendor'), ('color'), ('size'),
  ('product_type'), ('customer'), ('quantity'), ('bin_id'), ('image_url'),
  ('image_path'), ('notes'), ('created_at'), ('updated_at')
) as required(required_column)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = 'sample_products'
 and c.column_name = required.required_column;

-- Data integrity checks that are safe against missing optional objects.
do $$
declare
  v_count bigint;
begin
  if to_regclass('public.blank_products') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_products' and column_name='sku_base') then
    execute $q$
      select count(*)
      from (
        select upper(trim(sku_base)) normalized_sku
        from public.blank_products
        where nullif(trim(sku_base), '') is not null
        group by upper(trim(sku_base))
        having count(*) > 1
      ) d
    $q$ into v_count;
    insert into sc_step1_preflight_results values(
      'integrity', 'duplicate_blank_sku_groups',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      jsonb_build_object('duplicate_groups', v_count)
    );
  end if;

  if to_regclass('public.blank_inventory_movements') is not null
     and to_regclass('public.blank_products') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='blank_product_id') then
    execute $q$
      select count(*)
      from public.blank_inventory_movements m
      left join public.blank_products p on p.id = m.blank_product_id
      where p.id is null
    $q$ into v_count;
    insert into sc_step1_preflight_results values(
      'integrity', 'orphan_blank_inventory_movements',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      jsonb_build_object('rows', v_count)
    );
  end if;

  if to_regclass('public.blank_inventory_movements') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='quantity_change')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='bin_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='blank_product_id') then
    execute $q$
      select count(*)
      from (
        select bin_id, blank_product_id, sum(quantity_change) balance
        from public.blank_inventory_movements
        group by bin_id, blank_product_id
        having sum(quantity_change) < 0
      ) n
    $q$ into v_count;
    insert into sc_step1_preflight_results values(
      'integrity', 'negative_blank_inventory_balances',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      jsonb_build_object('bin_product_pairs', v_count)
    );
  end if;

  if to_regclass('public.products') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='blank_product_id') then
    execute 'select count(*) from public.products where blank_product_id is null' into v_count;
    insert into sc_step1_preflight_results values(
      'mapping', 'woo_products_without_blank_mapping', 'INFO', jsonb_build_object('rows', v_count)
    );
  end if;

  if to_regclass('public.bin_items') is not null then
    execute 'select count(*) from public.bin_items' into v_count;
    insert into sc_step1_preflight_results values(
      'legacy', 'legacy_bin_items_rows',
      case when v_count = 0 then 'PASS' else 'RETAIN_AND_REVIEW' end,
      jsonb_build_object('rows', v_count, 'action', 'Do not drop or migrate during Step 1')
    );
  end if;

  if to_regclass('public.sample_inventory') is not null then
    execute 'select count(*) from public.sample_inventory' into v_count;
    insert into sc_step1_preflight_results values(
      'legacy', 'older_sample_inventory_rows',
      case when v_count = 0 then 'PASS' else 'RETAIN_AND_REVIEW' end,
      jsonb_build_object('rows', v_count, 'action', 'Do not drop or migrate during Step 1')
    );
  end if;
end $$;

select section, check_name, status, details
from sc_step1_preflight_results
order by
  case section
    when 'relation' then 1
    when 'column' then 2
    when 'integrity' then 3
    when 'mapping' then 4
    when 'legacy' then 5
    when 'row_count' then 6
    else 9
  end,
  check_name;
