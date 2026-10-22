-- Owner-first job closeout: verified carrier delivery and auditable manual
-- customer communications. No payment, Woo, QuickBooks, or job status mutations.
create table if not exists public.sc_job_delivery_confirmations(
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 proof_type text not null check(proof_type in ('carrier_delivery_record','customer_delivery_confirmation')),
 proof_reference text not null check(char_length(btrim(proof_reference)) between 5 and 500),
 note text not null default '' check(char_length(note)<=1500),
 verified_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists sc_job_delivery_confirmations_job_idx on public.sc_job_delivery_confirmations(job_id,created_at desc);
alter table public.sc_job_delivery_confirmations enable row level security;
revoke all on public.sc_job_delivery_confirmations from public,anon,authenticated;
grant select,insert on public.sc_job_delivery_confirmations to authenticated;
create policy sc_job_delivery_read on public.sc_job_delivery_confirmations for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_job_delivery_insert on public.sc_job_delivery_confirmations for insert to authenticated
 with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
 and verified_by=(select auth.uid()));

create or replace function public.sc_guard_delivery_confirmation()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_job_status text; v_qc_passed boolean; v_match boolean;
begin
 select lower(coalesce(status,'')) into v_job_status from public.jobs where id=new.job_id;
 if not found or v_job_status in ('cancelled','canceled') then
  raise exception 'Job missing or cancelled' using errcode='23514';end if;
 select passed into v_qc_passed from public.phase5_qc_checklists
  where job_id=new.job_id order by coalesce(qc_completed_at,created_at) desc,id desc limit 1;
 if v_qc_passed is distinct from true then
  raise exception 'A passing latest QC inspection is required' using errcode='23514';end if;
 if not exists(select 1 from public.sc_job_fulfillment_checks where job_id=new.job_id
   and kind='shipped' and nullif(btrim(coalesce(carrier_reference,'')),'') is not null) then
  raise exception 'Record actual carrier dispatch and reference before confirming delivery' using errcode='23514';end if;
 if exists(
  select 1 from public.job_items i
  left join lateral(
   select e.packed_quantity from public.sc_job_packing_line_events e
    where e.job_id=new.job_id and e.job_item_id=i.id
    order by e.created_at desc,e.id desc limit 1
  ) p on true
  where i.job_id=new.job_id and lower(coalesce(i.status,'')) not in ('cancelled','canceled','void','voided','removed')
   and coalesce(p.packed_quantity,-1)<>coalesce(i.quantity,0)
 ) or not exists(
   select 1 from public.job_items i where i.job_id=new.job_id
   and lower(coalesce(i.status,'')) not in ('cancelled','canceled','void','voided','removed')
 ) then raise exception 'Complete exact item-level packing before confirming delivery' using errcode='23514';end if;
 return new;
end $fn$;
drop trigger if exists sc_guard_delivery_confirmation on public.sc_job_delivery_confirmations;
create trigger sc_guard_delivery_confirmation before insert on public.sc_job_delivery_confirmations
 for each row execute function public.sc_guard_delivery_confirmation();
revoke all on function public.sc_guard_delivery_confirmation() from public,anon,authenticated;

-- Immutable operator email queue. "marked_sent" is an assertion that a human
-- actually dispatched it outside this app; the app never transmits an email.
create table if not exists public.sc_job_customer_messages(
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 event_type text not null check(event_type in ('ready_for_pickup','shipped','pickup_complete','delivery_followup')),
 state text not null check(state in ('draft','marked_sent')),
 recipient_email text not null check(char_length(recipient_email) between 5 and 254
  and recipient_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 subject text not null check(char_length(btrim(subject)) between 5 and 240),
 message_body text not null check(char_length(btrim(message_body)) between 10 and 5000),
 source_draft_id uuid references public.sc_job_customer_messages(id) on delete restrict,
 recorded_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 constraint sc_message_state_source check(
  (state='draft' and source_draft_id is null) or
  (state='marked_sent' and source_draft_id is not null))
);
create unique index if not exists sc_customer_message_once_idx on public.sc_job_customer_messages(source_draft_id)
 where state='marked_sent';
create index if not exists sc_customer_message_job_idx on public.sc_job_customer_messages(job_id,created_at desc);
alter table public.sc_job_customer_messages enable row level security;
revoke all on public.sc_job_customer_messages from public,anon,authenticated;
grant select,insert on public.sc_job_customer_messages to authenticated;
create policy sc_customer_message_read on public.sc_job_customer_messages for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager'])));
create policy sc_customer_message_insert on public.sc_job_customer_messages for insert to authenticated
 with check ((select public.sc_internal_access_allowed(array['admin','manager']))
 and recorded_by=(select auth.uid()));

create or replace function public.sc_guard_customer_message()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare origin public.sc_job_customer_messages%rowtype; v_qc boolean;
begin
 if new.state='marked_sent' then
  select * into origin from public.sc_job_customer_messages where id=new.source_draft_id;
  if not found or origin.state<>'draft' or origin.job_id<>new.job_id
   or origin.event_type<>new.event_type
   or origin.recipient_email<>new.recipient_email
   or origin.subject<>new.subject or origin.message_body<>new.message_body then
    raise exception 'Sent confirmation must match its unchanged original draft' using errcode='23514';
  end if;
  -- Sent state is a manual audit entry, never network evidence.
 end if;
 return new;
end $fn$;
drop trigger if exists sc_guard_customer_message on public.sc_job_customer_messages;
create trigger sc_guard_customer_message before insert on public.sc_job_customer_messages
 for each row execute function public.sc_guard_customer_message();
revoke all on function public.sc_guard_customer_message() from public,anon,authenticated;
