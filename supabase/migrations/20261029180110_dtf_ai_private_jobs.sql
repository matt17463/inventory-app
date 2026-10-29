-- Short-lived analysis progress and guidance only. No image bytes or credentials.
create table public.sc_dtf_ai_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null check (length(model) between 1 and 120),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'queued' check (status in ('queued','processing','complete','failed')),
  guidance jsonb check (guidance is null or (jsonb_typeof(guidance)='object' and octet_length(guidance::text)<=64000)),
  provenance jsonb check (provenance is null or (jsonb_typeof(provenance)='object' and octet_length(provenance::text)<=2000)),
  error_code text check (error_code in ('timeout','quota','provider_unavailable','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '5 minutes')
);
create unique index sc_dtf_ai_one_active_job on public.sc_dtf_ai_jobs(user_id)
  where status in ('queued','processing');
create index sc_dtf_ai_jobs_expires_idx on public.sc_dtf_ai_jobs(expires_at);
alter table public.sc_dtf_ai_jobs enable row level security;
revoke all on public.sc_dtf_ai_jobs from public, anon, authenticated;
grant select(id,user_id,status,guidance,provenance,error_code,created_at,expires_at) on public.sc_dtf_ai_jobs to authenticated;
grant select,insert,update,delete on public.sc_dtf_ai_jobs to service_role;
create policy "Employees read only their unexpired DTF analysis"
 on public.sc_dtf_ai_jobs for select to authenticated
 using (user_id=(select auth.uid()) and expires_at>now()
   and (select public.sc_current_app_role()) in ('admin','manager','operator'));
comment on table public.sc_dtf_ai_jobs is
 'Private temporary DTF analysis progress and validated guidance. No image bytes. Five-minute logical expiry; expired rows are purged at the next analysis request. Only server functions can mutate rows.';
