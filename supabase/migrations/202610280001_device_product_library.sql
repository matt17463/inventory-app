-- Device and product library: add staff-owned shared checklists and maintenance audit log.
-- Uses the existing sc_current_app_role() employee authorization helper.
create table if not exists public.sc_device_setup_checks (
 machine_type text not null check (machine_type in ('mopa_fiber','xtool_s1','xtool_p2','xtool_omni','heat_press','sublimation_press')),
 step_key text not null check (step_key ~ '^[a-z][a-z0-9_]{1,79}$'),
 completed_at timestamptz,
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(machine_type,step_key)
);
create table if not exists public.sc_device_maintenance_logs (
 id uuid primary key default gen_random_uuid(),
 machine_type text not null check (machine_type in ('mopa_fiber','xtool_s1','xtool_p2','xtool_omni','heat_press','sublimation_press')),
 task_key text not null check (task_key ~ '^[a-z][a-z0-9_]{1,79}$'),
 performed_at timestamptz not null default now(),
 recorded_by uuid not null default auth.uid() references auth.users(id),
 notes text not null default '' check (length(notes)<=2000),
 created_at timestamptz not null default now()
);
create index if not exists sc_device_maintenance_lookup on public.sc_device_maintenance_logs(machine_type,task_key,performed_at desc);
alter table public.sc_device_setup_checks enable row level security;
alter table public.sc_device_maintenance_logs enable row level security;
revoke all on public.sc_device_setup_checks,public.sc_device_maintenance_logs from anon;
grant select,insert,update on public.sc_device_setup_checks to authenticated;
grant select,insert on public.sc_device_maintenance_logs to authenticated;
revoke delete on public.sc_device_setup_checks,public.sc_device_maintenance_logs from authenticated;
drop policy if exists sc_device_setup_read on public.sc_device_setup_checks;
create policy sc_device_setup_read on public.sc_device_setup_checks for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator','viewer'));
drop policy if exists sc_device_setup_insert on public.sc_device_setup_checks;
create policy sc_device_setup_insert on public.sc_device_setup_checks for insert to authenticated
 with check (updated_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator'));
drop policy if exists sc_device_setup_update on public.sc_device_setup_checks;
create policy sc_device_setup_update on public.sc_device_setup_checks for update to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator'))
 with check (updated_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator'));
drop policy if exists sc_device_maintenance_read on public.sc_device_maintenance_logs;
create policy sc_device_maintenance_read on public.sc_device_maintenance_logs for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','operator','viewer'));
drop policy if exists sc_device_maintenance_insert on public.sc_device_maintenance_logs;
create policy sc_device_maintenance_insert on public.sc_device_maintenance_logs for insert to authenticated
 with check (recorded_by=(select auth.uid()) and public.sc_current_app_role() in ('admin','manager','operator'));
-- Maintenance history is append-only: no update/delete grants or policies.
