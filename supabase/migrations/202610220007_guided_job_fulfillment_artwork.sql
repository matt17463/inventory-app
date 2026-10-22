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

-- Prevent false delivery-complete evidence in the database, not only the UI.
create or replace function public.sc_guard_job_fulfillment_check()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_job_status text; v_qc_passed boolean;
begin
 select lower(coalesce(status,'')) into v_job_status from public.jobs where id=new.job_id;
 if not found then raise exception 'Unknown production job' using errcode='23503'; end if;
 if v_job_status in ('cancelled','canceled') and new.kind<>'delivery_exception'
 then raise exception 'Cancelled jobs cannot be marked packed or delivered' using errcode='23514'; end if;
 if new.kind in ('ready_for_pickup','picked_up','shipped') then
  select passed into v_qc_passed from public.phase5_qc_checklists
   where job_id=new.job_id order by coalesce(qc_completed_at,created_at) desc,id desc limit 1;
  if coalesce(v_qc_passed,false)=false then
   raise exception 'Latest authoritative QC must pass before pickup or shipping' using errcode='23514';
  end if;
 end if;
 return new;
end $fn$;
drop trigger if exists sc_guard_job_fulfillment_check on public.sc_job_fulfillment_checks;
create trigger sc_guard_job_fulfillment_check before insert on public.sc_job_fulfillment_checks
 for each row execute function public.sc_guard_job_fulfillment_check();

-- Do not link an unrelated or file-less handoff as production artwork.
create or replace function public.sc_guard_job_artwork_link()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_handoff public.sc_approval_production_handoffs%rowtype;
begin
 select * into v_handoff from public.sc_approval_production_handoffs where id=new.handoff_id;
 if not found or nullif(btrim(coalesce(v_handoff.approved_file_url,'')),'') is null then
  raise exception 'A handoff with a production artwork file is required' using errcode='23514';
 end if;
 if nullif(trim(coalesce(v_handoff.production_job_id,'')),'') is not null
    and v_handoff.production_job_id<>new.job_id::text then
   raise exception 'This artwork handoff is linked to a different production job' using errcode='23514';
 end if;
 return new;
end $fn$;
drop trigger if exists sc_guard_job_artwork_link on public.sc_job_artwork_links;
create trigger sc_guard_job_artwork_link before insert on public.sc_job_artwork_links
 for each row execute function public.sc_guard_job_artwork_link();
