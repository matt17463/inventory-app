
-- LIMITED STEP 2 ROLLBACK
-- Run only if the Step 2 metadata/introspection layer itself causes a problem.
-- This does not touch inventory, orders, mappings, samples, operational RPCs, or storage objects.

begin;

-- Return Step 1 metadata marker to its previous phase when present.
update public.sc_inventory_model_registry
set migration_phase = 'step_1_parallel_preservation',
    notes = 'Step 2 metadata layer rolled back. Operational inventory and order data were not changed.',
    updated_at = now()
where id = 1
  and migration_phase = 'step_2_schema_baseline_and_contract';

-- Remove only the Step 2 application ledger entries.
delete from public.sc_application_schema_versions
where version_key in ('202607250101', '202607250102', '202607250103');

-- Introspection functions are safe to remove independently.
drop function if exists public.sc_schema_fingerprint_v1();
drop function if exists public.sc_schema_snapshot_v1();
drop function if exists public.sc_schema_contract_report_v1(text);

-- Remove only this contract version. Child metadata rows cascade.
delete from public.sc_schema_contract_versions
where contract_version = '2026-07-25-steps6-14-v1';

-- Tables are intentionally retained if another contract version exists.
do $$
begin
  if to_regclass('public.sc_schema_contract_versions') is not null
     and not exists (select 1 from public.sc_schema_contract_versions) then
    execute 'drop table if exists public.sc_schema_contract_storage_buckets';
    execute 'drop table if exists public.sc_schema_contract_functions';
    execute 'drop table if exists public.sc_schema_contract_columns';
    execute 'drop table if exists public.sc_schema_contract_relations';
    execute 'drop table if exists public.sc_schema_contract_versions';
  end if;
end $$;

commit;
