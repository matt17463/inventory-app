-- Skilled Crafting Inventory v1.0.0
-- Application Integrity Platform
--
-- ADDITIVE / NON-DESTRUCTIVE:
--   * does not merge, delete, rename, archive, or rewrite existing products;
--   * does not change inventory quantities or historical inventory movements;
--   * creates review, job, workflow, audit, and identity-memory tables;
--   * adds service-role-only guarded mutation functions for core records.
--
-- Run after deployment/sql/27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql.

begin;

create extension if not exists pgcrypto;

create table if not exists public.sc_product_identity_aliases (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  alias_type text not null check (alias_type in ('supplier_sku','sku','barcode','brand','style','color','size')),
  source_value text not null,
  source_value_norm text not null,
  context_brand_norm text not null default '',
  context_style_norm text not null default '',
  canonical_blank_product_id_text text,
  canonical_lookup_type text,
  canonical_lookup_id_text text,
  canonical_label text,
  confidence numeric(5,2) not null default 100,
  status text not null default 'active' check (status in ('active','review','archived')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, alias_type, source_value_norm, context_brand_norm, context_style_norm)
);

create index if not exists ix_sc_product_identity_aliases_product
  on public.sc_product_identity_aliases(canonical_blank_product_id_text)
  where canonical_blank_product_id_text is not null and status = 'active';

create table if not exists public.sc_product_review_cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null check (case_type in ('duplicate_product','duplicate_lookup','ambiguous_identity','creation_conflict')),
  status text not null default 'open' check (status in ('open','reviewing','approved','rejected','completed','cancelled')),
  title text not null,
  reason text,
  candidate_group text,
  proposed_survivor_id_text text,
  resolution_notes text,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.sc_product_review_case_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.sc_product_review_cases(id) on delete cascade,
  entity_type text not null,
  entity_id_text text not null,
  proposed_role text check (proposed_role in ('survivor','duplicate','reference','unknown')),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(case_id, entity_type, entity_id_text)
);

create table if not exists public.sc_product_change_previews (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('create_blank','update_blank','merge_review')),
  status text not null default 'draft' check (status in ('draft','approved','applied','expired','cancelled')),
  requested_payload jsonb not null default '{}'::jsonb,
  resolution jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  applied_at timestamptz
);

create table if not exists public.sc_integration_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  source_system text,
  external_reference text,
  status text not null default 'queued' check (status in ('queued','running','waiting_review','completed','failed','cancelled')),
  progress_current integer not null default 0,
  progress_total integer not null default 0,
  attempt_count integer not null default 0,
  idempotency_key text,
  input_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_sc_integration_jobs_idempotency
  on public.sc_integration_jobs(idempotency_key)
  where idempotency_key is not null;

create table if not exists public.sc_integration_job_events (
  id bigserial primary key,
  job_id uuid not null references public.sc_integration_jobs(id) on delete cascade,
  event_type text not null,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sc_team_store_workflows (
  id uuid primary key default gen_random_uuid(),
  workflow_name text not null,
  customer_name text,
  store_name text,
  stage text not null default 'request' check (stage in ('request','artwork','mockups','approval','woocommerce_draft','ready_to_publish','live','on_hold','complete')),
  status text not null default 'active' check (status in ('active','on_hold','complete','cancelled')),
  artwork_request_reference text,
  mockup_project_id_text text,
  woo_product_ids jsonb not null default '[]'::jsonb,
  due_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sc_core_mutation_audit (
  id bigserial primary key,
  action text not null,
  entity_type text not null,
  entity_id_text text,
  actor_user_id uuid references auth.users(id) on delete set null,
  before_snapshot jsonb,
  after_snapshot jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.sc_product_identity_aliases enable row level security;
alter table public.sc_product_review_cases enable row level security;
alter table public.sc_product_review_case_items enable row level security;
alter table public.sc_product_change_previews enable row level security;
alter table public.sc_integration_jobs enable row level security;
alter table public.sc_integration_job_events enable row level security;
alter table public.sc_team_store_workflows enable row level security;
alter table public.sc_core_mutation_audit enable row level security;

revoke all on public.sc_product_identity_aliases, public.sc_product_review_cases,
  public.sc_product_review_case_items, public.sc_product_change_previews,
  public.sc_integration_jobs, public.sc_integration_job_events,
  public.sc_team_store_workflows, public.sc_core_mutation_audit
from public, anon, authenticated;

grant select, insert, update on public.sc_product_identity_aliases, public.sc_product_review_cases,
  public.sc_product_review_case_items, public.sc_product_change_previews,
  public.sc_integration_jobs, public.sc_integration_job_events,
  public.sc_team_store_workflows, public.sc_core_mutation_audit
to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.sc_blank_product_candidates_v1(
  p_source_system text default '',
  p_supplier_sku text default '',
  p_sku text default '',
  p_barcode text default '',
  p_brand text default '',
  p_style text default '',
  p_color text default '',
  p_size text default '',
  p_limit integer default 25
)
returns table (
  blank_product_id_text text,
  sku_base text,
  barcode text,
  product_name text,
  brand text,
  style text,
  color text,
  size text,
  match_method text,
  confidence integer
)
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select
      public.sc_identity_norm_v1(p_supplier_sku) supplier_norm,
      public.sc_identity_norm_v1(p_sku) sku_norm,
      public.sc_identity_norm_v1(p_barcode) barcode_norm,
      public.sc_identity_norm_v1(p_brand) brand_norm,
      public.sc_identity_norm_v1(p_style) style_norm,
      public.sc_identity_norm_v1(p_color) color_norm,
      public.sc_identity_norm_v1(p_size) size_norm
  ), aliases as (
    select distinct a.canonical_blank_product_id_text
    from public.sc_product_identity_aliases a, input i
    where a.status = 'active'
      and a.alias_type = 'supplier_sku'
      and public.sc_identity_norm_v1(a.source_system) = public.sc_identity_norm_v1(p_source_system)
      and a.source_value_norm = i.supplier_norm
      and i.supplier_norm <> ''
  ), base as (
    select
      bp.id::text as id_text,
      bp.sku_base::text,
      bp.barcode::text,
      bp.name::text as product_name,
      b.name::text as brand,
      pt.name::text as style,
      c.name::text as color,
      s.name::text as size,
      case
        when a.canonical_blank_product_id_text is not null then 'remembered_supplier_sku'
        when i.barcode_norm <> '' and public.sc_identity_norm_v1(bp.barcode::text) = i.barcode_norm then 'exact_barcode'
        when i.sku_norm <> '' and public.sc_identity_norm_v1(bp.sku_base::text) = i.sku_norm then 'exact_sku'
        when i.brand_norm <> '' and i.style_norm <> '' and i.color_norm <> '' and i.size_norm <> ''
          and public.sc_identity_norm_v1(b.name::text) = i.brand_norm
          and public.sc_identity_norm_v1(pt.name::text) = i.style_norm
          and public.sc_identity_norm_v1(c.name::text) = i.color_norm
          and public.sc_identity_norm_v1(s.name::text) = i.size_norm then 'exact_identity'
        else 'partial_identity'
      end as method,
      case
        when a.canonical_blank_product_id_text is not null then 100
        when i.barcode_norm <> '' and public.sc_identity_norm_v1(bp.barcode::text) = i.barcode_norm then 99
        when i.sku_norm <> '' and public.sc_identity_norm_v1(bp.sku_base::text) = i.sku_norm then 98
        when i.brand_norm <> '' and i.style_norm <> '' and i.color_norm <> '' and i.size_norm <> ''
          and public.sc_identity_norm_v1(b.name::text) = i.brand_norm
          and public.sc_identity_norm_v1(pt.name::text) = i.style_norm
          and public.sc_identity_norm_v1(c.name::text) = i.color_norm
          and public.sc_identity_norm_v1(s.name::text) = i.size_norm then 95
        else
          (case when i.brand_norm <> '' and public.sc_identity_norm_v1(b.name::text) = i.brand_norm then 15 else 0 end) +
          (case when i.style_norm <> '' and public.sc_identity_norm_v1(pt.name::text) = i.style_norm then 25 else 0 end) +
          (case when i.color_norm <> '' and public.sc_identity_norm_v1(c.name::text) = i.color_norm then 15 else 0 end) +
          (case when i.size_norm <> '' and public.sc_identity_norm_v1(s.name::text) = i.size_norm then 15 else 0 end)
      end as score
    from public.blank_products bp
    left join public.brands b on b.id = bp.brand_id
    left join public.product_types pt on pt.id = bp.product_type_id
    left join public.colors c on c.id = bp.color_id
    left join public.sizes s on s.id = bp.size_id
    cross join input i
    left join aliases a on a.canonical_blank_product_id_text = bp.id::text
  )
  select id_text, sku_base, barcode, product_name, brand, style, color, size, method, score
  from base
  where score >= 40
  order by score desc, sku_base
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

create or replace function public.sc_preview_blank_product_v1(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_candidates jsonb;
  v_exact_count integer;
begin
  select coalesce(jsonb_agg(to_jsonb(c) order by c.confidence desc), '[]'::jsonb),
         count(*) filter (where c.confidence >= 95)
  into v_candidates, v_exact_count
  from public.sc_blank_product_candidates_v1(
    coalesce(p_payload->>'source_system',''), coalesce(p_payload->>'supplier_sku',''),
    coalesce(p_payload->>'sku_base',''), coalesce(p_payload->>'barcode',''),
    coalesce(p_payload->>'brand',''), coalesce(p_payload->>'style',''),
    coalesce(p_payload->>'color',''), coalesce(p_payload->>'size',''), 25
  ) c;

  return jsonb_build_object(
    'decision', case when v_exact_count = 0 then 'create_allowed' when v_exact_count = 1 then 'use_existing' else 'ambiguous' end,
    'exact_candidate_count', v_exact_count,
    'candidates', v_candidates,
    'requested', coalesce(p_payload, '{}'::jsonb),
    'rule', 'Only one deterministic match may be selected automatically. Ambiguous matches require review.'
  );
end;
$$;

create or replace function public.sc_create_blank_product_safe_v1(p_payload jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview jsonb;
  v_row public.blank_products%rowtype;
  v_key text;
begin
  v_key := public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base',''));
  if v_key = '' or trim(coalesce(p_payload->>'name','')) = '' then
    raise exception 'SKU and product name are required.';
  end if;
  perform pg_advisory_xact_lock(hashtext('sc-blank:' || v_key));
  v_preview := public.sc_preview_blank_product_v1(p_payload);
  if v_preview->>'decision' <> 'create_allowed' then
    return jsonb_build_object('success', false, 'blocked', true, 'preview', v_preview);
  end if;

  insert into public.blank_products (
    sku_base, name, barcode, brand_id, product_type_id, color_id, size_id,
    image_url, unit_cost, low_stock_threshold
  ) values (
    upper(trim(p_payload->>'sku_base')), trim(p_payload->>'name'), nullif(trim(p_payload->>'barcode'), ''),
    nullif(p_payload->>'brand_id','')::bigint, nullif(p_payload->>'product_type_id','')::bigint,
    nullif(p_payload->>'color_id','')::bigint, nullif(p_payload->>'size_id','')::bigint,
    nullif(trim(p_payload->>'image_url'), ''), nullif(p_payload->>'unit_cost','')::numeric,
    nullif(p_payload->>'low_stock_threshold','')::integer
  ) returning * into v_row;

  insert into public.sc_core_mutation_audit(action, entity_type, entity_id_text, actor_user_id, after_snapshot, reason)
  values ('create', 'blank_product', v_row.id::text, p_actor, to_jsonb(v_row), 'Guarded product creation');

  return jsonb_build_object('success', true, 'created', true, 'blank', to_jsonb(v_row), 'preview', v_preview);
end;
$$;

create or replace function public.sc_update_blank_product_safe_v1(p_blank_product_id bigint, p_payload jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.blank_products%rowtype;
  v_after public.blank_products%rowtype;
  v_conflict bigint;
begin
  select * into v_before from public.blank_products where id = p_blank_product_id for update;
  if not found then raise exception 'Blank product % was not found.', p_blank_product_id; end if;

  select bp.id into v_conflict
  from public.blank_products bp
  where bp.id <> p_blank_product_id
    and (
      (public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base', v_before.sku_base::text)) <> '' and
       public.sc_identity_norm_v1(bp.sku_base::text) = public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base', v_before.sku_base::text)))
      or
      (public.sc_identity_norm_v1(coalesce(p_payload->>'barcode', v_before.barcode::text)) <> '' and
       public.sc_identity_norm_v1(bp.barcode::text) = public.sc_identity_norm_v1(coalesce(p_payload->>'barcode', v_before.barcode::text)))
      or
      (bp.brand_id = coalesce(nullif(p_payload->>'brand_id','')::bigint, v_before.brand_id)
       and bp.product_type_id = coalesce(nullif(p_payload->>'product_type_id','')::bigint, v_before.product_type_id)
       and bp.color_id = coalesce(nullif(p_payload->>'color_id','')::bigint, v_before.color_id)
       and bp.size_id = coalesce(nullif(p_payload->>'size_id','')::bigint, v_before.size_id))
    ) limit 1;

  if v_conflict is not null then
    return jsonb_build_object('success', false, 'blocked', true, 'conflicting_blank_product_id', v_conflict,
      'message', 'This edit would create a duplicate SKU, barcode, or complete product identity.');
  end if;

  update public.blank_products set
    sku_base = upper(trim(coalesce(p_payload->>'sku_base', v_before.sku_base::text))),
    name = trim(coalesce(p_payload->>'name', v_before.name::text)),
    barcode = case when p_payload ? 'barcode' then nullif(trim(p_payload->>'barcode'),'') else v_before.barcode end,
    brand_id = case when p_payload ? 'brand_id' then nullif(p_payload->>'brand_id','')::bigint else v_before.brand_id end,
    product_type_id = case when p_payload ? 'product_type_id' then nullif(p_payload->>'product_type_id','')::bigint else v_before.product_type_id end,
    color_id = case when p_payload ? 'color_id' then nullif(p_payload->>'color_id','')::bigint else v_before.color_id end,
    size_id = case when p_payload ? 'size_id' then nullif(p_payload->>'size_id','')::bigint else v_before.size_id end,
    image_url = case when p_payload ? 'image_url' then nullif(trim(p_payload->>'image_url'),'') else v_before.image_url end,
    unit_cost = case when p_payload ? 'unit_cost' then nullif(p_payload->>'unit_cost','')::numeric else v_before.unit_cost end,
    low_stock_threshold = case when p_payload ? 'low_stock_threshold' then nullif(p_payload->>'low_stock_threshold','')::integer else v_before.low_stock_threshold end
  where id = p_blank_product_id returning * into v_after;

  insert into public.sc_core_mutation_audit(action, entity_type, entity_id_text, actor_user_id, before_snapshot, after_snapshot, reason)
  values ('update', 'blank_product', p_blank_product_id::text, p_actor, to_jsonb(v_before), to_jsonb(v_after), 'Guarded product update');
  return jsonb_build_object('success', true, 'blank', to_jsonb(v_after));
end;
$$;

create or replace function public.sc_set_job_status_safe_v1(p_job_id bigint, p_status text, p_actor uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before public.jobs%rowtype; v_after public.jobs%rowtype;
begin
  if trim(coalesce(p_status,'')) not in ('draft','queued','ready_to_pull','reserved','waiting_on_blanks','ready_to_produce','pulled','in_production','qc','ready_to_ship','production_complete','completed','on_hold','needs_attention','cancelled','voided') then
    raise exception 'Unsupported job status: %', p_status;
  end if;
  select * into v_before from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job % was not found.', p_job_id; end if;
  update public.jobs set status = trim(p_status) where id = p_job_id returning * into v_after;
  insert into public.sc_core_mutation_audit(action, entity_type, entity_id_text, actor_user_id, before_snapshot, after_snapshot, reason)
  values ('status_change','job',p_job_id::text,p_actor,to_jsonb(v_before),to_jsonb(v_after),coalesce(p_reason,'Guarded job status update'));
  return to_jsonb(v_after);
end; $$;

create or replace function public.sc_set_job_item_status_safe_v1(p_job_item_id bigint, p_status text, p_actor uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before public.job_items%rowtype; v_after public.job_items%rowtype;
begin
  if trim(coalesce(p_status,'')) not in ('draft','queued','ready_to_pull','reserved','waiting_on_blanks','ready_to_produce','pulled','in_production','qc','ready_to_ship','production_complete','completed','on_hold','needs_attention','cancelled','voided') then
    raise exception 'Unsupported line status: %', p_status;
  end if;
  select * into v_before from public.job_items where id = p_job_item_id for update;
  if not found then raise exception 'Job item % was not found.', p_job_item_id; end if;
  update public.job_items set status = trim(p_status) where id = p_job_item_id returning * into v_after;
  insert into public.sc_core_mutation_audit(action, entity_type, entity_id_text, actor_user_id, before_snapshot, after_snapshot, reason)
  values ('status_change','job_item',p_job_item_id::text,p_actor,to_jsonb(v_before),to_jsonb(v_after),coalesce(p_reason,'Guarded job item status update'));
  return to_jsonb(v_after);
end; $$;

revoke all on function public.sc_blank_product_candidates_v1(text,text,text,text,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.sc_preview_blank_product_v1(jsonb) from public, anon, authenticated;
revoke all on function public.sc_create_blank_product_safe_v1(jsonb,uuid) from public, anon, authenticated;
revoke all on function public.sc_update_blank_product_safe_v1(bigint,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.sc_set_job_status_safe_v1(bigint,text,uuid,text) from public, anon, authenticated;
revoke all on function public.sc_set_job_item_status_safe_v1(bigint,text,uuid,text) from public, anon, authenticated;

grant execute on function public.sc_blank_product_candidates_v1(text,text,text,text,text,text,text,text,integer) to service_role;
grant execute on function public.sc_preview_blank_product_v1(jsonb) to service_role;
grant execute on function public.sc_create_blank_product_safe_v1(jsonb,uuid) to service_role;
grant execute on function public.sc_update_blank_product_safe_v1(bigint,jsonb,uuid) to service_role;
grant execute on function public.sc_set_job_status_safe_v1(bigint,text,uuid,text) to service_role;
grant execute on function public.sc_set_job_item_status_safe_v1(bigint,text,uuid,text) to service_role;

commit;

select
  to_regclass('public.sc_product_identity_aliases') is not null as identity_memory_ready,
  to_regclass('public.sc_product_review_cases') is not null as duplicate_workbench_ready,
  to_regclass('public.sc_integration_jobs') is not null as job_center_ready,
  to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is not null as guarded_product_creation_ready;
