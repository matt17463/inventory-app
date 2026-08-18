-- Run after SQL and application deployment.

select version_key, phase, description, applied_at
from public.sc_application_schema_versions
where version_key in ('202607250501','202607250601','202607250701','202607251301')
order by version_key;

select * from public.sc_deployment_health_v1()
order by category, check_name;

select
  to_regclass('public.sc_woocommerce_status_change_audit') as woo_status_audit,
  to_regclass('public.sc_supplier_catalog_sync_runs') as supplier_sync_runs,
  to_regclass('public.sc_pullsheet_sync_runs') as pullsheet_sync_runs,
  to_regprocedure('public.sc_ensure_job_item_reservation_v1(bigint,bigint,uuid,integer)') as ensure_reservation_rpc,
  to_regprocedure('public.sc_deployment_health_v1()') as deployment_health_rpc;
