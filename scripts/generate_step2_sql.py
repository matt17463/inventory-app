#!/usr/bin/env python3
"""Generate Step 2 additive SQL from the source-derived database contract."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "supabase" / "contract" / "application_database_contract.json"
MIGRATIONS = ROOT / "supabase" / "migrations"
VERIFICATION = ROOT / "supabase" / "verification"
TESTS = ROOT / "supabase" / "tests"


def dollar_json(value: object, tag: str) -> str:
    content = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    if f"${tag}$" in content:
        raise ValueError("Dollar quote tag collision")
    return f"${tag}${content}${tag}$::jsonb"


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def main() -> None:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    version = contract["contract_version"]
    summary = contract["summary"]

    relations_payload = []
    for row in contract["relations"]:
        relations_payload.append(
            {
                "schema_name": row["schema_name"],
                "relation_name": row["relation_name"],
                "required": row["required"],
                "usage_scopes": row["usage_scopes"],
                "operations": row["operations"],
                "source_files": row["source_files"],
                "raw_selects": row["raw_selects"],
            }
        )

    columns_payload = contract["columns"]
    rpc_payload = contract["rpc_functions"]
    bucket_payload = contract["storage_buckets"]

    migration_101 = f"""
-- Skilled Crafting Inventory Application
-- STEP 2.1: Source-derived application schema contract registry
-- ADDITIVE ONLY: creates sc_schema_contract_* metadata objects.
-- No operational table, view, RPC, policy, inventory row, order row, or storage object is changed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '180s';

create table if not exists public.sc_schema_contract_versions (
  contract_version text primary key,
  source_build text not null,
  active boolean not null default true,
  relation_count integer not null,
  column_count integer not null,
  rpc_count integer not null,
  storage_bucket_count integer not null,
  route_count integer not null,
  generated_at timestamptz not null default now(),
  installed_at timestamptz not null default now(),
  notes text
);

create table if not exists public.sc_schema_contract_relations (
  contract_version text not null references public.sc_schema_contract_versions(contract_version) on delete cascade,
  schema_name text not null default 'public',
  relation_name text not null,
  required boolean not null default true,
  usage_scopes text[] not null default '{{}}'::text[],
  operations text[] not null default '{{}}'::text[],
  source_files jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{{}}'::jsonb,
  primary key (contract_version, schema_name, relation_name)
);

create table if not exists public.sc_schema_contract_columns (
  contract_version text not null references public.sc_schema_contract_versions(contract_version) on delete cascade,
  schema_name text not null default 'public',
  relation_name text not null,
  column_name text not null,
  required boolean not null default true,
  evidence_types text[] not null default '{{}}'::text[],
  source_files jsonb not null default '[]'::jsonb,
  primary key (contract_version, schema_name, relation_name, column_name)
);

create table if not exists public.sc_schema_contract_functions (
  contract_version text not null references public.sc_schema_contract_versions(contract_version) on delete cascade,
  schema_name text not null default 'public',
  function_name text not null,
  required boolean not null default true,
  usage_scopes text[] not null default '{{}}'::text[],
  expected_argument_names text[] not null default '{{}}'::text[],
  source_files jsonb not null default '[]'::jsonb,
  primary key (contract_version, schema_name, function_name)
);

create table if not exists public.sc_schema_contract_storage_buckets (
  contract_version text not null references public.sc_schema_contract_versions(contract_version) on delete cascade,
  bucket_name text not null,
  required boolean not null default true,
  usage_scopes text[] not null default '{{}}'::text[],
  operations text[] not null default '{{}}'::text[],
  source_files jsonb not null default '[]'::jsonb,
  primary key (contract_version, bucket_name)
);

create index if not exists sc_schema_contract_relations_active_idx
  on public.sc_schema_contract_relations(contract_version, required, schema_name, relation_name);
create index if not exists sc_schema_contract_columns_active_idx
  on public.sc_schema_contract_columns(contract_version, required, schema_name, relation_name, column_name);
create index if not exists sc_schema_contract_functions_active_idx
  on public.sc_schema_contract_functions(contract_version, required, schema_name, function_name);

update public.sc_schema_contract_versions
set active = false
where active = true
  and contract_version <> '{version}';

insert into public.sc_schema_contract_versions(
  contract_version,
  source_build,
  active,
  relation_count,
  column_count,
  rpc_count,
  storage_bucket_count,
  route_count,
  notes
)
values (
  '{version}',
  'inventory-app-main-step2-safe',
  true,
  {summary['relations']},
  {summary['columns']},
  {summary['rpc_functions']},
  {summary['storage_buckets']},
  {summary['routes']},
  'Source-derived contract. Names and explicit columns are recorded without inferring or modifying production data types.'
)
on conflict (contract_version) do update
set source_build = excluded.source_build,
    active = excluded.active,
    relation_count = excluded.relation_count,
    column_count = excluded.column_count,
    rpc_count = excluded.rpc_count,
    storage_bucket_count = excluded.storage_bucket_count,
    route_count = excluded.route_count,
    notes = excluded.notes;

with payload as (
  select {dollar_json(relations_payload, 'relations')} as data
), rows as (
  select item
  from payload, jsonb_array_elements(data) item
)
insert into public.sc_schema_contract_relations(
  contract_version, schema_name, relation_name, required,
  usage_scopes, operations, source_files, evidence
)
select
  '{version}',
  item->>'schema_name',
  item->>'relation_name',
  coalesce((item->>'required')::boolean, true),
  array(select jsonb_array_elements_text(coalesce(item->'usage_scopes', '[]'::jsonb))),
  array(select jsonb_array_elements_text(coalesce(item->'operations', '[]'::jsonb))),
  coalesce(item->'source_files', '[]'::jsonb),
  jsonb_build_object('raw_selects', coalesce(item->'raw_selects', '[]'::jsonb))
from rows
on conflict (contract_version, schema_name, relation_name) do update
set required = excluded.required,
    usage_scopes = excluded.usage_scopes,
    operations = excluded.operations,
    source_files = excluded.source_files,
    evidence = excluded.evidence;

with payload as (
  select {dollar_json(columns_payload, 'columns')} as data
), rows as (
  select item
  from payload, jsonb_array_elements(data) item
)
insert into public.sc_schema_contract_columns(
  contract_version, schema_name, relation_name, column_name,
  required, evidence_types, source_files
)
select
  '{version}',
  item->>'schema_name',
  item->>'relation_name',
  item->>'column_name',
  coalesce((item->>'required')::boolean, true),
  array(select jsonb_array_elements_text(coalesce(item->'evidence_types', '[]'::jsonb))),
  coalesce(item->'source_files', '[]'::jsonb)
from rows
on conflict (contract_version, schema_name, relation_name, column_name) do update
set required = excluded.required,
    evidence_types = excluded.evidence_types,
    source_files = excluded.source_files;

with payload as (
  select {dollar_json(rpc_payload, 'functions')} as data
), rows as (
  select item
  from payload, jsonb_array_elements(data) item
)
insert into public.sc_schema_contract_functions(
  contract_version, schema_name, function_name, required,
  usage_scopes, expected_argument_names, source_files
)
select
  '{version}',
  item->>'schema_name',
  item->>'function_name',
  coalesce((item->>'required')::boolean, true),
  array(select jsonb_array_elements_text(coalesce(item->'usage_scopes', '[]'::jsonb))),
  array(select jsonb_array_elements_text(coalesce(item->'expected_argument_names', '[]'::jsonb))),
  coalesce(item->'source_files', '[]'::jsonb)
from rows
on conflict (contract_version, schema_name, function_name) do update
set required = excluded.required,
    usage_scopes = excluded.usage_scopes,
    expected_argument_names = excluded.expected_argument_names,
    source_files = excluded.source_files;

with payload as (
  select {dollar_json(bucket_payload, 'buckets')} as data
), rows as (
  select item
  from payload, jsonb_array_elements(data) item
)
insert into public.sc_schema_contract_storage_buckets(
  contract_version, bucket_name, required,
  usage_scopes, operations, source_files
)
select
  '{version}',
  item->>'bucket_name',
  coalesce((item->>'required')::boolean, true),
  array(select jsonb_array_elements_text(coalesce(item->'usage_scopes', '[]'::jsonb))),
  array(select jsonb_array_elements_text(coalesce(item->'operations', '[]'::jsonb))),
  coalesce(item->'source_files', '[]'::jsonb)
from rows
on conflict (contract_version, bucket_name) do update
set required = excluded.required,
    usage_scopes = excluded.usage_scopes,
    operations = excluded.operations,
    source_files = excluded.source_files;

comment on table public.sc_schema_contract_versions is
  'Versioned source-derived database contract for the Skilled Crafting application.';
comment on table public.sc_schema_contract_relations is
  'Tables and views referenced by compiled frontend source or deployed Netlify functions.';
comment on table public.sc_schema_contract_columns is
  'Explicit columns referenced in selects, filters, ordering, relationships, and literal mutations.';
comment on table public.sc_schema_contract_functions is
  'Supabase RPC names and literal argument names referenced by application source.';
comment on table public.sc_schema_contract_storage_buckets is
  'Supabase Storage bucket names referenced by application source.';

revoke all on table public.sc_schema_contract_versions from public, anon, authenticated;
revoke all on table public.sc_schema_contract_relations from public, anon, authenticated;
revoke all on table public.sc_schema_contract_columns from public, anon, authenticated;
revoke all on table public.sc_schema_contract_functions from public, anon, authenticated;
revoke all on table public.sc_schema_contract_storage_buckets from public, anon, authenticated;

commit;
"""

    migration_102 = r"""
-- Skilled Crafting Inventory Application
-- STEP 2.2: Schema contract report, snapshot, and fingerprint helpers
-- ADDITIVE ONLY: creates sc_schema_* functions and reads system catalogs.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '180s';

create or replace function public.sc_schema_contract_report_v1(
  p_contract_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_version text;
  v_missing_relations jsonb := '[]'::jsonb;
  v_missing_columns jsonb := '[]'::jsonb;
  v_missing_functions jsonb := '[]'::jsonb;
  v_signature_mismatches jsonb := '[]'::jsonb;
  v_missing_buckets jsonb := '[]'::jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_status text;
begin
  select coalesce(
    p_contract_version,
    (
      select contract_version
      from public.sc_schema_contract_versions
      where active = true
      order by installed_at desc, contract_version desc
      limit 1
    )
  ) into v_version;

  if v_version is null then
    raise exception 'No schema contract version is installed';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', c.schema_name,
        'relation', c.relation_name,
        'usage_scopes', c.usage_scopes,
        'source_files', c.source_files
      ) order by c.schema_name, c.relation_name
    ),
    '[]'::jsonb
  )
  into v_missing_relations
  from public.sc_schema_contract_relations c
  where c.contract_version = v_version
    and c.required
    and to_regclass(format('%I.%I', c.schema_name, c.relation_name)) is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', c.schema_name,
        'relation', c.relation_name,
        'column', c.column_name,
        'evidence_types', c.evidence_types,
        'source_files', c.source_files
      ) order by c.schema_name, c.relation_name, c.column_name
    ),
    '[]'::jsonb
  )
  into v_missing_columns
  from public.sc_schema_contract_columns c
  where c.contract_version = v_version
    and c.required
    and to_regclass(format('%I.%I', c.schema_name, c.relation_name)) is not null
    and not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = c.schema_name
        and ic.table_name = c.relation_name
        and ic.column_name = c.column_name
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', c.schema_name,
        'function', c.function_name,
        'expected_argument_names', c.expected_argument_names,
        'usage_scopes', c.usage_scopes,
        'source_files', c.source_files
      ) order by c.schema_name, c.function_name
    ),
    '[]'::jsonb
  )
  into v_missing_functions
  from public.sc_schema_contract_functions c
  where c.contract_version = v_version
    and c.required
    and not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = c.schema_name
        and p.proname = c.function_name
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', c.schema_name,
        'function', c.function_name,
        'expected_argument_names', c.expected_argument_names,
        'available_signatures', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'identity_arguments', pg_get_function_identity_arguments(p2.oid),
                'argument_names', coalesce(to_jsonb(p2.proargnames), '[]'::jsonb)
              ) order by pg_get_function_identity_arguments(p2.oid)
            ),
            '[]'::jsonb
          )
          from pg_proc p2
          join pg_namespace n2 on n2.oid = p2.pronamespace
          where n2.nspname = c.schema_name
            and p2.proname = c.function_name
        )
      ) order by c.schema_name, c.function_name
    ),
    '[]'::jsonb
  )
  into v_signature_mismatches
  from public.sc_schema_contract_functions c
  where c.contract_version = v_version
    and c.required
    and cardinality(c.expected_argument_names) > 0
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = c.schema_name
        and p.proname = c.function_name
    )
    and not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = c.schema_name
        and p.proname = c.function_name
        and c.expected_argument_names <@ coalesce(p.proargnames, array[]::text[])
    );

  if to_regclass('storage.buckets') is null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket', c.bucket_name,
          'reason', 'storage.buckets relation is unavailable',
          'source_files', c.source_files
        ) order by c.bucket_name
      ),
      '[]'::jsonb
    )
    into v_missing_buckets
    from public.sc_schema_contract_storage_buckets c
    where c.contract_version = v_version
      and c.required;
  else
    execute $query$
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'bucket', c.bucket_name,
            'operations', c.operations,
            'source_files', c.source_files
          ) order by c.bucket_name
        ),
        '[]'::jsonb
      )
      from public.sc_schema_contract_storage_buckets c
      where c.contract_version = $1
        and c.required
        and not exists (
          select 1
          from storage.buckets b
          where b.id = c.bucket_name
             or b.name = c.bucket_name
        )
    $query$ using v_version into v_missing_buckets;
  end if;

  select jsonb_build_object(
    'contract_relations', (select count(*) from public.sc_schema_contract_relations where contract_version = v_version and required),
    'contract_columns', (select count(*) from public.sc_schema_contract_columns where contract_version = v_version and required),
    'contract_functions', (select count(*) from public.sc_schema_contract_functions where contract_version = v_version and required),
    'contract_storage_buckets', (select count(*) from public.sc_schema_contract_storage_buckets where contract_version = v_version and required),
    'missing_relations', jsonb_array_length(v_missing_relations),
    'missing_columns', jsonb_array_length(v_missing_columns),
    'missing_functions', jsonb_array_length(v_missing_functions),
    'function_signature_mismatches', jsonb_array_length(v_signature_mismatches),
    'missing_storage_buckets', jsonb_array_length(v_missing_buckets)
  ) into v_counts;

  v_status := case
    when jsonb_array_length(v_missing_relations) = 0
     and jsonb_array_length(v_missing_columns) = 0
     and jsonb_array_length(v_missing_functions) = 0
     and jsonb_array_length(v_signature_mismatches) = 0
     and jsonb_array_length(v_missing_buckets) = 0
      then 'PASS'
    else 'REVIEW'
  end;

  return jsonb_build_object(
    'status', v_status,
    'contract_version', v_version,
    'generated_at', now(),
    'counts', v_counts,
    'missing_relations', v_missing_relations,
    'missing_columns', v_missing_columns,
    'missing_functions', v_missing_functions,
    'function_signature_mismatches', v_signature_mismatches,
    'missing_storage_buckets', v_missing_buckets,
    'important_note', 'Column and argument checks are source-derived. Review mismatches before creating or changing any production object.'
  );
end;
$$;

create or replace function public.sc_schema_snapshot_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_relations jsonb;
  v_columns jsonb;
  v_functions jsonb;
  v_constraints jsonb;
  v_indexes jsonb;
  v_policies jsonb;
  v_buckets jsonb := '[]'::jsonb;
  v_migrations jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'name', c.relname,
        'kind', case c.relkind
          when 'r' then 'table'
          when 'p' then 'partitioned_table'
          when 'v' then 'view'
          when 'm' then 'materialized_view'
          when 'f' then 'foreign_table'
          when 'S' then 'sequence'
          else c.relkind::text
        end,
        'row_security', c.relrowsecurity,
        'force_row_security', c.relforcerowsecurity
      ) order by n.nspname, c.relname
    ),
    '[]'::jsonb
  )
  into v_relations
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', table_schema,
        'relation', table_name,
        'column', column_name,
        'ordinal_position', ordinal_position,
        'data_type', data_type,
        'udt_name', udt_name,
        'nullable', is_nullable,
        'default', column_default
      ) order by table_schema, table_name, ordinal_position
    ),
    '[]'::jsonb
  )
  into v_columns
  from information_schema.columns
  where table_schema = 'public';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'name', p.proname,
        'identity_arguments', pg_get_function_identity_arguments(p.oid),
        'result', pg_get_function_result(p.oid),
        'language', l.lanname,
        'security_definer', p.prosecdef,
        'volatility', p.provolatile
      ) order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
    ),
    '[]'::jsonb
  )
  into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'relation', c.relname,
        'name', con.conname,
        'type', con.contype,
        'definition', pg_get_constraintdef(con.oid, true),
        'validated', con.convalidated
      ) order by n.nspname, c.relname, con.conname
    ),
    '[]'::jsonb
  )
  into v_constraints
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', schemaname,
        'relation', tablename,
        'name', indexname,
        'definition', indexdef
      ) order by schemaname, tablename, indexname
    ),
    '[]'::jsonb
  )
  into v_indexes
  from pg_indexes
  where schemaname = 'public';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', schemaname,
        'relation', tablename,
        'name', policyname,
        'permissive', permissive,
        'roles', roles,
        'command', cmd,
        'using', qual,
        'check', with_check
      ) order by schemaname, tablename, policyname
    ),
    '[]'::jsonb
  )
  into v_policies
  from pg_policies
  where schemaname = 'public';

  if to_regclass('storage.buckets') is not null then
    execute $query$
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'name', name,
            'public', public,
            'file_size_limit', file_size_limit,
            'allowed_mime_types', allowed_mime_types
          ) order by id
        ),
        '[]'::jsonb
      )
      from storage.buckets
    $query$ into v_buckets;
  end if;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute $query$
      select coalesce(
        jsonb_agg(
          jsonb_build_object('version', version)
          order by version
        ),
        '[]'::jsonb
      )
      from supabase_migrations.schema_migrations
    $query$ into v_migrations;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'relations', v_relations,
    'columns', v_columns,
    'functions', v_functions,
    'constraints', v_constraints,
    'indexes', v_indexes,
    'policies', v_policies,
    'storage_buckets', v_buckets,
    'migration_history', v_migrations
  );
end;
$$;

create or replace function public.sc_schema_fingerprint_v1()
returns text
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select md5(public.sc_schema_snapshot_v1()::text);
$$;

revoke all on function public.sc_schema_contract_report_v1(text) from public, anon;
revoke all on function public.sc_schema_snapshot_v1() from public, anon;
revoke all on function public.sc_schema_fingerprint_v1() from public, anon;
grant execute on function public.sc_schema_contract_report_v1(text) to authenticated;
grant execute on function public.sc_schema_snapshot_v1() to authenticated;
grant execute on function public.sc_schema_fingerprint_v1() to authenticated;

comment on function public.sc_schema_contract_report_v1(text) is
  'Compares the source-derived application contract to the current live schema without changing operational objects.';
comment on function public.sc_schema_snapshot_v1() is
  'Returns a normalized JSON snapshot of public schema metadata, policies, storage buckets, and migration history.';
comment on function public.sc_schema_fingerprint_v1() is
  'Returns an MD5 fingerprint of the normalized schema snapshot for drift detection; it is not a security hash.';

commit;
"""

    migration_103 = f"""
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
    '{version}',
    'No operational schema objects or rows were changed.'
  ),
  (
    '202607250102',
    'step_2',
    'Schema contract report, snapshot, and fingerprint helpers',
    '{version}',
    'Read-only introspection functions plus restricted grants.'
  ),
  (
    '202607250103',
    'step_2',
    'Application schema version ledger and Step 2 marker',
    '{version}',
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
"""

    def values_cte(rows: list[dict], tag: str) -> str:
        return f"with payload as (select {dollar_json(rows, tag)} as data), rows as (select item from payload, jsonb_array_elements(data) item)"

    preflight = f"""
-- Skilled Crafting Inventory Application
-- STEP 2 PRE-FLIGHT — READ ONLY AGAINST PRODUCTION OBJECTS
-- Temporary tables are session-scoped. No production data or schema is changed.

set statement_timeout = '180s';

create temporary table if not exists sc_step2_preflight_results (
  section text not null,
  object_name text not null,
  status text not null,
  details jsonb
) on commit preserve rows;

truncate table sc_step2_preflight_results;

insert into sc_step2_preflight_results(section, object_name, status, details)
select
  'step_1',
  'sc_inventory_model_registry',
  case when to_regclass('public.sc_inventory_model_registry') is null then 'STOP' else 'PASS' end,
  jsonb_build_object('message', 'Step 1 must be present before Step 2 migrations are installed');

{values_cte(relations_payload, 'preflight_relations')}
insert into sc_step2_preflight_results(section, object_name, status, details)
select
  'relation',
  concat(item->>'schema_name', '.', item->>'relation_name'),
  case
    when to_regclass(format('%I.%I', item->>'schema_name', item->>'relation_name')) is null
      then case when coalesce((item->>'required')::boolean, true) then 'REVIEW' else 'OPTIONAL_MISSING' end
    else 'PASS'
  end,
  jsonb_build_object(
    'required', coalesce((item->>'required')::boolean, true),
    'usage_scopes', coalesce(item->'usage_scopes', '[]'::jsonb),
    'source_files', coalesce(item->'source_files', '[]'::jsonb)
  )
from rows;

{values_cte(columns_payload, 'preflight_columns')}
insert into sc_step2_preflight_results(section, object_name, status, details)
select
  'column',
  concat(item->>'schema_name', '.', item->>'relation_name', '.', item->>'column_name'),
  case
    when to_regclass(format('%I.%I', item->>'schema_name', item->>'relation_name')) is null then 'RELATION_MISSING'
    when exists (
      select 1
      from information_schema.columns c
      where c.table_schema = item->>'schema_name'
        and c.table_name = item->>'relation_name'
        and c.column_name = item->>'column_name'
    ) then 'PASS'
    else 'REVIEW'
  end,
  jsonb_build_object(
    'required', coalesce((item->>'required')::boolean, true),
    'evidence_types', coalesce(item->'evidence_types', '[]'::jsonb),
    'source_files', coalesce(item->'source_files', '[]'::jsonb)
  )
from rows;

{values_cte(rpc_payload, 'preflight_functions')}
insert into sc_step2_preflight_results(section, object_name, status, details)
select
  'rpc',
  concat(item->>'schema_name', '.', item->>'function_name'),
  case
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = item->>'schema_name'
        and p.proname = item->>'function_name'
    ) then 'PASS'
    else case when coalesce((item->>'required')::boolean, true) then 'REVIEW' else 'OPTIONAL_MISSING' end
  end,
  jsonb_build_object(
    'required', coalesce((item->>'required')::boolean, true),
    'expected_argument_names', coalesce(item->'expected_argument_names', '[]'::jsonb),
    'source_files', coalesce(item->'source_files', '[]'::jsonb)
  )
from rows;

do $block$
declare
  r record;
  v_exists boolean;
begin
  for r in
    select item
    from jsonb_array_elements({dollar_json(bucket_payload, 'preflight_buckets')}) item
  loop
    if to_regclass('storage.buckets') is null then
      v_exists := false;
    else
      execute 'select exists(select 1 from storage.buckets where id = $1 or name = $1)'
      using r.item->>'bucket_name'
      into v_exists;
    end if;

    insert into sc_step2_preflight_results(section, object_name, status, details)
    values (
      'storage_bucket',
      r.item->>'bucket_name',
      case when v_exists then 'PASS' else 'REVIEW' end,
      jsonb_build_object(
        'required', coalesce((r.item->>'required')::boolean, true),
        'operations', coalesce(r.item->'operations', '[]'::jsonb),
        'source_files', coalesce(r.item->'source_files', '[]'::jsonb)
      )
    );
  end loop;
end
$block$;

insert into sc_step2_preflight_results(section, object_name, status, details)
select
  'migration_history',
  'supabase_migrations.schema_migrations',
  case when to_regclass('supabase_migrations.schema_migrations') is null then 'REVIEW' else 'PASS' end,
  jsonb_build_object(
    'message', 'Use Supabase migration list before marking manually applied Step 1 migrations as applied.'
  );

select
  section,
  status,
  count(*) as object_count
from sc_step2_preflight_results
group by section, status
order by section, status;

select section, object_name, status, details
from sc_step2_preflight_results
where status not in ('PASS', 'OPTIONAL_MISSING')
order by section, object_name;

select
  case
    when exists (select 1 from sc_step2_preflight_results where status = 'STOP') then 'STOP'
    when exists (select 1 from sc_step2_preflight_results where status = 'REVIEW') then 'REVIEW_BEFORE_INSTALL'
    else 'READY_FOR_STEP_2_METADATA_MIGRATIONS'
  end as overall_preflight_status;
"""

    post_install = f"""
-- Skilled Crafting Inventory Application
-- STEP 2 POST-INSTALL VERIFICATION — READ ONLY

select public.sc_schema_contract_report_v1('{version}') as application_schema_contract_report;

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
where contract_version = '{version}';

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
"""

    test_sql = f"""
-- Local/staging smoke test for Step 2 metadata objects.
-- Do not run this as a destructive production reset. It performs assertions only.

do $$
declare
  v_report jsonb;
begin
  if to_regclass('public.sc_schema_contract_versions') is null then
    raise exception 'Missing sc_schema_contract_versions';
  end if;
  if to_regprocedure('public.sc_schema_contract_report_v1(text)') is null then
    raise exception 'Missing sc_schema_contract_report_v1(text)';
  end if;
  if to_regprocedure('public.sc_schema_snapshot_v1()') is null then
    raise exception 'Missing sc_schema_snapshot_v1()';
  end if;
  if to_regprocedure('public.sc_schema_fingerprint_v1()') is null then
    raise exception 'Missing sc_schema_fingerprint_v1()';
  end if;

  v_report := public.sc_schema_contract_report_v1('{version}');
  if v_report->>'contract_version' <> '{version}' then
    raise exception 'Unexpected contract version: %', v_report->>'contract_version';
  end if;
end $$;

select public.sc_schema_contract_report_v1('{version}');
"""

    rollback = f"""
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
where contract_version = '{version}';

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
"""

    write(MIGRATIONS / "202607250101_step2_schema_contract_registry.sql", migration_101)
    write(MIGRATIONS / "202607250102_step2_schema_introspection_helpers.sql", migration_102)
    write(MIGRATIONS / "202607250103_step2_schema_version_marker.sql", migration_103)
    write(VERIFICATION / "000_step2_preflight_read_only.sql", preflight)
    write(VERIFICATION / "900_step2_post_install_verification.sql", post_install)
    write(TESTS / "001_step2_contract_smoke.sql", test_sql)
    write(ROOT / "supabase" / "rollback" / "202607250101_step2_limited_rollback.sql", rollback)

    print("Generated Step 2 SQL files")


if __name__ == "__main__":
    main()
