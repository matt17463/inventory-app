
-- Catalog-wide production readiness: additive only; no stock, order, or recipe mutations.
create table if not exists public.sc_catalog_recipe_assignments (
 id uuid primary key default gen_random_uuid(),
 woocommerce_product_id bigint not null unique check (woocommerce_product_id > 0),
 recipe_id uuid null references public.sc_manufacturing_recipes(id) on delete restrict,
 disposition text not null default 'review' check (disposition in ('review','assigned','fulfillment_only')),
 notes text not null default '',
 created_by uuid not null,
 updated_by uuid null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint sc_catalog_recipe_assigned_requires_recipe check (disposition <> 'assigned' or recipe_id is not null),
 constraint sc_catalog_recipe_fulfillment_no_recipe check (disposition <> 'fulfillment_only' or recipe_id is null)
);
create index if not exists sc_catalog_recipe_assignments_recipe_idx on public.sc_catalog_recipe_assignments(recipe_id);
alter table public.sc_catalog_recipe_assignments enable row level security;
revoke all on public.sc_catalog_recipe_assignments from public, anon, authenticated;
grant select,insert,update on public.sc_catalog_recipe_assignments to service_role;

-- Data API restricted views; only the server-side employee-authorized endpoint reads these.
create or replace view public.sc_catalog_production_families_v1
with (security_invoker = true) as
select p.woocommerce_product_id,
       min(nullif(trim(p.name),'')) as product_name,
       min(nullif(trim(p.sku),'')) as example_sku,
       count(*)::integer as row_count,
       count(*) filter(where p.woocommerce_status='publish')::integer as published_rows,
       count(*) filter(where p.is_finished is true)::integer as finished_rows,
       count(*) filter(where p.blank_product_id is null)::integer as missing_blank_rows,
       count(distinct p.woocommerce_variation_id)::integer as variation_count,
       count(distinct p.logo_id)::integer as legacy_logo_count,
       count(*) filter(where p.woocommerce_status in ('unknown') or p.woocommerce_status is null)::integer as uncertain_status_rows
from public.products p
where p.woocommerce_product_id > 0
group by p.woocommerce_product_id;

revoke all on public.sc_catalog_production_families_v1 from public,anon,authenticated;
grant select on public.sc_catalog_production_families_v1 to service_role;

create or replace view public.sc_legacy_client_readiness_v1
with (security_invoker = true) as
select c.id as customer_id,
       c.name as customer_name,
       (nullif(trim(c.email),'') is not null) as has_email,
       (nullif(trim(c.phone),'') is not null) as has_phone,
       c.last_order_at,
       c.source_orders,
       count(g.id)::integer as crm_account_count
from public.customers c
left join public.sc_growth_accounts g
  on g.customer_id=c.id and g.archived_at is null
group by c.id,c.name,c.email,c.phone,c.last_order_at,c.source_orders;
revoke all on public.sc_legacy_client_readiness_v1 from public,anon,authenticated;
grant select on public.sc_legacy_client_readiness_v1 to service_role;
