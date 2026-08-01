-- Skilled Crafting Inventory App
-- Steps 3-5 application-ledger reconciliation
-- SAFE / METADATA ONLY:
--   * Verifies that every required Step 3-5 object exists.
--   * Inserts only missing rows in public.sc_application_schema_versions.
--   * Does not change inventory, orders, jobs, reservations, products, samples,
--     portal events, supplier catalog rows, or authentication users.
--
-- Run this entire file once before re-running the Steps 6-14 preflight.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $block$
declare
  v_endpoint_count integer;
begin
  if to_regclass('public.sc_application_schema_versions') is null then
    raise exception
      'Cannot reconcile migration ledger: public.sc_application_schema_versions is missing. Complete Step 2 first.';
  end if;

  -- Step 3 verification
  if to_regprocedure('public.sc_customer_portal_data_v2(text)') is null then
    raise exception
      'Step 3 is not fully installed: public.sc_customer_portal_data_v2(text) is missing. Run migration 202607250201 instead of recording it.';
  end if;

  -- Step 4 verification
  if to_regclass('public.sc_app_user_roles') is null then
    raise exception
      'Step 4 is not fully installed: public.sc_app_user_roles is missing. Run migration 202607250301 instead of recording it.';
  end if;

  if to_regclass('public.sc_function_security_audit') is null then
    raise exception
      'Step 4 is not fully installed: public.sc_function_security_audit is missing. Run migration 202607250301 instead of recording it.';
  end if;

  if to_regprocedure('public.sc_current_app_role()') is null then
    raise exception
      'Step 4 is not fully installed: public.sc_current_app_role() is missing. Run migration 202607250301 instead of recording it.';
  end if;

  -- Step 5 verification
  if to_regclass('public.sc_integration_security_registry') is null then
    raise exception
      'Step 5 is not fully installed: public.sc_integration_security_registry is missing. Run migration 202607250401 instead of recording it.';
  end if;

  select count(*)
    into v_endpoint_count
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
  );

  if v_endpoint_count <> 8 then
    raise exception
      'Step 5 is incomplete: expected 8 secured endpoint registry rows, found %. Re-run migration 202607250401.', v_endpoint_count;
  end if;
end
$block$;

insert into public.sc_application_schema_versions (
  version_key,
  phase,
  description,
  source_contract_version,
  notes
)
values
  (
    '202607250201',
    'step_3',
    'Public token-scoped customer portal RPC',
    '2026-07-25-steps3-5-v1',
    'Ledger row added only after verifying public.sc_customer_portal_data_v2(text).'
  ),
  (
    '202607250301',
    'step_4',
    'Employee roles and privileged function security audit',
    '2026-07-25-steps3-5-v1',
    'Ledger row added only after verifying role, audit, and current-role objects.'
  ),
  (
    '202607250401',
    'step_5',
    'Integration endpoint security registry and fail-closed authentication deployment',
    '2026-07-25-steps3-5-v1',
    'Ledger row added only after verifying all eight endpoint registry records.'
  )
on conflict (version_key) do nothing;

commit;

select
  required.version_key,
  case when v.version_key is not null then 'PASS' else 'STOP' end as status,
  coalesce(v.phase || ': ' || v.description, 'Ledger row is still missing.') as detail,
  v.applied_at
from (values
  ('202607250201'),
  ('202607250301'),
  ('202607250401')
) as required(version_key)
left join public.sc_application_schema_versions v using (version_key)
order by required.version_key;
