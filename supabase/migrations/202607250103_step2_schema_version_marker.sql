
-- Skilled Crafting Inventory Application
-- STEP 2.3: Application schema version ledger and Step 2 marker
-- ADDITIVE/METADATA ONLY. Existing business rows are not changed.

begin;

create table if not exists public.sc_application_schema_versions (
  version_key text primary key,
  phase text not null,
  description text not null,
  source_contract_version text,
  applied_at timestamptz not null default now(),
  applied_by text default current_user,
  notes text
);

insert into public.sc_application_schema_versions(
  version_key, phase, description, source_contract_version, notes
)
values
  (
    '202607250001',
    'step_1',
    'Authoritative inventory model registry',
    null,
    'Recorded for application-level visibility. Supabase CLI migration history remains authoritative for db push.'
  ),
  (
    '202607250002',
    'step_1',
    'Canonical standalone sample support',
    null,
    'Recorded for application-level visibility. Supabase CLI migration history remains authoritative for db push.'
  ),
  (
    '202607250101',
    'step_2',
    'Source-derived schema contract registry',
    '2026-07-25-steps6-14-v1',
    'No operational schema objects or rows were changed.'
  ),
  (
    '202607250102',
    'step_2',
    'Schema contract report, snapshot, and fingerprint helpers',
    '2026-07-25-steps6-14-v1',
    'Read-only introspection functions plus restricted grants.'
  ),
  (
    '202607250103',
    'step_2',
    'Application schema version ledger and Step 2 marker',
    '2026-07-25-steps6-14-v1',
    'Metadata-only completion marker.'
  )
on conflict (version_key) do update
set phase = excluded.phase,
    description = excluded.description,
    source_contract_version = excluded.source_contract_version,
    notes = excluded.notes;

update public.sc_inventory_model_registry
set migration_phase = 'step_2_schema_baseline_and_contract',
    notes = 'Step 2 added a source-derived schema contract and baseline workflow without altering operational inventory or order data.',
    updated_at = now()
where id = 1;

comment on table public.sc_application_schema_versions is
  'Application-visible migration ledger. Supabase migration history remains the deployment source of truth.';

revoke all on table public.sc_application_schema_versions from public, anon, authenticated;

commit;
