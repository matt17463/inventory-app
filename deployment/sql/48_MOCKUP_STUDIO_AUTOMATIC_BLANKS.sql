-- Skilled Crafting Inventory v1.3.2
-- Mockup Studio automatic blank catalog preparation.
-- Safe to run more than once.

begin;

do $$
begin
  if to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is null then
    raise exception 'Run deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql first.';
  end if;
  if to_regprocedure('public.sc_set_product_blank_mappings_bulk_v1(jsonb,text,text,boolean,uuid)') is null then
    raise exception 'Run deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql first.';
  end if;
  if to_regprocedure('public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid)') is null then
    raise exception 'Run deployment/sql/46_NEW_PRODUCT_LINE_SETUP.sql first.';
  end if;
end;
$$;

alter table public.blank_products
  add column if not exists sc_cost_review_required boolean not null default false,
  add column if not exists sc_creation_source text;

create index if not exists ix_blank_products_mockup_catalog_identity
  on public.blank_products (brand_id, product_type_id, color_id, size_id)
  where coalesce(sc_is_archived, false) = false;

create table if not exists public.sc_mockup_blank_catalog_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  export_id uuid references public.mockup_woo_exports(id) on delete set null,
  blank_product_id uuid not null references public.blank_products(id) on delete restrict,
  color_name text not null,
  size_name text not null,
  outcome text not null check (outcome in ('created','reused')),
  reused_by text,
  canonical_color_id bigint references public.colors(id) on delete restrict,
  canonical_size_id bigint references public.sizes(id) on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists ix_sc_mockup_blank_catalog_events_project
  on public.sc_mockup_blank_catalog_events(project_id, created_at desc);

create index if not exists ix_sc_mockup_blank_catalog_events_blank
  on public.sc_mockup_blank_catalog_events(blank_product_id, created_at desc);

alter table public.sc_mockup_blank_catalog_events enable row level security;
revoke all on public.sc_mockup_blank_catalog_events from public, anon, authenticated;
grant all on public.sc_mockup_blank_catalog_events to service_role;

commit;

select
  to_regclass('public.sc_mockup_blank_catalog_events') is not null as event_audit_ready,
  to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is not null as guarded_blank_creation_ready,
  to_regprocedure('public.sc_set_product_blank_mappings_bulk_v1(jsonb,text,text,boolean,uuid)') is not null as variation_mapping_ready;
