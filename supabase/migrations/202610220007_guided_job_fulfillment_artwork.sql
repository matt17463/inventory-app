-- Phase two: approved artwork linkage and private packing/fulfillment evidence.
create table if not exists public.sc_job_fulfillment_checks (
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 kind text not null check(kind in ('packing_checked','ready_for_pickup','picked_up','shipped','delivery_exception')),
 details text not null check(char_length(trim(details)) between 2 and 2000),
 package_count integer check(package_count between 1 and 10000),
 carrier_reference text,
 actor_id uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists sc_job_fulfillment_checks_job_idx on public.sc_job_fulfillment_checks(job_id,created_at desc);
alter table public.sc_job_fulfillment_checks enable row level security;
revoke all on public.sc_job_fulfillment_checks from public,anon,authenticated;
grant select,insert on public.sc_job_fulfillment_checks to authenticated;
create policy sc_job_fulfillment_read on public.sc_job_fulfillment_checks for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_job_fulfillment_insert on public.sc_job_fulfillment_checks for insert to authenticated
 with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and actor_id=(select auth.uid()));
-- Existing approval handoffs are authoritative: this additional link is explicit and reviewable.
create table if not exists public.sc_job_artwork_links (
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 handoff_id uuid not null references public.sc_approval_production_handoffs(id) on delete restrict,
 linked_by uuid not null default auth.uid(),
 linked_at timestamptz not null default now(),
 unique(job_id,handoff_id)
);
create index if not exists sc_job_artwork_links_job_idx on public.sc_job_artwork_links(job_id);
alter table public.sc_job_artwork_links enable row level security;
revoke all on public.sc_job_artwork_links from public,anon,authenticated;
grant select,insert on public.sc_job_artwork_links to authenticated;
create policy sc_job_artwork_links_read on public.sc_job_artwork_links for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_job_artwork_links_insert on public.sc_job_artwork_links for insert to authenticated
 with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and linked_by=(select auth.uid()));
