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


-- Existing USPS Click-N-Ship is a manual alternative to avoid duplicate postage;
-- a Click-N-Ship website login alone is NOT an API authentication credential.
create table if not exists public.sc_external_usps_labels (
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 package_index integer not null check(package_index between 1 and 100),
 source text not null default 'usps_click_n_ship' check(source='usps_click_n_ship'),
 tracking_code text not null check(char_length(btrim(tracking_code)) between 10 and 45),
 label_reference text not null check(char_length(btrim(label_reference)) between 3 and 180),
 cost_usd numeric(10,2) check(cost_usd between 0 and 2000),
 note text not null default '' check(char_length(note)<=700),
 recorded_by uuid not null,
 recorded_at timestamptz not null default now(),
 unique(job_id,package_index),
 unique(tracking_code)
);
create index if not exists sc_external_usps_labels_job_idx on public.sc_external_usps_labels(job_id);
alter table public.sc_external_usps_labels enable row level security;
revoke all on public.sc_external_usps_labels from public,anon,authenticated;
grant select on public.sc_external_usps_labels to authenticated;
create policy sc_external_usps_labels_read on public.sc_external_usps_labels
 for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager'])));
-- No browser mutation permissions: Netlify manager-authenticated function records it.


-- Serialize same package writes across the two billing paths, even if two
-- staff members submit at once. Recording USPS separately is allowed while
-- an unused EasyPost quote exists, but never during or after an API purchase.
create or replace function public.sc_guard_easypost_label_duplicates()
returns trigger language plpgsql security definer set search_path='' as $sc$
begin
 perform pg_advisory_xact_lock(hashtextextended('sc-shipping-label:'||new.job_id||':'||new.package_index,0));
 if exists(select 1 from public.sc_external_usps_labels x
  where x.job_id=new.job_id and x.package_index=new.package_index) then
  raise exception 'USPS Click-N-Ship label already recorded for this package; do not purchase twice' using errcode='23505';
 end if;
 return new;
end $sc$;
drop trigger if exists sc_guard_easypost_label_duplicates on public.sc_carrier_label_jobs;
create trigger sc_guard_easypost_label_duplicates before insert or update of state
 on public.sc_carrier_label_jobs for each row execute function public.sc_guard_easypost_label_duplicates();

create or replace function public.sc_guard_external_usps_label_duplicates()
returns trigger language plpgsql security definer set search_path='' as $sc$
begin
 perform pg_advisory_xact_lock(hashtextextended('sc-shipping-label:'||new.job_id||':'||new.package_index,0));
 if exists(select 1 from public.sc_carrier_label_jobs x
  where x.job_id=new.job_id and x.package_index=new.package_index and x.state<>'quoted') then
  raise exception 'EasyPost postage already purchased or unresolved; reconcile it before recording USPS postage' using errcode='23505';
 end if;
 return new;
end $sc$;
drop trigger if exists sc_guard_external_usps_label_duplicates on public.sc_external_usps_labels;
create trigger sc_guard_external_usps_label_duplicates before insert
 on public.sc_external_usps_labels for each row execute function public.sc_guard_external_usps_label_duplicates();
