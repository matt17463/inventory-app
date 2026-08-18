
-- Skilled Crafting Inventory Application
-- STEP 2 POST-INSTALL VERIFICATION — READ ONLY

select public.sc_schema_contract_report_v1('2026-07-25-steps6-14-v1') as application_schema_contract_report;

select
  contract_version,
  source_build,
  active,
  relation_count,
  column_count,
  rpc_count,
  storage_bucket_count,
  route_count,
  installed_at,
  notes
from public.sc_schema_contract_versions
where contract_version = '2026-07-25-steps6-14-v1';

select
  version_key,
  phase,
  description,
  source_contract_version,
  applied_at,
  applied_by,
  notes
from public.sc_application_schema_versions
order by version_key;

select public.sc_schema_fingerprint_v1() as current_schema_fingerprint;

select
  id,
  migration_phase,
  notes,
  updated_at
from public.sc_inventory_model_registry
where id = 1;
