-- End-to-end UV job links and private, versioned R2 artifacts.
-- Run after 202610200001_uv_studio_material_recipes.sql.
alter table public.sc_uv_projects
  add column if not exists job_id bigint references public.jobs(id) on delete set null,
  add column if not exists customer_id bigint references public.customers(id) on delete set null,
  add column if not exists artwork_request_id uuid references public.sc_artwork_system_requests(id) on delete set null,
  add column if not exists mockup_project_id uuid references public.mockup_projects(id) on delete set null,
  add column if not exists material_sku text not null default '',
  add column if not exists blank_product_id uuid references public.blank_products(id) on delete set null,
  add column if not exists equipment_id text not null default 'omni',
  add column if not exists waste_quantity integer not null default 0 check (waste_quantity>=0),
  add column if not exists labor_minutes numeric(10,2) not null default 0 check (labor_minutes>=0),
  add column if not exists overhead_cost numeric(12,2) not null default 0 check (overhead_cost>=0);
create index if not exists sc_uv_project_job_link on public.sc_uv_projects(job_id) where job_id is not null;
create index if not exists sc_uv_project_client_link on public.sc_uv_projects(customer_id) where customer_id is not null;

create table if not exists public.sc_uv_assets(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.sc_uv_projects(id) on delete restrict,
 asset_kind text not null check(asset_kind in ('source','editable','production_zip','proof','cutline','calibration','other')),
 file_name text not null check(length(btrim(file_name)) between 1 and 180),
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp','application/json','application/zip','image/svg+xml','text/csv')),
 storage_provider text not null default 'r2' check(storage_provider='r2'),
 storage_bucket text not null check(length(storage_bucket)>0),
 storage_key text not null unique check(storage_key ~ '^uv-studio/[0-9a-f-]{36}/[0-9a-f-]{36}/'),
 file_size bigint not null check(file_size between 1 and 52428800),
 etag text not null default '',
 verified_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 retained boolean not null default true,
 notes text not null default '' check(length(notes) <= 2000)
);
create index if not exists sc_uv_assets_project on public.sc_uv_assets(project_id,created_at desc);
alter table public.sc_uv_assets enable row level security;
revoke all on public.sc_uv_assets from anon, authenticated;
grant select,insert on public.sc_uv_assets to authenticated;
create policy sc_uv_assets_read on public.sc_uv_assets for select to authenticated using (
 public.sc_current_app_role() in ('admin','manager','operator','viewer','marketing')
);
create policy sc_uv_assets_create on public.sc_uv_assets for insert to authenticated with check (
 created_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator')
 and exists(select 1 from public.sc_uv_projects p where p.id=project_id and p.status in ('draft','proof'))
);
-- Cloud assets are append-only and immutable. Delete/replacement is handled by a reviewed retention process.
-- Linked jobs can be selected by employees, but parent-order state cannot be changed by this migration.
