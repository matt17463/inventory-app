-- Skilled Crafting Inventory App
-- Steps 6-14 preflight.
-- NON-DESTRUCTIVE: this creates only a session-local temporary results table.
-- V3 FIX: preserves the temporary results table and distinguishes missing ledger metadata from missing migration objects.
-- No permanent object or business row is changed.
-- Run the ENTIRE script before any Steps 6-14 migration and save the result grid.
-- Do not highlight and run only the final SELECT statement.

drop table if exists pg_temp.sc_steps6_14_preflight_results;

create temporary table sc_steps6_14_preflight_results (
  category text not null,
  check_name text not null,
  status text not null,
  detail text not null
) on commit preserve rows;

insert into pg_temp.sc_steps6_14_preflight_results(category, check_name, status, detail)
select
  'relation',
  required.name,
  case when to_regclass('public.' || required.name) is not null then 'PASS' else 'STOP' end,
  required.purpose || case when to_regclass('public.' || required.name) is null then ' is missing.' else ' exists.' end
from (values
  ('jobs', 'WooCommerce order / production job records'),
  ('job_items', 'Pull-sheet line items'),
  ('inventory_reservations', 'Inventory reservations'),
  ('blank_products', 'Authoritative blank product catalog'),
  ('supplier_catalog_feeds', 'Supplier feed configuration'),
  ('sc_app_user_roles', 'Employee function authorization'),
  ('sc_application_schema_versions', 'Application migration ledger'),
  ('sc_integration_security_registry', 'Endpoint security registry from Steps 3-5')
) as required(name, purpose);

insert into pg_temp.sc_steps6_14_preflight_results(category, check_name, status, detail)
select
  'function',
  required.name,
  case when exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = required.name
  ) then 'PASS' else 'STOP' end,
  required.purpose
from (values
  ('reserve_inventory', 'Existing inventory reservation RPC'),
  ('sc_sync_woocommerce_order_status', 'WooCommerce status synchronization RPC'),
  ('import_supplier_catalog_rows', 'Supplier catalog import RPC')
) as required(name, purpose);

-- Verify the ID types used by the additive Step 8 helper before creating it.
insert into pg_temp.sc_steps6_14_preflight_results(category, check_name, status, detail)
select
  'column_type',
  required.table_name || '.' || required.column_name,
  case
    when c.column_name is null then 'STOP'
    when c.udt_name = any(required.allowed_udt_names) then 'PASS'
    else 'STOP'
  end,
  case
    when c.column_name is null then 'Required column is missing.'
    else 'Detected type: ' || c.udt_name || '; expected one of: ' || array_to_string(required.allowed_udt_names, ', ')
  end
from (values
  ('blank_products', 'id', array['uuid']::text[]),
  ('jobs', 'id', array['int8','int4','int2']::text[]),
  ('job_items', 'id', array['int8','int4','int2']::text[]),
  ('job_items', 'job_id', array['int8','int4','int2']::text[]),
  ('job_items', 'woocommerce_line_item_id', array['int8','int4','int2','text','varchar']::text[]),
  ('inventory_reservations', 'job_item_id', array['int8','int4','int2']::text[])
) as required(table_name, column_name, allowed_udt_names)
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = required.table_name
 and c.column_name = required.column_name;

-- Confirm Steps 3-5 are installed and recorded.
-- V3 distinguishes an installed-but-unrecorded migration (REVIEW) from a truly missing migration (STOP).
insert into pg_temp.sc_steps6_14_preflight_results(category, check_name, status, detail)
with required as (
  select *
  from (values
    (
      '202607250201',
      to_regprocedure('public.sc_customer_portal_data_v2(text)') is not null,
      'Step 3 public customer portal objects'
    ),
    (
      '202607250301',
      to_regclass('public.sc_app_user_roles') is not null
        and to_regclass('public.sc_function_security_audit') is not null
        and to_regprocedure('public.sc_current_app_role()') is not null,
      'Step 4 employee authorization objects'
    ),
    (
      '202607250401',
      to_regclass('public.sc_integration_security_registry') is not null
        and (
          select count(*)
          from public.sc_integration_security_registry
          where endpoint_name in (
            'update-woocommerce-order-status',
            'supplier-catalog-feed-sync',
            'artwork-system-handoff',
            'manual-pullsheet',
            'manual-pullsheet-visible-unpaired-items',
            'set-pullsheet-due-dates',
            'woocommerce-webhook',
            'woocommerce-webhook-visible-unpaired-items'
          )
        ) = 8,
      'Step 5 integration security registry'
    )
  ) as x(version_key, objects_installed, purpose)
)
select
  'migration',
  required.version_key,
  case
    when v.version_key is not null then 'PASS'
    when required.objects_installed then 'REVIEW'
    else 'STOP'
  end,
  case
    when v.version_key is not null
      then v.phase || ': ' || v.description
    when required.objects_installed
      then required.purpose || ' are installed, but the application migration ledger row is missing. Run the guarded Steps 3-5 ledger reconciliation SQL.'
    else required.purpose || ' are not fully installed. Run the corresponding Step 3-5 migration; do not add only a ledger row.'
  end
from required
left join public.sc_application_schema_versions v using (version_key);

-- Data-quality checks are dynamic so a missing required relation produces a STOP row instead of aborting this script.
do $block$
declare
  v_count bigint;
  v_public boolean;
  v_limit bigint;
begin
  if to_regclass('public.jobs') is not null then
    execute $sql$
      select count(*)
      from (
        select woocommerce_order_id
        from public.jobs
        where woocommerce_order_id is not null
        group by woocommerce_order_id
        having count(*) > 1
      ) d
    $sql$ into v_count;
    insert into pg_temp.sc_steps6_14_preflight_results values (
      'data_quality', 'duplicate_jobs_by_woo_order',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      v_count || ' duplicate WooCommerce order group(s). Existing rows are not changed by this package.'
    );
  end if;

  if to_regclass('public.job_items') is not null then
    execute $sql$
      select count(*)
      from (
        select job_id, woocommerce_line_item_id
        from public.job_items
        where woocommerce_line_item_id is not null
        group by job_id, woocommerce_line_item_id
        having count(*) > 1
      ) d
    $sql$ into v_count;
    insert into pg_temp.sc_steps6_14_preflight_results values (
      'data_quality', 'duplicate_job_items_by_woo_line',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      v_count || ' duplicate job/line-item group(s). Do not run the optional unique-index SQL unless this is zero.'
    );
  end if;

  if to_regclass('storage.buckets') is null then
    insert into pg_temp.sc_steps6_14_preflight_results values (
      'storage', 'supplier-sync-cache', 'STOP', 'storage.buckets is unavailable.'
    );
  else
    select b.public, b.file_size_limit
      into v_public, v_limit
    from storage.buckets b
    where b.id = 'supplier-sync-cache';

    if not found then
      insert into pg_temp.sc_steps6_14_preflight_results values (
        'storage', 'supplier-sync-cache', 'PASS', 'Bucket is absent and will be created as private by Step 7.'
      );
    elsif coalesce(v_public, false) then
      insert into pg_temp.sc_steps6_14_preflight_results values (
        'storage', 'supplier-sync-cache', 'REVIEW', 'An existing bucket with this ID is public. Step 7 will not overwrite its configuration; make it private before use.'
      );
    else
      insert into pg_temp.sc_steps6_14_preflight_results values (
        'storage', 'supplier-sync-cache', 'PASS', 'Existing bucket is private. Current file-size limit: ' || coalesce(v_limit::text, 'unlimited') || ' bytes.'
      );
    end if;
  end if;
end
$block$;

select category, check_name, status, detail
from pg_temp.sc_steps6_14_preflight_results
order by
  case status when 'STOP' then 1 when 'REVIEW' then 2 else 3 end,
  category,
  check_name;

