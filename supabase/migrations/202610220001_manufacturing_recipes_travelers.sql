-- Skilled Crafting — additive manufacturing recipes and scanned job travelers.
-- Existing jobs/job_items, product stock, WooCommerce and material settings stay authoritative.
create extension if not exists pgcrypto;

create table if not exists public.sc_manufacturing_recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  garment_type text not null default 'tee' check (garment_type in ('tee','hoodie','sweatshirt','polo','other')),
  decoration_method text not null default 'DTF',
  blank_product_id uuid null,
  notes text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists sc_manufacturing_recipes_name_idx on public.sc_manufacturing_recipes(name);

create table if not exists public.sc_manufacturing_recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.sc_manufacturing_recipes(id) on delete restrict,
  revision integer not null check (revision > 0),
  placements jsonb not null default '[]'::jsonb check (jsonb_typeof(placements) = 'array'),
  process_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(process_steps) = 'array'),
  packaging jsonb not null default '{}'::jsonb check (jsonb_typeof(packaging) = 'object'),
  machine_settings_id uuid null references public.sc_material_recipes(id) on delete restrict,
  artwork_asset_id uuid null references public.mockup_artwork_assets(id) on delete restrict,
  production_notes text not null default '',
  verified_sample boolean not null default false,
  status text not null default 'draft' check (status in ('draft','approved')),
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (recipe_id, revision),
  constraint sc_recipe_version_approval_state check (
    (status='draft' and approved_by is null and approved_at is null)
    or (status='approved' and verified_sample and approved_by is not null and approved_at is not null)
  )
);
create index if not exists sc_recipe_versions_parent_idx on public.sc_manufacturing_recipe_versions(recipe_id,revision desc);

create or replace function public.sc_guard_recipe_version_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (old.status <> 'draft' or new.status <> 'approved'
      or not old.verified_sample or not new.verified_sample
      or public.sc_current_app_role() not in ('admin','manager')
      or new.approved_by is distinct from auth.uid()
      or new.approved_at is null
      or (to_jsonb(new) - 'status' - 'approved_by' - 'approved_at')
         is distinct from (to_jsonb(old) - 'status' - 'approved_by' - 'approved_at')) then
    raise exception 'Recipe version is immutable; create a new revision or approve a verified draft' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists sc_guard_recipe_version_update on public.sc_manufacturing_recipe_versions;
create trigger sc_guard_recipe_version_update before update on public.sc_manufacturing_recipe_versions
for each row execute function public.sc_guard_recipe_version_update();

create table if not exists public.sc_job_travelers (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete restrict,
  job_item_id bigint not null references public.job_items(id) on delete restrict,
  recipe_version_id uuid not null references public.sc_manufacturing_recipe_versions(id) on delete restrict,
  recipe_snapshot jsonb not null default '{}'::jsonb,
  ordered_quantity bigint not null default 0 check (ordered_quantity >= 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(job_item_id)
);
create index if not exists sc_job_travelers_job_idx on public.sc_job_travelers(job_id);

create or replace function public.sc_guard_job_traveler_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v public.sc_manufacturing_recipe_versions%rowtype; item public.job_items%rowtype; recipe public.sc_manufacturing_recipes%rowtype;
begin
  select * into v from public.sc_manufacturing_recipe_versions where id=new.recipe_version_id and status='approved';
  if not found then raise exception 'A verified and approved recipe version is required' using errcode='23514'; end if;
  select * into item from public.job_items where id=new.job_item_id and job_id=new.job_id;
  if not found then raise exception 'The job item does not belong to this job' using errcode='23514'; end if;
  select * into recipe from public.sc_manufacturing_recipes where id=v.recipe_id;
  new.recipe_snapshot := jsonb_build_object(
    'recipe_name',recipe.name,'garment_type',recipe.garment_type,'decoration_method',recipe.decoration_method,
    'recipe_id',v.recipe_id,'recipe_version_id',v.id,'revision',v.revision,
    'placements',v.placements,'process_steps',v.process_steps,'packaging',v.packaging,
    'production_notes',v.production_notes,'machine_settings_id',v.machine_settings_id,
    'artwork_asset_id',v.artwork_asset_id,'approved_at',v.approved_at,
    'blank',jsonb_build_object('brand',item.brand,'style',item.selected_style,'color',item.color,'size',item.size,'sku',coalesce(item.order_sku,item.sku),'product_type',item.product_type),
    'item_name',coalesce(item.ordered_product_name,item.item_name,item.name),
    'placement',item.placement
  );
  new.ordered_quantity := greatest(0,item.quantity);
  return new;
end $$;
drop trigger if exists sc_guard_job_traveler_insert on public.sc_job_travelers;
create trigger sc_guard_job_traveler_insert before insert on public.sc_job_travelers
for each row execute function public.sc_guard_job_traveler_insert();

create table if not exists public.sc_job_traveler_events (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.sc_job_travelers(id) on delete restrict,
  kind text not null check (kind in ('note','placement_checked','batch_started','batch_finished','packing_checked','exception')),
  details text not null default '',
  actor_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists sc_job_traveler_events_parent_idx on public.sc_job_traveler_events(traveler_id,created_at desc);

-- Single-use append-only revision/event records; no DELETE or generalized UPDATE.
alter table public.sc_manufacturing_recipes enable row level security;
alter table public.sc_manufacturing_recipe_versions enable row level security;
alter table public.sc_job_travelers enable row level security;
alter table public.sc_job_traveler_events enable row level security;

revoke all on public.sc_manufacturing_recipes,public.sc_manufacturing_recipe_versions,public.sc_job_travelers,public.sc_job_traveler_events from public, anon, authenticated;
grant select,insert on public.sc_manufacturing_recipes to authenticated;
grant select,insert,update on public.sc_manufacturing_recipe_versions to authenticated;
grant select,insert on public.sc_job_travelers to authenticated;
grant select,insert on public.sc_job_traveler_events to authenticated;

create policy sc_mr_read on public.sc_manufacturing_recipes for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_mr_add on public.sc_manufacturing_recipes for insert to authenticated
with check ((select public.sc_internal_access_allowed(array['admin','manager','operator'])) and created_by=(select auth.uid()));
create policy sc_mrv_read on public.sc_manufacturing_recipe_versions for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_mrv_add on public.sc_manufacturing_recipe_versions for insert to authenticated
with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and created_by=(select auth.uid()) and status='draft' and approved_by is null and approved_at is null);
create policy sc_mrv_approve on public.sc_manufacturing_recipe_versions for update to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager'])) and status='draft')
with check ((select public.sc_internal_access_allowed(array['admin','manager'])) and status='approved'
 and verified_sample=true and approved_by=(select auth.uid()));
create policy sc_jt_read on public.sc_job_travelers for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_jt_add on public.sc_job_travelers for insert to authenticated
with check ((select public.sc_internal_access_allowed(array['admin','manager','operator'])) and created_by=(select auth.uid()));
create policy sc_jte_read on public.sc_job_traveler_events for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_jte_add on public.sc_job_traveler_events for insert to authenticated
with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and actor_id=(select auth.uid()));
