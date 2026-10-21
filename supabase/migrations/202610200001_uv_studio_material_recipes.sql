-- Skilled Crafting UV Studio and Equipment Recipe Library
-- Additive migration. Keep production unchanged until application checks and review.
create table if not exists public.sc_material_recipes (
  id uuid primary key default gen_random_uuid(),
  machine_type text not null check (machine_type in ('mopa_fiber','xtool_s1','xtool_p2','xtool_omni','heat_press','sublimation_press')),
  machine_model text not null default '' check (length(machine_model) <= 160),
  machine_configuration text not null default '' check (length(machine_configuration) <= 400),
  operation text not null check (operation in ('color_engrave','etch','score','cut','engrave','uv_flat','uv_texture','uv_relief','uv_varnish','heat_transfer','sublimation')),
  material_name text not null check (length(btrim(material_name)) between 2 and 180),
  material_brand text not null default '',
  material_sku text not null default '',
  material_finish text not null default '',
  thickness_mm numeric(10,3) check (thickness_mm > 0 and thickness_mm < 300),
  material_notes text not null default '',
  safety_notes text not null default '',
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  source_type text not null default 'manual' check (source_type in ('manual','manufacturer','supplier','ai_suggested','prior_test')),
  source_url text not null default '',
  status text not null default 'draft' check (status in ('draft','testing','verified','approved','retired')),
  created_by uuid not null default auth.uid() references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(material_brand) <= 160 and length(material_sku) <= 160 and length(material_finish) <= 160
    and length(material_notes) <= 4000 and length(safety_notes) <= 4000 and length(source_url) <= 1200),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);
create index if not exists sc_material_recipe_find on public.sc_material_recipes (machine_type, operation, lower(material_name), status);
create index if not exists sc_material_recipe_updated on public.sc_material_recipes (updated_at desc);

create table if not exists public.sc_material_recipe_trials (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.sc_material_recipes(id) on delete cascade,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  result text not null check (result in ('pass','fail','needs_adjustment')),
  observed_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(observed_settings) = 'object'),
  measurement jsonb not null default '{}'::jsonb check (jsonb_typeof(measurement) = 'object'),
  observations text not null default '' check (length(observations) <= 4000),
  photo_url text not null default '' check (length(photo_url) <= 1200),
  created_at timestamptz not null default now()
);
create index if not exists sc_material_trials_recipe on public.sc_material_recipe_trials (recipe_id,created_at desc);

create table if not exists public.sc_uv_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 200),
  material_type text not null default 'leather' check (material_type in ('leather','synthetic','transfer_film','metal','other')),
  project_type text not null default 'patch' check (project_type in ('patch','transfer','metal_plate','other')),
  status text not null default 'draft' check (status in ('draft','proof','approved','production','completed','archived')),
  customer_reference text not null default '' check (length(customer_reference) <= 220),
  order_reference text not null default '' check (length(order_reference) <= 160),
  artwork_url text not null default '' check (length(artwork_url) <= 2000),
  proof_url text not null default '' check (length(proof_url) <= 2000),
  material_recipe_id uuid references public.sc_material_recipes(id) on delete set null,
  artwork_config jsonb not null default '{}'::jsonb check (jsonb_typeof(artwork_config) = 'object'),
  production_config jsonb not null default '{}'::jsonb check (jsonb_typeof(production_config) = 'object'),
  quantity integer not null default 1 check (quantity between 1 and 10000),
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sc_uv_project_recent on public.sc_uv_projects (updated_at desc);

create table if not exists public.sc_uv_project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sc_uv_projects(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id),
  kind text not null check (kind in ('proof','test_print','qc','approval','reprint','note')),
  outcome text not null default 'pending' check (outcome in ('pending','pass','fail','approved','rejected')),
  detail text not null default '' check (length(detail) <= 4000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  recorded_at timestamptz not null default now()
);

alter table public.sc_material_recipes enable row level security;
alter table public.sc_material_recipe_trials enable row level security;
alter table public.sc_uv_projects enable row level security;
alter table public.sc_uv_project_events enable row level security;

-- Explicit API access needed due to Oct 2026 Supabase Data API exposure changes.
revoke all on public.sc_material_recipes, public.sc_material_recipe_trials, public.sc_uv_projects, public.sc_uv_project_events from anon;
grant select, insert, update on public.sc_material_recipes to authenticated;
grant select, insert on public.sc_material_recipe_trials to authenticated;
grant select, insert, update on public.sc_uv_projects to authenticated;
grant select, insert on public.sc_uv_project_events to authenticated;
revoke delete on public.sc_material_recipes, public.sc_material_recipe_trials, public.sc_uv_projects, public.sc_uv_project_events from authenticated;

create policy sc_material_read on public.sc_material_recipes for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_material_insert on public.sc_material_recipes for insert to authenticated
 with check (created_by = (select auth.uid())
   and public.sc_current_app_role() in ('admin','manager','operator')
   and status in ('draft','testing','verified') and approved_at is null and approved_by is null);
create policy sc_material_update_staff on public.sc_material_recipes for update to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator') and status <> 'approved')
 with check (public.sc_current_app_role() in ('admin','manager','operator')
   and status in ('draft','testing','verified') and approved_at is null and approved_by is null);
create policy sc_material_update_manager on public.sc_material_recipes for update to authenticated
 using (public.sc_current_app_role() in ('admin','manager'))
 with check (public.sc_current_app_role() in ('admin','manager'));

create policy sc_material_trial_read on public.sc_material_recipe_trials for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_material_trial_add on public.sc_material_recipe_trials for insert to authenticated
 with check (recorded_by = (select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator'));

create policy sc_uv_project_read on public.sc_uv_projects for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_uv_project_add on public.sc_uv_projects for insert to authenticated
 with check (created_by = (select auth.uid())
  and public.sc_current_app_role() in ('admin','manager','operator')
  and status in ('draft','proof') and approved_by is null and approved_at is null);
create policy sc_uv_project_edit on public.sc_uv_projects for update to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator') and status in ('draft','proof'))
 with check (public.sc_current_app_role() in ('admin','manager','operator') and status in ('draft','proof')
  and approved_by is null and approved_at is null);
create policy sc_uv_project_manage on public.sc_uv_projects for update to authenticated
 using (public.sc_current_app_role() in ('admin','manager'))
 with check (public.sc_current_app_role() in ('admin','manager'));

create policy sc_uv_event_read on public.sc_uv_project_events for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_uv_event_add on public.sc_uv_project_events for insert to authenticated
 with check (actor_id = (select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator'));

-- A DB-side approval enforces that a physical test exists; no AI response may auto-approve a recipe.
create or replace function public.sc_approve_material_recipe(p_recipe_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if public.sc_current_app_role() not in ('admin','manager') then raise exception 'Manager approval required'; end if;
  if not exists(select 1 from public.sc_material_recipe_trials
   where recipe_id = p_recipe_id and result = 'pass') then
    raise exception 'At least one passing physical test must be recorded before approval';
  end if;
  update public.sc_material_recipes
     set status = 'approved', approved_by = auth.uid(), approved_at = now(),
         updated_at = now(), version = version + 1
   where id = p_recipe_id and status in ('draft','testing','verified');
  if not found then raise exception 'Recipe not found or not eligible for approval'; end if;
end $$;
revoke all on function public.sc_approve_material_recipe(uuid) from public, anon;
grant execute on function public.sc_approve_material_recipe(uuid) to authenticated;
