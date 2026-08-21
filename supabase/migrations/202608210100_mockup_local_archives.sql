-- Skilled Crafting Inventory App v0.8.4
-- Durable metadata for local Mockup Studio archives.
-- Project and asset rows remain in Supabase; only Storage objects are removed.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

create table if not exists public.mockup_project_archives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  archive_version integer not null default 1,
  archive_name text not null,
  folder_hint text,
  status text not null default 'preparing'
    check (status in ('preparing', 'deleting', 'active', 'restoring', 'restored', 'failed')),
  previous_project_status text,
  manifest jsonb not null default '{}'::jsonb,
  file_count integer not null default 0 check (file_count >= 0),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  deleted_file_keys jsonb not null default '[]'::jsonb,
  error_message text,
  archived_by uuid default auth.uid(),
  archived_at timestamptz,
  restored_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_mockup_project_archives_project
  on public.mockup_project_archives(project_id, created_at desc);
create unique index if not exists ux_mockup_project_archives_open
  on public.mockup_project_archives(project_id)
  where status in ('preparing', 'deleting', 'active');

drop trigger if exists trg_mockup_project_archives_updated_at
  on public.mockup_project_archives;
create trigger trg_mockup_project_archives_updated_at
before update on public.mockup_project_archives
for each row execute function public.sc_mockup_touch_updated_at();

alter table public.mockup_project_archives enable row level security;

drop policy if exists sc_mockup_project_archives_authenticated_all
  on public.mockup_project_archives;
drop policy if exists sc_mockup_project_archives_authenticated_select
  on public.mockup_project_archives;
create policy sc_mockup_project_archives_authenticated_select
on public.mockup_project_archives
for select to authenticated
using (true);

revoke all on table public.mockup_project_archives from public, anon;
grant select on table public.mockup_project_archives to authenticated;
grant all on table public.mockup_project_archives to service_role;

commit;

select
  to_regclass('public.mockup_project_archives') is not null as archive_table_exists,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mockup_project_archives'
      and policyname = 'sc_mockup_project_archives_authenticated_select'
  ) as authenticated_policy_exists;
