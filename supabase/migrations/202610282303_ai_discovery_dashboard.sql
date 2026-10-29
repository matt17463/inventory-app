-- AI Product Discovery: a reviewed lead generator, never an automatic production approval.
-- The server-side OpenAI key and supplier credentials are NEVER stored here.
create table if not exists public.sc_pdc_discovery_runs (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null default auth.uid() references auth.users(id),
 focus text not null default 'all' check(focus in ('all','weddings','coaches','business','gifts')),
 requested_count integer not null default 12 check(requested_count between 4 and 16),
 status text not null default 'queued' check(status in ('queued','running','completed','partial','failed')),
 requested_at timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz,
 total_found integer not null default 0 check(total_found between 0 and 16),
 saved_count integer not null default 0 check(saved_count between 0 and 16),
 duplicate_count integer not null default 0 check(duplicate_count between 0 and 16),
 crm_signals jsonb not null default '{}'::jsonb check(jsonb_typeof(crm_signals)='object'),
 supplier_signals jsonb not null default '{}'::jsonb check(jsonb_typeof(supplier_signals)='object'),
 message text not null default '' check(length(message)<=2000)
);
create index if not exists sc_pdc_discovery_runs_latest on public.sc_pdc_discovery_runs(requested_at desc);
alter table public.sc_pdc_discovery_runs enable row level security;
revoke all on public.sc_pdc_discovery_runs from anon, authenticated;
grant select,insert on public.sc_pdc_discovery_runs to authenticated;
create policy sc_pdc_discovery_runs_staff_read on public.sc_pdc_discovery_runs
 for select to authenticated
 using (public.sc_current_app_role() in ('admin','manager','marketing'));
create policy sc_pdc_discovery_runs_staff_insert on public.sc_pdc_discovery_runs
 for insert to authenticated
 with check (
   created_by=(select auth.uid()) and
   status='queued' and
   total_found=0 and saved_count=0 and duplicate_count=0 and
   started_at is null and finished_at is null and
   crm_signals='{}'::jsonb and supplier_signals='{}'::jsonb and
   message='' and public.sc_current_app_role() in ('admin','manager','marketing')
 );
-- Authenticated employees cannot update run progress or impersonate a completed AI run.
alter table public.sc_pdc_opportunities
 add column if not exists discovery_run_id uuid references public.sc_pdc_discovery_runs(id) on delete set null,
 add column if not exists discovery_evidence jsonb not null default '{}'::jsonb;
alter table public.sc_pdc_opportunities
 add constraint sc_pdc_discovery_evidence_is_object check(jsonb_typeof(discovery_evidence)='object');
create index if not exists sc_pdc_opportunities_discovery on public.sc_pdc_opportunities(discovery_run_id)
 where discovery_run_id is not null;
