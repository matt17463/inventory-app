-- Skilled Crafting Inventory App v0.8.5
-- Mockup Studio: dual Supabase / Cloudflare R2 object storage.
-- Safe to run more than once.

begin;

alter table public.mockup_projects
  add column if not exists storage_provider text,
  add column if not exists storage_migrated_at timestamptz;

alter table public.mockup_blank_assets
  add column if not exists storage_provider text,
  add column if not exists file_size_bytes bigint,
  add column if not exists preview_storage_provider text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists preview_size_bytes bigint;

alter table public.mockup_artwork_assets
  add column if not exists storage_provider text,
  add column if not exists file_size_bytes bigint,
  add column if not exists preview_storage_provider text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists preview_size_bytes bigint,
  add column if not exists prepared_storage_provider text,
  add column if not exists prepared_storage_bucket text,
  add column if not exists prepared_file_size_bytes bigint;

alter table public.mockup_outputs
  add column if not exists storage_provider text,
  add column if not exists file_size_bytes bigint,
  add column if not exists preview_storage_provider text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists preview_size_bytes bigint;

alter table public.mockup_production_packets
  add column if not exists storage_provider text,
  add column if not exists file_size_bytes bigint,
  add column if not exists preview_storage_provider text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists preview_size_bytes bigint;

update public.mockup_blank_assets
set storage_provider = 'supabase'
where storage_provider is null and storage_bucket is not null and storage_path is not null;

update public.mockup_artwork_assets
set storage_provider = 'supabase'
where storage_provider is null and storage_bucket is not null and storage_path is not null;

update public.mockup_artwork_assets
set prepared_storage_provider = coalesce(storage_provider, 'supabase'),
    prepared_storage_bucket = coalesce(prepared_storage_bucket, storage_bucket)
where prepared_storage_path is not null
  and prepared_storage_provider is null;

update public.mockup_outputs
set storage_provider = 'supabase'
where storage_provider is null and storage_bucket is not null and storage_path is not null;

update public.mockup_production_packets
set storage_provider = 'supabase'
where storage_provider is null and storage_bucket is not null and storage_path is not null;

update public.mockup_projects p
set storage_provider = case
  when p.status = 'archived' then 'local_archive'
  when exists (
    select 1 from public.mockup_blank_assets b
    where b.project_id = p.id and b.storage_provider = 'r2'
  ) or exists (
    select 1 from public.mockup_artwork_assets a
    where a.project_id = p.id and a.storage_provider = 'r2'
  ) or exists (
    select 1 from public.mockup_outputs o
    where o.project_id = p.id and o.storage_provider = 'r2'
  ) then 'mixed'
  else 'supabase'
end
where p.storage_provider is null;

alter table public.mockup_projects
  alter column storage_provider set default 'r2';

alter table public.mockup_blank_assets
  alter column storage_provider set default 'supabase';

alter table public.mockup_artwork_assets
  alter column storage_provider set default 'supabase';

alter table public.mockup_outputs
  alter column storage_provider set default 'supabase';

alter table public.mockup_production_packets
  alter column storage_provider set default 'supabase';

alter table public.mockup_projects
  drop constraint if exists mockup_projects_storage_provider_check;
alter table public.mockup_projects
  add constraint mockup_projects_storage_provider_check
  check (storage_provider in ('supabase', 'r2', 'mixed', 'local_archive'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'mockup_blank_assets',
    'mockup_artwork_assets',
    'mockup_outputs',
    'mockup_production_packets'
  ]
  loop
    execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_storage_provider_check');
    execute format(
      'alter table public.%I add constraint %I check (storage_provider is null or storage_provider in (''supabase'', ''r2''))',
      table_name,
      table_name || '_storage_provider_check'
    );
    execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_preview_storage_provider_check');
    execute format(
      'alter table public.%I add constraint %I check (preview_storage_provider is null or preview_storage_provider in (''supabase'', ''r2''))',
      table_name,
      table_name || '_preview_storage_provider_check'
    );
    execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_file_sizes_check');
    execute format(
      'alter table public.%I add constraint %I check ((file_size_bytes is null or file_size_bytes >= 0) and (preview_size_bytes is null or preview_size_bytes >= 0))',
      table_name,
      table_name || '_file_sizes_check'
    );
  end loop;
end
$$;

alter table public.mockup_artwork_assets
  drop constraint if exists mockup_artwork_assets_prepared_storage_provider_check;
alter table public.mockup_artwork_assets
  add constraint mockup_artwork_assets_prepared_storage_provider_check
  check (prepared_storage_provider is null or prepared_storage_provider in ('supabase', 'r2'));

alter table public.mockup_artwork_assets
  drop constraint if exists mockup_artwork_assets_prepared_file_size_check;
alter table public.mockup_artwork_assets
  add constraint mockup_artwork_assets_prepared_file_size_check
  check (prepared_file_size_bytes is null or prepared_file_size_bytes >= 0);

create index if not exists ix_mockup_blank_assets_storage_provider
  on public.mockup_blank_assets(project_id, storage_provider);
create index if not exists ix_mockup_artwork_assets_storage_provider
  on public.mockup_artwork_assets(project_id, storage_provider);
create index if not exists ix_mockup_outputs_storage_provider
  on public.mockup_outputs(project_id, storage_provider);

create or replace view public.mockup_storage_inventory
with (security_invoker = true)
as
with stored_objects as (
  select project_id, storage_provider, file_size_bytes, preview_size_bytes
  from public.mockup_blank_assets
  union all
  select project_id, storage_provider, file_size_bytes, preview_size_bytes
  from public.mockup_artwork_assets
  union all
  select project_id, storage_provider, file_size_bytes, preview_size_bytes
  from public.mockup_outputs
  union all
  select project_id, storage_provider, file_size_bytes, preview_size_bytes
  from public.mockup_production_packets
)
select
  project_id,
  coalesce(storage_provider, 'external') as storage_provider,
  count(*)::bigint as original_file_count,
  count(*) filter (where preview_size_bytes is not null)::bigint as preview_file_count,
  coalesce(sum(file_size_bytes), 0)::bigint as original_bytes,
  coalesce(sum(preview_size_bytes), 0)::bigint as preview_bytes,
  coalesce(sum(file_size_bytes), 0)::bigint + coalesce(sum(preview_size_bytes), 0)::bigint as total_known_bytes
from stored_objects
group by project_id, coalesce(storage_provider, 'external');

grant select on public.mockup_storage_inventory to authenticated, service_role;

comment on view public.mockup_storage_inventory is
  'Per-project Mockup Studio object counts and known byte totals by storage provider.';

commit;

