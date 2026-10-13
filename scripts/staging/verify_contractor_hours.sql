-- Read-only staging verification for Contractor Hours.
-- Run in the Supabase SQL editor of a dedicated STAGING project after applying
-- supabase/migrations/202610120001_contractor_hours.sql there.
-- Nothing in this script mutates data, roles or schema.
begin transaction read only;

do $$
declare
  v_table text;
  v_function text;
  v_function_oid oid;
  v_rls bool;
  v_policy_count integer;
  v_trigger_count integer;
  v_index_count integer;
  v_read_tables text[] := array[
    'sc_contractors',
    'sc_contractor_time_entries',
    'sc_contractor_hourly_rates',
    'sc_contractor_time_audit',
    'sc_contractor_rate_audit'
  ];
  v_rpcs text[] := array[
    'public.sc_contractor_initialize()',
    'public.sc_contractor_register(text,text)',
    'public.sc_contractor_set_rate(uuid,date,numeric)',
    'public.sc_contractor_record_manual(date,numeric,text,text,uuid)',
    'public.sc_contractor_clock_in(text,text)',
    'public.sc_contractor_clock_out()',
    'public.sc_contractor_edit_manual(uuid,date,numeric,text,text)',
    'public.sc_contractor_review(uuid,text)',
    'public.sc_contractor_void(uuid,text)',
    'public.sc_contractor_resolve_open(uuid,numeric,text)'
  ];
begin
  if to_regclass('public.sc_app_user_roles') is null
     or to_regprocedure('public.sc_current_app_role()') is null then
    raise exception 'Staging lacks the prerequisite application roles migration';
  end if;

  foreach v_table in array v_read_tables loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Missing expected contractor table %', v_table;
    end if;
    select c.relrowsecurity into v_rls
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname=v_table;
    if v_rls is distinct from true then
      raise exception 'RLS is not enabled on %', v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'SELECT') or
       has_table_privilege('authenticated', 'public.' || v_table, 'INSERT') or
       has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE') or
       has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') then
      raise exception 'Table privileges are too broad on %', v_table;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.sc_contractor_time_entries', 'SELECT') then
    raise exception 'Authenticated contractors lack authorized time read access';
  end if;
  if not has_table_privilege('authenticated', 'public.sc_contractor_hourly_rates', 'SELECT') then
    raise exception 'Manager rate-reading policy cannot take effect';
  end if;

  select count(*) into v_policy_count from pg_catalog.pg_policies
    where schemaname = 'public'
      and (tablename = 'sc_contractor_time_entries' and policyname = 'sc_contractor_entries_select'
        or tablename = 'sc_contractor_hourly_rates' and policyname = 'sc_contractor_rates_select'
        or tablename = 'sc_contractors' and policyname = 'sc_contractors_select')
      and cmd = 'SELECT' and roles @> array['authenticated']::name[];
  if v_policy_count <> 3 then
    raise exception 'Missing SELECT-only contractor policies; expected 3, found %', v_policy_count;
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any(v_read_tables)
      and cmd in ('INSERT','UPDATE','DELETE','ALL')
  ) then
    raise exception 'Unexpected contractor DML policy: direct writes should be prohibited';
  end if;

  foreach v_function in array v_rpcs loop
    v_function_oid := to_regprocedure(v_function);
    if v_function_oid is null then
      raise exception 'Missing contractor RPC %', v_function;
    end if;
    if not has_function_privilege('authenticated',v_function_oid,'EXECUTE')
       or has_function_privilege('anon',v_function_oid,'EXECUTE') then
      raise exception 'Unsafe RPC grants for %', v_function;
    end if;
    if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_function_oid) then
      raise exception 'RPC must be SECURITY DEFINER: %', v_function;
    end if;
  end loop;

  select count(*) into v_trigger_count
    from pg_catalog.pg_trigger
    where tgrelid in (
      'public.sc_contractor_time_entries'::regclass,
      'public.sc_contractor_hourly_rates'::regclass
    )
      and tgname in ('sc_contractor_time_audit_trigger','sc_contractor_rate_audit_trigger')
      and tgenabled in ('O','A');
  if v_trigger_count <> 2 then
    raise exception 'Required audit triggers missing (found %/2)', v_trigger_count;
  end if;

  select count(*) into v_index_count from pg_catalog.pg_indexes
    where schemaname = 'public' and tablename = 'sc_contractor_time_entries'
      and indexname = 'sc_contractor_one_open_shift'
      and indexdef ilike '%unique index%';
  if v_index_count <> 1 then
    raise exception 'Missing unique index preventing simultaneous clock-in sessions';
  end if;

  raise notice 'PASS: Contractor tables, RLS, grants, policies, RPCs, audit triggers, and unique shift index';
end $$;

rollback;
