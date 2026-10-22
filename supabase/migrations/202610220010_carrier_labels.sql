-- Carrier shipping labels: postage purchase is a financial transaction, never
-- equivalent to printing internal QR package labels or carrier dispatch.
create table if not exists public.sc_carrier_label_jobs(
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 package_index integer not null check(package_index between 1 and 100),
 mode text not null check(mode in ('test','production')),
 state text not null check(state in ('quoted','purchasing','purchased','purchase_unknown')),
 provider text not null default 'easypost' check(provider='easypost'),
 provider_shipment_id text not null check(char_length(provider_shipment_id) between 5 and 100),
 rate_options jsonb not null default '[]'::jsonb,
 selected_rate_id text,
 carrier text,
 service text,
 amount_usd numeric(10,2),
 quote_expires_at timestamptz not null,
 destination jsonb not null,
 parcel jsonb not null,
 label_url text,
 tracking_code text,
 carrier_account_id text,
 quoted_by uuid not null,
 purchased_by uuid,
 quoted_at timestamptz not null default now(),
 purchase_started_at timestamptz,
 purchased_at timestamptz,
 last_error text,
 updated_at timestamptz not null default now(),
 unique(job_id,package_index)
);
create index if not exists sc_carrier_label_jobs_job_idx on public.sc_carrier_label_jobs(job_id,package_index);
alter table public.sc_carrier_label_jobs enable row level security;
revoke all on public.sc_carrier_label_jobs from public,anon,authenticated;
grant select on public.sc_carrier_label_jobs to authenticated;
create policy sc_carrier_label_read on public.sc_carrier_label_jobs
 for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager'])));
-- No browser write grants. Quote, buy and recovery use server-only service credentials.
