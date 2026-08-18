-- Skilled Crafting Inventory App
-- FINAL STEPS 1-14 READ-ONLY AUDIT
-- Safe to run in Supabase SQL Editor. Creates only a temporary results table.
-- Run the ENTIRE file at once. It does not modify operational data or permanent schema.

set statement_timeout = '180s';

drop table if exists pg_temp.sc_steps1_14_final_audit;
create temporary table sc_steps1_14_final_audit (
  category text not null,
  check_name text not null,
  status text not null,
  detail text not null
) on commit preserve rows;

-- Core operational and governance relations.
insert into pg_temp.sc_steps1_14_final_audit(category, check_name, status, detail)
select
  'relation',
  required.name,
  case when to_regclass(required.qualified_name) is not null then 'PASS' else 'STOP' end,
  case when to_regclass(required.qualified_name) is not null
    then required.purpose || ' exists.'
    else required.purpose || ' is missing.'
  end
from (values
  ('blank_products', 'public.blank_products', 'Authoritative blank-product catalog'),
  ('blank_inventory_movements', 'public.blank_inventory_movements', 'Authoritative blank-inventory ledger'),
  ('products', 'public.products', 'WooCommerce catalog and blank mapping'),
  ('jobs', 'public.jobs', 'Production job headers'),
  ('job_items', 'public.job_items', 'Production job lines'),
  ('inventory_reservations', 'public.inventory_reservations', 'Reservation ledger'),
  ('sample_products', 'public.sample_products', 'Canonical sample inventory'),
  ('sc_inventory_model_registry', 'public.sc_inventory_model_registry', 'Step 1 model registry'),
  ('sc_schema_contract_versions', 'public.sc_schema_contract_versions', 'Step 2 schema contract registry'),
  ('sc_application_schema_versions', 'public.sc_application_schema_versions', 'Application migration ledger'),
  ('sc_app_user_roles', 'public.sc_app_user_roles', 'Step 4 employee roles'),
  ('sc_function_security_audit', 'public.sc_function_security_audit', 'Step 4 function security audit'),
  ('sc_integration_security_registry', 'public.sc_integration_security_registry', 'Step 5 endpoint security registry'),
  ('sc_woocommerce_status_change_audit', 'public.sc_woocommerce_status_change_audit', 'Step 6 WooCommerce status audit'),
  ('sc_supplier_catalog_sync_runs', 'public.sc_supplier_catalog_sync_runs', 'Step 7 supplier sync runs'),
  ('sc_pullsheet_sync_runs', 'public.sc_pullsheet_sync_runs', 'Step 8 pull-sheet sync runs'),
  ('sc_application_releases', 'public.sc_application_releases', 'Step 14 release registry')
) as required(name, qualified_name, purpose);

-- Required functions. Exact signatures are checked where known.
insert into pg_temp.sc_steps1_14_final_audit(category, check_name, status, detail)
select
  'function',
  required.name,
  case when to_regprocedure(required.signature) is not null then 'PASS' else 'STOP' end,
  case when to_regprocedure(required.signature) is not null then 'Function exists.' else 'Required function is missing.' end
from (values
  ('sc_inventory_model_health_v1', 'public.sc_inventory_model_health_v1()'),
  ('sc_schema_snapshot_v1', 'public.sc_schema_snapshot_v1()'),
  ('sc_schema_fingerprint_v1', 'public.sc_schema_fingerprint_v1()'),
  ('sc_customer_portal_data_v2', 'public.sc_customer_portal_data_v2(text)'),
  ('sc_current_app_role', 'public.sc_current_app_role()'),
  ('sc_ensure_job_item_reservation_v1', 'public.sc_ensure_job_item_reservation_v1(bigint,bigint,uuid,integer)'),
  ('sc_deployment_health_v1', 'public.sc_deployment_health_v1()')
) as required(name, signature);

-- Existing operational RPC names whose signatures can vary between deployments.
insert into pg_temp.sc_steps1_14_final_audit(category, check_name, status, detail)
select
  'operational_function',
  required.name,
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = required.name
  ) then 'PASS' else 'STOP' end,
  required.purpose
from (values
  ('reserve_inventory', 'Required by pull-sheet reservation repair.'),
  ('sc_sync_woocommerce_order_status', 'Required by WooCommerce status synchronization.'),
  ('import_supplier_catalog_rows', 'Required by supplier catalog synchronization.')
) as required(name, purpose);

-- Migration ledger checks are dynamic so a missing ledger table does not abort the script.
do $block$
declare
  v_key text;
  v_exists boolean;
begin
  if to_regclass('public.sc_application_schema_versions') is null then
    insert into pg_temp.sc_steps1_14_final_audit values
      ('migration', 'application migration ledger', 'STOP', 'public.sc_application_schema_versions is missing.');
  else
    foreach v_key in array array[
      '202607250103',
      '202607250201',
      '202607250301',
      '202607250401',
      '202607250501',
      '202607250601',
      '202607250701',
      '202607251301'
    ] loop
      execute 'select exists(select 1 from public.sc_application_schema_versions where version_key = $1)'
        into v_exists using v_key;
      insert into pg_temp.sc_steps1_14_final_audit values (
        'migration',
        v_key,
        case when v_exists then 'PASS' else 'STOP' end,
        case when v_exists then 'Migration is recorded.' else 'Migration ledger row is missing.' end
      );
    end loop;
  end if;
end
$block$;

-- Security configuration checks.
do $block$
declare
  v_count bigint;
  v_public boolean;
begin
  if to_regclass('auth.users') is not null and to_regclass('public.sc_app_user_roles') is not null then
    execute $sql$
      select count(*)
      from auth.users u
      left join public.sc_app_user_roles r on r.user_id = u.id and coalesce(r.is_active, true)
      where r.user_id is null
    $sql$ into v_count;
    insert into pg_temp.sc_steps1_14_final_audit values (
      'security', 'auth_users_without_active_app_role',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      v_count || ' Auth user(s) have no active application role.'
    );
  end if;

  if to_regclass('public.sc_integration_security_registry') is not null then
    execute $sql$
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
        'woocommerce-webhook-visible-unpaired-items',
        'deployment-health'
      )
    $sql$ into v_count;
    insert into pg_temp.sc_steps1_14_final_audit values (
      'security', 'registered_secured_endpoints',
      case when v_count = 9 then 'PASS' else 'STOP' end,
      v_count || ' of 9 expected secured endpoint records exist.'
    );
  end if;

  if to_regclass('storage.buckets') is null then
    insert into pg_temp.sc_steps1_14_final_audit values
      ('storage', 'supplier-sync-cache', 'STOP', 'Supabase storage.buckets is unavailable.');
  else
    select b.public into v_public from storage.buckets b where b.id = 'supplier-sync-cache';
    if not found then
      insert into pg_temp.sc_steps1_14_final_audit values
        ('storage', 'supplier-sync-cache', 'STOP', 'Private supplier cache bucket is missing.');
    elsif coalesce(v_public, false) then
      insert into pg_temp.sc_steps1_14_final_audit values
        ('storage', 'supplier-sync-cache', 'STOP', 'Bucket exists but is public. It must be private.');
    else
      insert into pg_temp.sc_steps1_14_final_audit values
        ('storage', 'supplier-sync-cache', 'PASS', 'Private supplier cache bucket exists.');
    end if;
  end if;
end
$block$;

-- Data-quality checks. These do not change rows.
do $block$
declare
  v_count bigint;
begin
  if to_regclass('public.jobs') is not null then
    execute $sql$
      select count(*) from (
        select woocommerce_order_id
        from public.jobs
        where woocommerce_order_id is not null
        group by woocommerce_order_id
        having count(*) > 1
      ) d
    $sql$ into v_count;
    insert into pg_temp.sc_steps1_14_final_audit values (
      'data_quality', 'duplicate_jobs_by_woocommerce_order',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      v_count || ' duplicate order group(s).'
    );
  end if;

  if to_regclass('public.job_items') is not null then
    execute $sql$
      select count(*) from (
        select job_id, woocommerce_line_item_id
        from public.job_items
        where woocommerce_line_item_id is not null
        group by job_id, woocommerce_line_item_id
        having count(*) > 1
      ) d
    $sql$ into v_count;
    insert into pg_temp.sc_steps1_14_final_audit values (
      'data_quality', 'duplicate_job_items_by_woocommerce_line',
      case when v_count = 0 then 'PASS' else 'REVIEW' end,
      v_count || ' duplicate job/line-item group(s).'
    );
  end if;
end
$block$;

select category, check_name, status, detail
from pg_temp.sc_steps1_14_final_audit
order by
  case status when 'STOP' then 1 when 'REVIEW' then 2 else 3 end,
  category,
  check_name;
