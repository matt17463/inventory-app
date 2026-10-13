-- Skilled Crafting contractor hour tracking. Additive; deploy only after review.
-- Requires existing sc_app_user_roles and sc_current_app_role() migration.
create table if not exists public.sc_contractors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.sc_contractor_hourly_rates (
  contractor_id uuid not null references public.sc_contractors(user_id) on delete cascade,
  effective_on date not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0 and hourly_rate <= 10000),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (contractor_id, effective_on)
);

create table if not exists public.sc_contractor_time_entries (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.sc_contractors(user_id) on delete cascade,
  work_date date not null,
  method text not null check (method in ('manual', 'clock')),
  started_at timestamptz,
  ended_at timestamptz,
  hours numeric(8,2),
  activity text not null default 'Production' check (length(trim(activity)) between 1 and 80),
  notes text not null default '' check (length(notes) <= 2000),
  status text not null default 'submitted' check (status in ('open','submitted','approved','rejected','paid','void')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sc_contractor_hours_shape check (
    (status = 'open' and method = 'clock' and started_at is not null and ended_at is null and hours is null)
    or (status <> 'open' and hours > 0 and hours <= 24)
  ),
  constraint sc_contractor_clock_interval check (
    method = 'manual' or (started_at is not null and (ended_at is null or ended_at > started_at))
  )
);
create unique index if not exists sc_contractor_one_open_shift
  on public.sc_contractor_time_entries (contractor_id) where status = 'open';
create index if not exists sc_contractor_entries_date
  on public.sc_contractor_time_entries (work_date, contractor_id, status);

create table if not exists public.sc_contractor_time_audit (
  id bigint generated always as identity primary key,
  entry_id uuid not null,
  actor_id uuid,
  action text not null,
  before_value jsonb,
  after_value jsonb,
  changed_at timestamptz not null default now()
);


create table if not exists public.sc_contractor_rate_audit (
  id bigint generated always as identity primary key,
  contractor_id uuid not null,
  effective_on date not null,
  actor_id uuid,
  old_rate numeric(10,2),
  new_rate numeric(10,2),
  changed_at timestamptz not null default now()
);
alter table public.sc_contractor_rate_audit enable row level security;
revoke all on public.sc_contractor_rate_audit from anon, authenticated;

alter table public.sc_contractors enable row level security;
alter table public.sc_contractor_hourly_rates enable row level security;
alter table public.sc_contractor_time_entries enable row level security;
alter table public.sc_contractor_time_audit enable row level security;
revoke all on public.sc_contractors, public.sc_contractor_hourly_rates,
  public.sc_contractor_time_entries, public.sc_contractor_time_audit from anon, authenticated;
grant select on public.sc_contractors, public.sc_contractor_time_entries to authenticated;
grant select on public.sc_contractor_hourly_rates to authenticated;

drop policy if exists sc_contractors_select on public.sc_contractors;
create policy sc_contractors_select on public.sc_contractors
  for select to authenticated using (
    public.sc_current_app_role() is not null
    and (user_id = auth.uid() or public.sc_current_app_role() in ('admin','manager'))
  );
drop policy if exists sc_contractor_entries_select on public.sc_contractor_time_entries;
create policy sc_contractor_entries_select on public.sc_contractor_time_entries
  for select to authenticated using (
    public.sc_current_app_role() is not null
    and (contractor_id = auth.uid() or public.sc_current_app_role() in ('admin','manager'))
  );
drop policy if exists sc_contractor_rates_select on public.sc_contractor_hourly_rates;
create policy sc_contractor_rates_select on public.sc_contractor_hourly_rates
  for select to authenticated using (public.sc_current_app_role() in ('admin','manager'));
-- No INSERT/UPDATE/DELETE policies: all writes must pass validated RPCs.
-- Audit table is intentionally service-role-only.

create or replace function public.sc_contractor_initialize()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text; v_name text;
begin
  v_role := public.sc_current_app_role();
  if auth.uid() is null or coalesce(v_role in ('admin','manager','operator'),false) = false
    then raise exception 'Active contractor access required'; end if;
  select coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), u.email, 'Contractor')
    into v_name from auth.users u where u.id = auth.uid();
  insert into public.sc_contractors(user_id, display_name)
    values (auth.uid(), left(v_name,120))
    on conflict (user_id) do nothing;
end $$;

create or replace function public.sc_contractor_register(p_email text, p_name text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user uuid; v_name text;
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager'),false) = false then raise exception 'Manager permission required'; end if;
  select u.id, coalesce(nullif(trim(p_name),''),u.email) into v_user,v_name
    from auth.users u join public.sc_app_user_roles r on r.user_id=u.id and r.is_active
    where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'No active application user matches this email'; end if;
  if length(v_name)>120 then raise exception 'Name is too long'; end if;
  insert into public.sc_contractors(user_id,display_name) values(v_user,v_name)
  on conflict(user_id) do update set display_name = excluded.display_name;
  return v_user;
end $$;

create or replace function public.sc_contractor_set_rate(
  p_contractor_id uuid, p_effective_on date, p_hourly_rate numeric)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager'),false) = false then raise exception 'Manager permission required'; end if;
  if p_effective_on is null or p_hourly_rate is null or p_hourly_rate < 0 or p_hourly_rate > 10000 then
    raise exception 'Invalid effective date or hourly rate';
  end if;
  insert into public.sc_contractor_hourly_rates (contractor_id,effective_on,hourly_rate,updated_by)
  values (p_contractor_id,p_effective_on,round(p_hourly_rate,2),auth.uid())
  on conflict (contractor_id,effective_on) do update
    set hourly_rate=excluded.hourly_rate,updated_by=auth.uid(),updated_at=now();
end $$;

create or replace function public.sc_contractor_record_manual(
  p_work_date date, p_hours numeric, p_activity text,
  p_notes text default '', p_contractor_id uuid default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_contractor uuid := coalesce(p_contractor_id, auth.uid()); v_role text;
begin
  v_role := public.sc_current_app_role();
  if coalesce(v_role in ('admin','manager','operator'),false) = false
    then raise exception 'Active contractor access required'; end if;
  if v_contractor <> auth.uid() and v_role not in ('admin','manager') then
    raise exception 'Cannot enter another contractor''s time';
  end if;
  if p_work_date is null or p_hours is null or p_hours <= 0 or p_hours > 24
    or length(trim(coalesce(p_activity,''))) not between 1 and 80
    or length(coalesce(p_notes,'')) > 2000 then raise exception 'Invalid manual time entry'; end if;
  if v_contractor=auth.uid() then perform public.sc_contractor_initialize(); end if;
  if not exists (select 1 from public.sc_contractors where user_id=v_contractor) then
    raise exception 'Contractor profile not found'; end if;
  insert into public.sc_contractor_time_entries
    (contractor_id,work_date,method,hours,activity,notes,status,created_by)
  values (v_contractor,p_work_date,'manual',round(p_hours,2),trim(p_activity),coalesce(p_notes,''),'submitted',auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.sc_contractor_clock_in(p_activity text default 'Production', p_notes text default '')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  perform public.sc_contractor_initialize();
  if length(trim(coalesce(p_activity,''))) not between 1 and 80
    or length(coalesce(p_notes,''))>2000 then raise exception 'Invalid activity or notes'; end if;
  if exists(select 1 from public.sc_contractor_time_entries
    where contractor_id=auth.uid() and status='open') then raise exception 'Already clocked in'; end if;
  insert into public.sc_contractor_time_entries
    (contractor_id,work_date,method,started_at,activity,notes,status,created_by)
  values (auth.uid(),(clock_timestamp() at time zone 'America/Los_Angeles')::date,
    'clock',clock_timestamp(),trim(p_activity),coalesce(p_notes,''),'open',auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.sc_contractor_clock_out()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_row public.sc_contractor_time_entries%rowtype; v_end timestamptz := clock_timestamp(); v_hours numeric;
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager','operator'),false) = false
    then raise exception 'Active contractor access required'; end if;
  select * into v_row from public.sc_contractor_time_entries
    where contractor_id=auth.uid() and status='open' for update;
  if not found then raise exception 'No active clock-in'; end if;
  v_hours := round((extract(epoch from (v_end-v_row.started_at))/3600)::numeric,2);
  if v_hours <= 0 then raise exception 'Clocked time is less than 0.01 hours; try again shortly'; end if;
  if v_hours > 24 then raise exception 'Shift exceeds 24 hours; ask a manager to correct the entry'; end if;
  update public.sc_contractor_time_entries
    set ended_at=v_end,hours=v_hours,status='submitted',updated_at=now()
    where id=v_row.id;
  return v_row.id;
end $$;

create or replace function public.sc_contractor_edit_manual(
  p_entry_id uuid, p_work_date date, p_hours numeric, p_activity text, p_notes text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare v_row public.sc_contractor_time_entries%rowtype; v_role text := public.sc_current_app_role();
begin
  if coalesce(v_role in ('admin','manager','operator'),false) = false
    then raise exception 'Active contractor access required'; end if;
  select * into v_row from public.sc_contractor_time_entries where id=p_entry_id for update;
  if not found or (v_row.contractor_id <> auth.uid() and v_role not in ('admin','manager'))
    then raise exception 'Entry unavailable'; end if;
  if v_row.method <> 'manual' or v_row.status not in ('submitted','rejected') then
    raise exception 'Only unapproved manual entries can be edited'; end if;
  if p_work_date is null or p_hours is null or p_hours<=0 or p_hours>24
    or length(trim(coalesce(p_activity,''))) not between 1 and 80
    or length(coalesce(p_notes,'')) > 2000 then raise exception 'Invalid entry'; end if;
  update public.sc_contractor_time_entries
    set work_date=p_work_date,hours=round(p_hours,2),activity=trim(p_activity),notes=coalesce(p_notes,''),
      status='submitted',reviewed_by=null,reviewed_at=null,updated_at=now()
    where id=p_entry_id;
end $$;

create or replace function public.sc_contractor_review(p_entry_id uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_row public.sc_contractor_time_entries%rowtype;
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager'),false) = false then raise exception 'Manager permission required'; end if;
  select * into v_row from public.sc_contractor_time_entries where id=p_entry_id for update;
  if not found then raise exception 'Time entry not found'; end if;
  if (p_status='approved' and v_row.status not in ('submitted','rejected'))
    or (p_status='rejected' and v_row.status not in ('submitted','approved'))
    or (p_status='paid' and v_row.status <> 'approved')
    or p_status not in ('approved','rejected','paid') then
      raise exception 'Invalid status transition';
  end if;
  update public.sc_contractor_time_entries
    set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
      paid_at=case when p_status='paid' then now() else null end,updated_at=now()
    where id=p_entry_id;
end $$;

create or replace function public.sc_contractor_void(p_entry_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_row public.sc_contractor_time_entries%rowtype; v_role text := public.sc_current_app_role();
begin
  if coalesce(v_role in ('admin','manager','operator'),false) = false
    then raise exception 'Active contractor access required'; end if;
  select * into v_row from public.sc_contractor_time_entries where id=p_entry_id for update;
  if not found or (v_row.contractor_id <> auth.uid() and v_role not in ('admin','manager')) then
    raise exception 'Entry unavailable'; end if;
  if v_row.status not in ('submitted','rejected') or length(trim(coalesce(p_reason,'')))<3 then
    raise exception 'Cannot void this entry; provide a reason of at least 3 characters'; end if;
  update public.sc_contractor_time_entries
    set status='void',notes=left(notes||' [Voided: '||trim(p_reason)||']',2000),updated_at=now()
    where id=p_entry_id;
end $$;

-- Managers can resolve a forgotten clock-out without fabricating a precise shift duration.
create or replace function public.sc_contractor_resolve_open(p_entry_id uuid, p_hours numeric, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_row public.sc_contractor_time_entries%rowtype;
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager'),false) = false then
    raise exception 'Manager permission required'; end if;
  if p_hours is null or p_hours < 0.01 or p_hours > 24
    or length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'Specify 0.01 to 24 hours and a correction reason'; end if;
  select * into v_row from public.sc_contractor_time_entries where id=p_entry_id for update;
  if not found or v_row.status <> 'open' then raise exception 'No open shift found'; end if;
  -- The verified duration is known, but the actual clock-out timestamp is not.
  -- Retain ended_at=NULL rather than inventing a time the contractor did not record.
  update public.sc_contractor_time_entries
    set ended_at=null,hours=round(p_hours,2),status='submitted',
      notes=left(notes||' [Manager duration correction: '||trim(p_reason)||']',2000),
      updated_at=now() where id=p_entry_id;
end $$;

create or replace function public.sc_contractor_audit_rate_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    insert into public.sc_contractor_rate_audit
      (contractor_id,effective_on,actor_id,new_rate)
      values (new.contractor_id,new.effective_on,auth.uid(),new.hourly_rate);
  else
    insert into public.sc_contractor_rate_audit
      (contractor_id,effective_on,actor_id,old_rate,new_rate)
      values (new.contractor_id,new.effective_on,auth.uid(),old.hourly_rate,new.hourly_rate);
  end if;
  return new;
end $$;
drop trigger if exists sc_contractor_rate_audit_trigger on public.sc_contractor_hourly_rates;
create trigger sc_contractor_rate_audit_trigger after insert or update
  on public.sc_contractor_hourly_rates for each row execute function public.sc_contractor_audit_rate_change();

-- Database-owned immutable audit history for time entries and approvals.
create or replace function public.sc_contractor_audit_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    insert into public.sc_contractor_time_audit(entry_id,actor_id,action,after_value)
      values (new.id,auth.uid(),tg_op,to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    insert into public.sc_contractor_time_audit(entry_id,actor_id,action,before_value,after_value)
      values (new.id,auth.uid(),tg_op,to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.sc_contractor_time_audit(entry_id,actor_id,action,before_value)
      values (old.id,auth.uid(),tg_op,to_jsonb(old));
    return old;
  end if;
end $$;
drop trigger if exists sc_contractor_time_audit_trigger on public.sc_contractor_time_entries;
create trigger sc_contractor_time_audit_trigger after insert or update or delete
  on public.sc_contractor_time_entries for each row execute function public.sc_contractor_audit_change();

revoke all on function public.sc_contractor_initialize() from public, anon;
revoke all on function public.sc_contractor_register(text,text) from public, anon;
revoke all on function public.sc_contractor_set_rate(uuid,date,numeric) from public, anon;
revoke all on function public.sc_contractor_record_manual(date,numeric,text,text,uuid) from public, anon;
revoke all on function public.sc_contractor_clock_in(text,text) from public, anon;
revoke all on function public.sc_contractor_clock_out() from public, anon;
revoke all on function public.sc_contractor_edit_manual(uuid,date,numeric,text,text) from public, anon;
revoke all on function public.sc_contractor_review(uuid,text) from public, anon;
revoke all on function public.sc_contractor_void(uuid,text) from public, anon;
revoke all on function public.sc_contractor_audit_change() from public, anon, authenticated;
revoke all on function public.sc_contractor_audit_rate_change() from public, anon, authenticated;
revoke all on function public.sc_contractor_resolve_open(uuid,numeric,text) from public, anon;
grant execute on function public.sc_contractor_initialize() to authenticated;
grant execute on function public.sc_contractor_register(text,text) to authenticated;
grant execute on function public.sc_contractor_set_rate(uuid,date,numeric) to authenticated;
grant execute on function public.sc_contractor_record_manual(date,numeric,text,text,uuid) to authenticated;
grant execute on function public.sc_contractor_clock_in(text,text) to authenticated;
grant execute on function public.sc_contractor_clock_out() to authenticated;
grant execute on function public.sc_contractor_edit_manual(uuid,date,numeric,text,text) to authenticated;
grant execute on function public.sc_contractor_review(uuid,text) to authenticated;
grant execute on function public.sc_contractor_void(uuid,text) to authenticated;

grant execute on function public.sc_contractor_resolve_open(uuid,numeric,text) to authenticated;
