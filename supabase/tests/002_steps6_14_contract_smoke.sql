-- Steps 6-14 database smoke checks. Read only.
select * from public.sc_deployment_health_v1() order by category, check_name;

select
  count(*) filter (where status = 'running') as active_supplier_runs,
  count(*) filter (where status = 'failed') as failed_supplier_runs,
  count(*) filter (where status = 'completed') as completed_supplier_runs
from public.sc_supplier_catalog_sync_runs;

select
  count(*) filter (where outcome = 'failed') as failed_pullsheet_runs,
  count(*) filter (where outcome = 'completed_with_warnings') as warning_pullsheet_runs,
  count(*) filter (where outcome = 'completed') as completed_pullsheet_runs
from public.sc_pullsheet_sync_runs;
