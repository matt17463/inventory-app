-- Guided Work Hub phase 3: count-checked packing, pickup acknowledgment
-- and explicit source-version review. No Woo, QBO, inventory, or job status writes.

create table if not exists public.sc_job_packing_line_events (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete restrict,
  job_item_id bigint not null references public.job_items(id) on delete restrict,
  packed_quantity integer not null check(packed_quantity between 0 and 100000),
  packaging_note text not null default '' check(char_length(packaging_note)<=1000),
  recorded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists sc_job_packing_job_item_idx on public.sc_job_packing_line_events(job_id,job_item_id,created_at desc,id desc);
alter table public.sc_job_packing_line_events enable row level security;
revoke all on public.sc_job_packing_line_events from public,anon,authenticated;
grant select,insert on public.sc_job_packing_line_events to authenticated;
create policy sc_packing_line_read on public.sc_job_packing_line_events
 for select to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_packing_line_insert on public.sc_job_packing_line_events
 for insert to authenticated with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and recorded_by=(select auth.uid()));

create or replace function public.sc_guard_packing_line_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare item public.job_items%rowtype; job_status text;
begin
 select * into item from public.job_items where id=new.job_item_id and job_id=new.job_id;
 if not found then raise exception 'Packing item does not belong to this job' using errcode='23514'; end if;
 select lower(coalesce(status,'')) into job_status from public.jobs where id=new.job_id;
 if job_status in ('cancelled','canceled') then
  raise exception 'Cancelled jobs cannot be packed' using errcode='23514'; end if;
 if lower(coalesce(item.status,'')) in ('cancelled','canceled','void','voided','removed') then
  raise exception 'Cancelled order lines cannot be packed' using errcode='23514'; end if;
 if new.packed_quantity>coalesce(item.quantity,0) then
  raise exception 'Packing count cannot exceed ordered quantity' using errcode='23514'; end if;
 return new;
end $fn$;
drop trigger if exists sc_guard_packing_line_event on public.sc_job_packing_line_events;
create trigger sc_guard_packing_line_event before insert on public.sc_job_packing_line_events
 for each row execute function public.sc_guard_packing_line_event();

create table if not exists public.sc_job_pickup_acknowledgments (
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null unique references public.jobs(id) on delete restrict,
 recipient_name text not null check(char_length(trim(recipient_name)) between 2 and 120),
 relationship text not null default '' check(char_length(relationship)<=120),
 receipt_statement text not null,
 package_count integer not null check(package_count between 1 and 10000),
 signed_method text not null default 'typed-name' check(signed_method='typed-name'),
 consent_given boolean not null check(consent_given=true),
 signed_at timestamptz not null default now(),
 witnessed_by uuid not null default auth.uid(),
 note text not null default '' check(char_length(note)<=1000)
);
alter table public.sc_job_pickup_acknowledgments enable row level security;
revoke all on public.sc_job_pickup_acknowledgments from public,anon,authenticated;
grant select on public.sc_job_pickup_acknowledgments to authenticated;
create policy sc_pickup_read on public.sc_job_pickup_acknowledgments
 for select to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
-- Writing is via transactional RPC only so the receipt and existing fulfillment event remain consistent.

create or replace function public.sc_record_job_pickup_acknowledgment(
 p_job_id bigint,p_recipient_name text,p_relationship text,p_package_count integer,p_note text,p_consent boolean
) returns uuid
language plpgsql security definer set search_path='' as $fn$
declare j public.jobs%rowtype; qc_passed boolean; v_id uuid; v_actor uuid := auth.uid();
begin
 if not public.sc_internal_access_allowed(array['admin','manager','operator']) then
  raise exception 'Not permitted to record customer pickup' using errcode='42501'; end if;
 if v_actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_consent is distinct from true then raise exception 'Pickup consent is required' using errcode='23514'; end if;
 if char_length(trim(coalesce(p_recipient_name,''))) not between 2 and 120 then
  raise exception 'Recipient must supply full name' using errcode='23514'; end if;
 if p_package_count not between 1 and 10000 then
  raise exception 'Package count must be 1 to 10000' using errcode='23514'; end if;
 select * into j from public.jobs where id=p_job_id for update;
 if not found or lower(coalesce(j.status,'')) in ('cancelled','canceled') then
  raise exception 'Job missing or cancelled' using errcode='23514'; end if;
 if exists (select 1 from public.sc_job_pickup_acknowledgments where job_id=p_job_id) then
  raise exception 'Customer pickup already acknowledged; review existing receipt' using errcode='23505'; end if;
 select passed into qc_passed from public.phase5_qc_checklists
  where job_id=p_job_id order by coalesce(qc_completed_at,created_at) desc,id desc limit 1;
 if qc_passed is distinct from true then
  raise exception 'Latest QC must pass before customer pickup' using errcode='23514'; end if;
 if not exists (
  select 1 from public.job_items i where i.job_id=p_job_id and lower(coalesce(i.status,'')) not in ('cancelled','canceled','void','voided','removed')
 ) then raise exception 'No active job items to acknowledge' using errcode='23514'; end if;
 if exists (
  select 1 from public.job_items i
  left join lateral (
   select packed_quantity from public.sc_job_packing_line_events e where e.job_item_id=i.id and e.job_id=p_job_id
   order by e.created_at desc,e.id desc limit 1
  ) q on true
  where i.job_id=p_job_id and lower(coalesce(i.status,'')) not in ('cancelled','canceled','void','voided','removed')
   and coalesce(q.packed_quantity,-1)<>coalesce(i.quantity,0)
 ) then raise exception 'Every active order line must have exact verified packing count' using errcode='23514'; end if;
 insert into public.sc_job_pickup_acknowledgments (
  job_id,recipient_name,relationship,receipt_statement,package_count,
  consent_given,witnessed_by,note
 ) values (
  p_job_id,trim(p_recipient_name),left(coalesce(p_relationship,''),120),
  'I acknowledge receiving the stated number of packages for this Skilled Crafting job.',
  p_package_count,true,v_actor,left(coalesce(p_note,''),1000)
 ) returning id into v_id;
 insert into public.sc_job_fulfillment_checks(job_id,kind,details,package_count,actor_id)
 values(p_job_id,'picked_up','Pickup acknowledged by recipient: '+trim(p_recipient_name),
        p_package_count,v_actor);
 return v_id;
end $fn$;
revoke all on function public.sc_record_job_pickup_acknowledgment(bigint,text,text,integer,text,boolean)
 from public,anon;
grant execute on function public.sc_record_job_pickup_acknowledgment(bigint,text,text,integer,text,boolean)
 to authenticated;

create table if not exists public.sc_job_artwork_revision_checks (
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 handoff_id uuid not null references public.sc_approval_production_handoffs(id) on delete restrict,
 revision_label text not null check(char_length(trim(revision_label)) between 1 and 120),
 approval_reference text not null check(char_length(trim(approval_reference)) between 3 and 500),
 production_filename text not null default '' check(char_length(production_filename)<=255),
 review_note text not null default '' check(char_length(review_note)<=1000),
 reviewed_by uuid not null default auth.uid(),
 reviewed_at timestamptz not null default now()
);
create index if not exists sc_art_revision_job_idx on public.sc_job_artwork_revision_checks(job_id,reviewed_at desc);
alter table public.sc_job_artwork_revision_checks enable row level security;
revoke all on public.sc_job_artwork_revision_checks from public,anon,authenticated;
grant select,insert on public.sc_job_artwork_revision_checks to authenticated;
create policy sc_art_revision_read on public.sc_job_artwork_revision_checks
 for select to authenticated using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_art_revision_insert on public.sc_job_artwork_revision_checks
 for insert to authenticated with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and reviewed_by=(select auth.uid()));

create or replace function public.sc_guard_art_revision_check()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if not exists(
  select 1 from public.sc_job_artwork_links l
  where l.job_id=new.job_id and l.handoff_id=new.handoff_id
 ) then raise exception 'Link the source artwork handoff to this job first' using errcode='23514'; end if;
 return new;
end $fn$;
drop trigger if exists sc_guard_art_revision_check on public.sc_job_artwork_revision_checks;
create trigger sc_guard_art_revision_check before insert on public.sc_job_artwork_revision_checks
 for each row execute function public.sc_guard_art_revision_check();
