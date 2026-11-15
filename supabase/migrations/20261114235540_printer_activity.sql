begin;

create table public.sc_printer_activity_events (
  id bigint generated always as identity primary key,
  printer_id text not null check (printer_id in ('roland', 'omni')),
  kind text not null check (kind in ('print', 'correction', 'settings', 'observation', 'telemetry')),
  source text not null default 'staff' check (source in ('staff', 'roland_connect', 'omni_studio')),
  event_key text not null default gen_random_uuid()::text
    check (event_key ~ '^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$'),
  actor uuid default auth.uid(),
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  detail text check (char_length(btrim(detail)) between 1 and 200),
  idle_days integer,
  warning_days integer,
  planned_mode text check (planned_mode in ('normal', 'sleep', 'vacation', 'unknown')),
  snoozed_until timestamptz,
  observed_mode text check (observed_mode in ('normal', 'sleep', 'vacation', 'unknown')),
  readings jsonb,
  unique (printer_id, source, event_key),
  check (isfinite(occurred_at) and occurred_at <= recorded_at + interval '1 minute'),
  check (
    (source = 'staff' and actor is not null and kind in ('correction', 'settings', 'observation')) or
    (actor is null and kind in ('print', 'telemetry') and
      ((source = 'roland_connect' and printer_id = 'roland') or (source = 'omni_studio' and printer_id = 'omni')))
  ),
  check (kind not in ('print', 'correction', 'observation') or detail is not null),
  check (
    (kind = 'settings' and idle_days is not null and idle_days between 1 and 365
      and warning_days is not null and warning_days between 0 and idle_days and planned_mode is not null
      and (snoozed_until is null or (isfinite(snoozed_until) and snoozed_until <= recorded_at + interval '30 days'))) or
    (kind <> 'settings' and idle_days is null and warning_days is null and planned_mode is null and snoozed_until is null)
  ),
  check (kind = 'observation' or kind = 'telemetry' or observed_mode is null),
  check (kind <> 'observation' or observed_mode is not null),
  check ((kind = 'telemetry' and readings is not null and jsonb_typeof(readings) = 'object'
    and octet_length(readings::text) <= 2048) or (kind <> 'telemetry' and readings is null))
);

create index sc_printer_activity_event_timeline_idx
  on public.sc_printer_activity_events (printer_id, kind, occurred_at desc, id desc);
create index sc_printer_activity_event_revision_idx
  on public.sc_printer_activity_events (printer_id, kind, id desc);

alter table public.sc_printer_activity_events enable row level security;
revoke all on public.sc_printer_activity_events from public, anon, authenticated, service_role;
grant select on public.sc_printer_activity_events to authenticated, service_role;
grant insert (printer_id, kind, event_key, occurred_at, detail, idle_days, warning_days, planned_mode,
  snoozed_until, observed_mode) on public.sc_printer_activity_events to authenticated;
grant insert (printer_id, kind, source, event_key, actor, occurred_at, detail, observed_mode, readings)
  on public.sc_printer_activity_events to service_role;
grant usage on sequence public.sc_printer_activity_events_id_seq to authenticated, service_role;

create policy sc_printer_events_read on public.sc_printer_activity_events for select to authenticated
  using ((select public.sc_current_app_role()) in ('admin', 'manager', 'operator', 'viewer'));
create policy sc_printer_events_record on public.sc_printer_activity_events for insert to authenticated
  with check (
    source = 'staff' and actor = (select auth.uid()) and
    ((kind in ('correction', 'observation') and (select public.sc_current_app_role()) in ('admin', 'manager', 'operator'))
      or (kind = 'settings' and (select public.sc_current_app_role()) in ('admin', 'manager')))
  );

-- A correction supersedes historical completions. A genuinely later print resumes tracking.
create view public.sc_printer_activity with (security_invoker = true) as
select printer.id as printer_id,
  coalesce(settings.idle_days, 7) as idle_days,
  coalesce(settings.warning_days, 2) as warning_days,
  coalesce(settings.planned_mode, 'unknown') as planned_mode,
  settings.snoozed_until,
  coalesce(job.occurred_at, correction.occurred_at) as last_print_at,
  coalesce(job.source, correction.source) as last_print_source,
  coalesce(job.detail, correction.detail) as last_print_evidence,
  observation.observed_mode as staff_observed_mode,
  observation.occurred_at as staff_observed_at,
  telemetry.observed_mode as hardware_mode,
  telemetry.occurred_at as telemetry_at,
  telemetry.source as telemetry_source,
  telemetry.readings
from (values ('roland'), ('omni')) as printer(id)
left join lateral (
  select * from public.sc_printer_activity_events e
  where e.printer_id = printer.id and e.kind = 'settings' order by id desc limit 1
) settings on true
left join lateral (
  select * from public.sc_printer_activity_events e
  where e.printer_id = printer.id and e.kind = 'correction' order by id desc limit 1
) correction on true
left join lateral (
  select * from public.sc_printer_activity_events e
  where e.printer_id = printer.id and e.kind = 'print'
    and (correction.id is null or e.occurred_at > correction.recorded_at)
  order by occurred_at desc, id desc limit 1
) job on true
left join lateral (
  select * from public.sc_printer_activity_events e
  where e.printer_id = printer.id and e.kind = 'observation' order by occurred_at desc, id desc limit 1
) observation on true
left join lateral (
  select * from public.sc_printer_activity_events e
  where e.printer_id = printer.id and e.kind = 'telemetry' order by occurred_at desc, id desc limit 1
) telemetry on true
where current_user = 'service_role'
  or (select public.sc_current_app_role()) in ('admin', 'manager', 'operator', 'viewer');

revoke all on public.sc_printer_activity from public, anon, authenticated, service_role;
grant select on public.sc_printer_activity to authenticated, service_role;

commit;
