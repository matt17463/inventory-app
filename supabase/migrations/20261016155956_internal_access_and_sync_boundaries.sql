-- Preserve the previous definitions inside the database, never in an exposed API
-- schema or a source-code export (legacy definitions can contain credentials).
create schema if not exists sc_maintenance;
revoke all on schema sc_maintenance from public, anon, authenticated;
create table if not exists sc_maintenance.access_baseline_20261016 (
  object_type text not null, identity text not null, definition text, acl aclitem[], authenticated_execute boolean,
  captured_at timestamptz not null default now(), primary key(object_type, identity)
);
alter table sc_maintenance.access_baseline_20261016 enable row level security;
insert into sc_maintenance.access_baseline_20261016(object_type, identity, definition, acl, authenticated_execute)
select 'function', p.oid::regprocedure::text, pg_get_functiondef(p.oid), p.proacl, has_function_privilege('authenticated',p.oid,'execute')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
on conflict do nothing;
insert into sc_maintenance.access_baseline_20261016(object_type, identity, definition, acl)
select 'relation', c.oid::regclass::text, coalesce(array_to_string(c.reloptions, ','),''), c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m','S')
on conflict do nothing;

-- Access comes from the live employee-role record, so deactivation takes effect
-- immediately rather than waiting for a browser's JWT to expire.
create or replace function public.sc_internal_access_allowed(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when current_setting('request.jwt.claim.role', true) = 'service_role'
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role','') = 'service_role'
      then true
    when session_user in ('postgres','supabase_admin')
      and coalesce(current_setting('role', true),'none') not in ('anon','authenticated') then true
    else coalesce(public.sc_current_app_role() = any(p_roles), false)
  end
$$;
revoke all on function public.sc_internal_access_allowed(text[]) from public, anon;
grant execute on function public.sc_internal_access_allowed(text[]) to authenticated, service_role;
create or replace function public.sc_require_internal_access(p_roles text[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.sc_internal_access_allowed(p_roles) then
    raise exception 'An active employee role with permission for this action is required.' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.sc_require_internal_access(text[]) from public, anon;
grant execute on function public.sc_require_internal_access(text[]) to authenticated, service_role;

-- Public customer links are the only anonymous database API. Forms and mockup
-- reviews already use validated server endpoints. Keep service integrations.
revoke create on schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.sc_customer_portal_data_v2(text) to anon, authenticated, service_role;
-- The compatibility endpoint delegates to the field-limited current contract.
create or replace function public.phase6_customer_portal_data(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.sc_customer_portal_data_v2(p_token)
$$;
revoke all on function public.phase6_customer_portal_data(text) from public;
grant execute on function public.phase6_customer_portal_data(text) to anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter view public.purchasing_demand_sources_v1 set (security_invoker = true);

-- Layer restrictive policies over the existing row/ownership policies. These
-- cannot accidentally broaden access to a table with no permissive policy.
do $policies$
declare r record; v_write text; v_read text;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname <> 'sc_app_user_roles'
      and exists(select 1 from pg_policy p where p.polrelid=c.oid)
  loop
    if r.relname ~ '(backup|^backup_)' then
      execute format('revoke all on public.%I from authenticated',r.relname);
      continue;
    end if;
    v_read := 'public.sc_internal_access_allowed(array[''admin'',''manager'',''operator'',''viewer''])';
    v_write := 'public.sc_internal_access_allowed(array[''admin'',''manager'',''operator''])';
    if r.relname in ('brands','product_types','colors','sizes','logos','customers','suppliers',
      'sc_app_settings','sc_pricing_rules','phase5_pricing_rules','non_inventory_product_rules',
      'sc_non_inventory_product_rules','sc_color_pairing_rules','product_sku_mappings',
      'sc_product_blank_mappings','product_mapping_exclusions','supplier_catalog_feeds',
      'sc_integration_security_registry','sc_customer_portal_tokens','sc_customer_portal_events') then
      v_write := 'public.sc_internal_access_allowed(array[''admin'',''manager''])';
    end if;
    execute format('create policy sc_active_employee_read on public.%I as restrictive for select to authenticated using ((select %s))',r.relname,v_read);
    execute format('create policy sc_active_employee_insert on public.%I as restrictive for insert to authenticated with check ((select %s))',r.relname,v_write);
    execute format('create policy sc_active_employee_update on public.%I as restrictive for update to authenticated using ((select %s)) with check ((select %s))',r.relname,v_write,v_write);
    execute format('create policy sc_active_employee_delete on public.%I as restrictive for delete to authenticated using ((select %s))',r.relname,v_write);
    execute format('revoke truncate, references, trigger on public.%I from authenticated',r.relname);
  end loop;
end
$policies$;

-- Move privileged implementations behind an unexposed schema. Public entry
-- points check the employee role before calling the unchanged implementation.
-- This avoids rewriting legacy business logic or its exception handlers.
create schema sc_internal;
revoke all on schema sc_internal from public, anon, authenticated;
grant usage on schema sc_internal to service_role;
create temp table sc_views_to_rebind on commit drop as
select distinct v.oid::regclass::text name, pg_get_viewdef(v.oid,true) definition
from pg_depend d join pg_rewrite rw on rw.oid=d.objid
join pg_class v on v.oid=rw.ev_class join pg_proc p on d.refobjid=p.oid
join pg_namespace n on n.oid=p.pronamespace
where d.classid='pg_rewrite'::regclass and d.refclassid='pg_proc'::regclass
  and p.prosecdef and n.nspname='public';
create table sc_maintenance.rpc_access_20261016 (
  signature text primary key, allowed_roles text[] not null
);
alter table sc_maintenance.rpc_access_20261016 enable row level security;
do $guard_functions$
declare r record; v_def text; v_body text; v_roles text[]; v_args text; v_name text; v_signature text; v_authenticated boolean;
begin
  for r in select p.*, l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and p.proname not in ('sc_current_app_role','sc_mockup_active_employee',
        'sc_internal_access_allowed','sc_customer_portal_data_v2','phase6_customer_portal_data')
      and p.proname not like 'sc_contractor_%'
  loop
    v_name := r.proname;
    -- Reads include viewers. Writes require a working employee; catalog-wide,
    -- destructive and configuration repairs require a manager.
    v_roles := array['admin','manager','operator'];
    if r.lanname='sql' or v_name in (
      'phase5_get_shop_tv','phase5_get_command_center','phase6_exception_center',
      'sc_shop_touch_mode_v2','sc_activity_feed_for_pullsheet','sc_mpr_source_products',
      'sc_ui_operational_summary','sc_home_dashboard_stats','sc_home_count_low_stock_items',
      'sc_home_count_open_pull_sheets','sc_home_dashboard_debug_counts',
      'sc_resolve_blank_product_v1','sc_preview_blank_substitution_v1',
      'sc_receiving_bins_v4','sc_receiving_v4_diagnostics','sc_preview_new_product_line_v1',
      'sc_debug_pullsheet_activity_filter','sc_manual_lookup_display',
      'sc_manual_invoice_order_received_quantity','sc_manual_invoice_active_reservation_count',
      'sc_purchasing_suggested_item_preview_v1','sc_list_order_status_board',
      'sc_preview_void_manual_invoice_order','sc_operations_home_inventory_stats_debug',
      'sc_purchasing_recommendation_stats_debug_v1','sc_inventory_model_health_v1',
      'sc_preview_blank_product_v1','sc_product_resolution_evidence_v1'
    ) then v_roles := array['admin','manager','operator','viewer']; end if;
    if r.prosrc !~* '\m(insert|update|delete|truncate|execute)\M'
      and v_name ~* '(^search_|^phase[0-9]+_get_|^sc_(get_|list_|search_|preview_|home_|ui_|activity_feed|debug_|existing_|receiving_bins|receiving_v[0-9]+_diagnostics|resolve_|manual_invoice_blank_display|manual_invoice_blank_receipt_summary|manual_invoice_order_received_quantity|manual_invoice_active_reservation_count|manual_lookup_display|canonical_color|ppi_pending|inventory_.*(health|diagnostics)|.*_(diagnostics|summary|counts|health|snapshot|fingerprint|report)_v?[0-9]*$|blank_product_(candidates|reference)|product_blank_mapping_issues|catalog_reconciliation|valid_inventory|stale_inventory|storage_bucket|color_lifecycle))' then
      v_roles := array['admin','manager','operator','viewer'];
    end if;
    if v_name ~* '(bulk_undo|undo_activity|replace_blank_product_master|^repair_product|^exclude_|^create_missing_blank|^append_blank_products|^import_supplier|^wcsb_|^sc_(apply_color|save_color|disable_color|upsert_|set_non_inventory|save_non_inventory|mapping_repair|backfill_|apply_bulk_pairing|apply_blank_substitution|apply_new_product_line|apply_product_resolution|clear_supplier|update_product_review|set_product_blank_mapping|schema_|storage_bucket|integration_))' then
      v_roles := array['admin','manager'];
    end if;
    -- Scalar SQL aliases can call a write routine despite containing SELECT.
    if v_name in ('receive_blank_inventory','release_inventory_reservation',
      'mark_sc_artwork_system_request','mark_sc_artwork_system_reorder') then
      v_roles := array['admin','manager','operator'];
    end if;
    v_signature := r.oid::regprocedure::text;
    select authenticated_execute into v_authenticated
      from sc_maintenance.access_baseline_20261016
      where object_type='function' and identity=v_signature;
    -- These endpoints have always been server-only, even for active employees.
    if not coalesce(v_authenticated,false)
      or v_name in ('sc_mockup_apply_customer_review','sc_sync_woocommerce_order_status') then
      v_roles := '{}'::text[];
      v_authenticated := false;
    end if;
    v_def := pg_get_functiondef(r.oid);
    if position('AS $function$' in v_def)=0 then raise exception 'Unexpected function delimiter: %', r.oid::regprocedure; end if;
    v_def := split_part(v_def,'AS $function$',1);
    v_def := replace(v_def,'LANGUAGE sql','LANGUAGE plpgsql');
    select coalesce(string_agg('$'||i::text,',' order by i),'') into v_args
      from generate_series(1,r.pronargs) i;
    if r.proretset then
      v_body := format('RETURN QUERY SELECT * FROM sc_internal.%I(%s);',v_name,v_args);
    elsif r.prorettype='void'::regtype then
      v_body := format('PERFORM sc_internal.%I(%s); RETURN;',v_name,v_args);
    else
      v_body := format('RETURN sc_internal.%I(%s);',v_name,v_args);
    end if;
    execute format('alter function %s set schema sc_internal',v_signature);
    execute format('revoke all on function %s from public, anon, authenticated',r.oid::regprocedure);
    execute v_def || 'AS $function$ BEGIN ' ||
      format('PERFORM public.sc_require_internal_access(%L::text[]); ',v_roles) ||
      v_body || ' END; $function$';
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated',v_name,oidvectortypes(r.proargtypes));
    execute format('grant execute on function public.%I(%s) to service_role',v_name,oidvectortypes(r.proargtypes));
    if v_authenticated then
      execute format('grant execute on function public.%I(%s) to authenticated',v_name,oidvectortypes(r.proargtypes));
    end if;
    insert into sc_maintenance.rpc_access_20261016 values(v_signature,v_roles);
  end loop;
  for r in select * from sc_views_to_rebind loop
    execute 'create or replace view ' || r.name || ' with (security_invoker=true) as ' || r.definition;
  end loop;
  -- Legacy bodies use unqualified application/extension names. Prevent schema
  -- creation above, pin these trusted schemas, and put pg_temp last.
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','sc_internal') and p.prokind='f'
      and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
  loop execute format('alter function %s set search_path = pg_catalog, public, extensions, pg_temp',r.oid::regprocedure); end loop;
end
$guard_functions$;

notify pgrst, 'reload schema';
