-- Skilled Crafting Laser Relief Studio: additive, private R2 assets, guarded machine readiness.
create table if not exists public.sc_laser_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 180),
  status text not null default 'draft' check(status in ('draft','proof','approved','production','archived')),
  machine_type text not null default 'mopa_fiber' check(machine_type in ('mopa_fiber','xtool_p2','xtool_s1','xtool_omni')),
  material_name text not null default '' check(length(material_name)<=180),
  preset text not null default 'coin' check(length(preset)<=100),
  source_mode text not null default 'logo' check(source_mode in ('logo','photo','grayscale','ai')),
  settings jsonb not null default '{}'::jsonb check(jsonb_typeof(settings)='object'),
  material_recipe_id uuid references public.sc_material_recipes(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  customer_id bigint references public.customers(id) on delete set null,
  artwork_request_id uuid references public.sc_artwork_system_requests(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sc_laser_projects_recent on public.sc_laser_projects(updated_at desc);
create index if not exists sc_laser_projects_jobs on public.sc_laser_projects(job_id) where job_id is not null;

create table if not exists public.sc_laser_assets(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sc_laser_projects(id) on delete restrict,
  asset_kind text not null check(asset_kind in ('source','heightmap','stl','svg','calibration','proof','editable')),
  file_name text not null check(length(btrim(file_name)) between 1 and 180),
  mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp','application/json','image/svg+xml','model/stl')),
  storage_provider text not null default 'r2' check(storage_provider='r2'),
  storage_bucket text not null,
  storage_key text not null unique check(storage_key ~ '^laser-relief/[0-9a-f-]{36}/[0-9a-f-]{36}/'),
  file_size bigint not null check(file_size between 1 and 52428800),
  etag text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  notes text not null default '' check(length(notes)<=2000)
);
create index if not exists sc_laser_assets_project_recent on public.sc_laser_assets(project_id,created_at desc);

create table if not exists public.sc_laser_tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.sc_laser_projects(id) on delete restrict,
  material_recipe_id uuid references public.sc_material_recipes(id) on delete set null,
  result text not null check(result in ('pass','fail','needs_adjustment')),
  measured_depth_mm numeric(9,4) check(measured_depth_mm>=0 and measured_depth_mm<50),
  notes text not null default '' check(length(notes)<=3000),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists sc_laser_tests_project_recent on public.sc_laser_tests(project_id,created_at desc);

alter table public.sc_laser_projects enable row level security;
alter table public.sc_laser_assets enable row level security;
alter table public.sc_laser_tests enable row level security;
revoke all on public.sc_laser_projects,public.sc_laser_assets,public.sc_laser_tests from anon,authenticated;
grant select,insert,update on public.sc_laser_projects to authenticated;
grant select,insert on public.sc_laser_assets,public.sc_laser_tests to authenticated;
create policy sc_laser_project_read on public.sc_laser_projects for select to authenticated
using(public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_laser_project_insert on public.sc_laser_projects for insert to authenticated
with check(created_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator')
and status in ('draft','proof') and approved_at is null and approved_by is null);
create policy sc_laser_project_staff_edit on public.sc_laser_projects for update to authenticated
using(public.sc_current_app_role() in ('admin','manager','operator') and status in ('draft','proof'))
with check(public.sc_current_app_role() in ('admin','manager','operator')
and status in ('draft','proof') and approved_at is null and approved_by is null);
create policy sc_laser_project_manager_manage on public.sc_laser_projects for update to authenticated
using(public.sc_current_app_role() in ('admin','manager'))
with check(public.sc_current_app_role() in ('admin','manager'));
create policy sc_laser_asset_read on public.sc_laser_assets for select to authenticated
using(public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_laser_asset_write on public.sc_laser_assets for insert to authenticated
with check(created_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator')
and exists(select 1 from public.sc_laser_projects p where p.id=project_id and p.status in ('draft','proof')));
create policy sc_laser_test_read on public.sc_laser_tests for select to authenticated
using(public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing'));
create policy sc_laser_test_write on public.sc_laser_tests for insert to authenticated
with check(recorded_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator')
and exists(select 1 from public.sc_laser_projects p where p.id=project_id and p.status in ('draft','proof')));

-- Only a manager can certify production readiness; no generated heightmap or AI inference auto-approves.
create or replace function public.sc_laser_project_approval_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status in ('approved','production') then
    if coalesce(public.sc_current_app_role() in ('admin','manager'),false)=false then
      raise exception 'Manager approval required';
    end if;
    if new.approved_by is distinct from auth.uid() or new.approved_at is null then
      raise exception 'Manager signature and timestamp required';
    end if;
    if new.material_recipe_id is null or not exists (
      select 1 from public.sc_material_recipes r
      where r.id=new.material_recipe_id and r.status='approved' and r.machine_type=new.machine_type
    ) then raise exception 'A tested approved machine/material recipe is required'; end if;
    if not exists(select 1 from public.sc_laser_assets a where a.project_id=new.id and a.asset_kind='source')
    or not exists(select 1 from public.sc_laser_assets a where a.project_id=new.id and a.asset_kind='heightmap') then
      raise exception 'Saved source and heightmap are required'; end if;
    if not exists(select 1 from public.sc_laser_tests t
      where t.project_id=new.id and t.material_recipe_id=new.material_recipe_id and t.result='pass') then
      raise exception 'A passing physical material test for this recipe is required'; end if;
  elsif new.approved_by is not null or new.approved_at is not null then
    raise exception 'Draft and proof projects cannot retain approval metadata';
  end if;
  if tg_op='UPDATE' and old.status in ('approved','production') and (
    new.settings is distinct from old.settings or new.machine_type is distinct from old.machine_type
    or new.material_recipe_id is distinct from old.material_recipe_id) then
    raise exception 'Approved laser projects are immutable; create a new draft';
  end if;
  return new;
end $$;
drop trigger if exists sc_laser_project_approval_validate on public.sc_laser_projects;
create trigger sc_laser_project_approval_validate
before insert or update on public.sc_laser_projects for each row
execute function public.sc_laser_project_approval_guard();
revoke all on function public.sc_laser_project_approval_guard() from public,anon,authenticated;
