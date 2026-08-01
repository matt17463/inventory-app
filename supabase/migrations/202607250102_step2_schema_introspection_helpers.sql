
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
