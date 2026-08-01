-- Step 14: deployment/release registry and database health report.
-- ADDITIVE/METADATA ONLY. Health checks read existing objects but do not alter business rows.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table if not exists public.sc_application_releases (
  release_key text primary key,
  description text not null,
  source_build text,
  deployed_at timestamptz not null default now(),
  deployed_by text default current_user,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.sc_application_releases enable row level security;
revoke all on public.sc_application_releases from public, anon, authenticated;
grant select, insert, update on public.sc_application_releases to service_role;

insert into public.sc_application_releases(release_key, description, source_build, metadata)
values (
  '2026-07-25-steps-6-14-v1',
  'Operational hardening, idempotency, cleanup, automated validation, and deployment health tooling',
  'inventory-app-main-steps6-14-safe',
  jsonb_build_object('steps', jsonb_build_array(6,7,8,9,10,11,12,13,14))
)
on conflict (release_key) do update
set description = excluded.description,
    source_build = excluded.source_build,
    metadata = excluded.metadata;

create or replace function public.sc_deployment_health_v1()
returns table (
  category text,
  check_name text,
  status text,
  detail text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with relation_requirements(name) as (
    values
      ('blank_products'),
      ('blank_inventory_movements'),
      ('products'),
      ('jobs'),
      ('job_items'),
      ('inventory_reservations'),
      ('product_sku_mappings'),
      ('sample_products'),
      ('sc_app_user_roles'),
      ('sc_woocommerce_status_change_audit'),
      ('sc_supplier_catalog_sync_runs'),
      ('sc_pullsheet_sync_runs')
  ), relation_rows as (
    select
      'database_relation'::text as category,
      name::text as check_name,
      case when to_regclass('public.' || name) is not null then 'PASS' else 'FAIL' end::text as status,
      case when to_regclass('public.' || name) is not null then 'Available' else 'Missing' end::text as detail
    from relation_requirements
  ), function_requirements(name) as (
    values
      ('reserve_inventory'),
      ('sc_ensure_job_item_reservation_v1'),
      ('sc_sync_woocommerce_order_status'),
      ('import_supplier_catalog_rows'),
      ('sc_customer_portal_data_v2')
  ), function_rows as (
    select
      'database_function'::text,
      name::text,
      case when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = function_requirements.name
      ) then 'PASS' else 'FAIL' end::text,
      case when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = function_requirements.name
      ) then 'Available' else 'Missing' end::text
    from function_requirements
  ), release_rows as (
    select
      'release'::text,
      release_key,
      'PASS'::text,
      description
    from public.sc_application_releases
    order by deployed_at desc
    limit 5
  ), version_rows as (
    select
      'migration'::text,
      version_key,
      'PASS'::text,
      phase || ': ' || description
    from public.sc_application_schema_versions
    where version_key in ('202607250501','202607250601','202607250701','202607251301')
  )
  select * from relation_rows
  union all select * from function_rows
  union all select * from release_rows
  union all select * from version_rows
$function$;

revoke all on function public.sc_deployment_health_v1() from public, anon, authenticated;
grant execute on function public.sc_deployment_health_v1() to service_role;

insert into public.sc_integration_security_registry
  (endpoint_name, authentication_mode, required_roles, required_environment_variables, compatibility_endpoint_of, notes)
values
  ('deployment-health', 'employee_jwt_role', array['admin','manager'], array['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'], null, 'Displays configuration presence and database contract health. It never returns secret values.')
on conflict (endpoint_name) do update set
  authentication_mode = excluded.authentication_mode,
  required_roles = excluded.required_roles,
  required_environment_variables = excluded.required_environment_variables,
  compatibility_endpoint_of = excluded.compatibility_endpoint_of,
  notes = excluded.notes,
  updated_at = now();

insert into public.sc_application_schema_versions(version_key, phase, description, notes)
values (
  '202607251301',
  'step_14',
  'Deployment health and application release registry',
  'Metadata and read-only health reporting only.'
)
on conflict (version_key) do update
set phase = excluded.phase,
    description = excluded.description,
    notes = excluded.notes;

commit;
