-- Skilled Crafting Inventory Application
-- STEP 1: Authoritative inventory-model registry and health check
-- NON-DESTRUCTIVE: creates new metadata objects and comments only.
-- Does not move, rewrite, delete, rename, or block existing application data.

begin;

create table if not exists public.sc_inventory_model_registry (
  id smallint primary key default 1 check (id = 1),
  blank_catalog_relation text not null default 'public.blank_products',
  blank_ledger_relation text not null default 'public.blank_inventory_movements',
  woo_catalog_relation text not null default 'public.products',
  sample_catalog_relation text not null default 'public.sample_products',
  legacy_bin_relation text not null default 'public.bin_items',
  legacy_sample_relation text not null default 'public.sample_inventory',
  migration_phase text not null default 'step_1_parallel_preservation',
  legacy_writes_blocked boolean not null default false,
  notes text not null default 'Canonical model declared without altering existing operational data.',
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sc_inventory_model_registry(id)
values (1)
on conflict (id) do nothing;

comment on table public.sc_inventory_model_registry is
  'Declares the authoritative application data model. Step 1 is metadata-only and preserves all legacy relations.';

-- Comments clarify roles without changing behavior.
do $$
begin
  if to_regclass('public.blank_products') is not null then
    execute 'comment on table public.blank_products is ''Authoritative blank-product catalog. Inventory quantity is derived from the movement ledger, not stored here.''';
  end if;

  if to_regclass('public.blank_inventory_movements') is not null then
    execute 'comment on table public.blank_inventory_movements is ''Authoritative append-style blank-inventory ledger by blank product and bin.''';
  end if;

  if to_regclass('public.products') is not null then
    execute 'comment on table public.products is ''WooCommerce product/variation catalog and blank-product mapping. This table remains operational and is not the blank-inventory ledger.''';
  end if;

  if to_regclass('public.sample_products') is not null then
    execute 'comment on table public.sample_products is ''Authoritative standalone sample inventory used by the active application sample page.''';
  end if;

  if to_regclass('public.bin_items') is not null then
    execute 'comment on table public.bin_items is ''Legacy direct product-to-bin inventory table. Preserved during Step 1; new application code must not write here.''';
  end if;

  if to_regclass('public.sample_inventory') is not null then
    execute 'comment on table public.sample_inventory is ''Older blank-linked sample model. Preserved during Step 1; active sample pages use sample_products.''';
  end if;
end $$;

create or replace function public.sc_inventory_model_health_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_count bigint;
  v_relations jsonb := '{}'::jsonb;
  v_checks jsonb := '{}'::jsonb;
  v_config jsonb;
begin
  select to_jsonb(registry_row)
  into v_config
  from public.sc_inventory_model_registry registry_row
  where id = 1;

  for r in
    select * from (values
      ('blank_products', 'public.blank_products', 'authoritative_blank_catalog'),
      ('blank_inventory_movements', 'public.blank_inventory_movements', 'authoritative_blank_ledger'),
      ('products', 'public.products', 'woocommerce_catalog_and_mapping'),
      ('jobs', 'public.jobs', 'production_order_header'),
      ('job_items', 'public.job_items', 'production_order_lines'),
      ('inventory_reservations', 'public.inventory_reservations', 'reservation_ledger'),
      ('bins', 'public.bins', 'physical_locations'),
      ('sample_products', 'public.sample_products', 'authoritative_sample_catalog'),
      ('sample_product_types', 'public.sample_product_types', 'sample_lookup'),
      ('sample_products_with_bins', 'public.sample_products_with_bins', 'sample_display_view'),
      ('bin_items', 'public.bin_items', 'legacy_preserved'),
      ('sample_inventory', 'public.sample_inventory', 'legacy_preserved')
    ) as x(key_name, relation_name, model_role)
  loop
    if to_regclass(r.relation_name) is null then
      v_relations := v_relations || jsonb_build_object(
        r.key_name,
        jsonb_build_object('exists', false, 'role', r.model_role)
      );
    else
      execute format('select count(*) from %s', r.relation_name) into v_count;
      v_relations := v_relations || jsonb_build_object(
        r.key_name,
        jsonb_build_object('exists', true, 'role', r.model_role, 'row_count', v_count)
      );
    end if;
  end loop;

  if to_regclass('public.blank_products') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_products' and column_name='sku_base') then
    execute $q$
      select count(*)
      from (
        select upper(trim(sku_base))
        from public.blank_products
        where nullif(trim(sku_base), '') is not null
        group by upper(trim(sku_base))
        having count(*) > 1
      ) d
    $q$ into v_count;
    v_checks := v_checks || jsonb_build_object('duplicate_blank_sku_groups', v_count);
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
    v_checks := v_checks || jsonb_build_object('orphan_blank_inventory_movements', v_count);
  end if;

  if to_regclass('public.blank_inventory_movements') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='quantity_change')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='bin_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='blank_inventory_movements' and column_name='blank_product_id') then
    execute $q$
      select count(*)
      from (
        select bin_id, blank_product_id
        from public.blank_inventory_movements
        group by bin_id, blank_product_id
        having sum(quantity_change) < 0
      ) n
    $q$ into v_count;
    v_checks := v_checks || jsonb_build_object('negative_blank_inventory_balances', v_count);
  end if;

  if to_regclass('public.products') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='blank_product_id') then
    execute 'select count(*) from public.products where blank_product_id is null' into v_count;
    v_checks := v_checks || jsonb_build_object('woo_products_without_blank_mapping', v_count);
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'configuration', coalesce(v_config, '{}'::jsonb),
    'relations', v_relations,
    'checks', v_checks,
    'safe_to_drop_legacy', false,
    'message', 'Step 1 preserves legacy relations. Do not drop bin_items or sample_inventory based only on this report.'
  );
end;
$$;

revoke all on table public.sc_inventory_model_registry from anon, authenticated;
revoke all on function public.sc_inventory_model_health_v1() from public, anon;
grant execute on function public.sc_inventory_model_health_v1() to authenticated;

commit;
