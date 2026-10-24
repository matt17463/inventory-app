-- NAS backup reports are advisory monitoring, not proof of restore until explicitly verified.
create table if not exists public.sc_storage_backup_reports (
 site text primary key check(site in ('business','home')),
 reported_at timestamptz not null default now(),
 status text not null check(status in ('configured','running','success','failed','unconfigured')),
 object_count bigint not null default 0 check(object_count>=0),
 bytes_stored bigint not null default 0 check(bytes_stored>=0),
 last_backup_at timestamptz,
 last_restore_test_at timestamptz,
 error_summary text not null default '',
 agent_version text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.sc_storage_backup_reports enable row level security;
revoke all on public.sc_storage_backup_reports from public,anon,authenticated;
grant select on public.sc_storage_backup_reports to authenticated;
drop policy if exists sc_sbr_read on public.sc_storage_backup_reports;
create policy sc_sbr_read on public.sc_storage_backup_reports
for select to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager'])));
insert into public.sc_storage_backup_reports(site,status) values('business','unconfigured'),('home','unconfigured')
on conflict (site) do nothing;
