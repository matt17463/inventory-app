-- Record genuine approval received outside the customer portal without
-- fabricating a customer login, review token, or customer-authored decision.
-- Do not migrate an active certificate's provenance format without scoped review.
-- This rollout is permitted only while the live certificate ledger is empty.
do $$ begin
 if exists(select 1 from public.sc_variation_certifications where status='certified') then
  raise exception 'Active certificates require a separately reviewed provenance migration; no changes applied';
 end if;
end $$;
create table public.sc_external_mockup_approvals (
 id uuid primary key default gen_random_uuid(),
 output_id uuid not null references public.mockup_outputs(id) on delete restrict,
 approving_party text not null check(length(trim(approving_party))>=3),
 evidence_reference text not null check(length(trim(evidence_reference))>=12),
 decision text not null check(decision in ('approved','withdrawn')),
 note text not null check(length(trim(note))>=12),
 recorded_by uuid not null default auth.uid(),
 recorded_at timestamptz not null default clock_timestamp(),
 source_kind text not null default 'manager_recorded_external_approval' check(source_kind='manager_recorded_external_approval')
);
create index sc_external_approval_output on public.sc_external_mockup_approvals(output_id,recorded_at desc,id desc);
alter table public.sc_external_mockup_approvals enable row level security;
revoke all on public.sc_external_mockup_approvals from public,anon,authenticated,service_role;
grant select on public.sc_external_mockup_approvals to authenticated,service_role;
create policy employee_read on public.sc_external_mockup_approvals for select to authenticated
 using(public.sc_internal_access_allowed(array['admin','manager','operator','viewer']));
create trigger immutable_external_approval before update or delete on public.sc_external_mockup_approvals
 for each row execute function sc_certification.immutable_artwork_revision();
create trigger sc_certification_source_lock before insert on public.sc_external_mockup_approvals
 for each statement execute function sc_certification.lock_sources();

create function public.sc_record_external_mockup_approval(p_output uuid,p_party text,p_reference text,p_decision text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not public.sc_internal_access_allowed(array['admin','manager']) then raise exception 'Manager access required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(17463,20261027);
 insert into public.sc_external_mockup_approvals(output_id,approving_party,evidence_reference,decision,note)
 values(p_output,trim(p_party),trim(p_reference),p_decision,trim(p_note)) returning id into result;
 insert into public.sc_certification_audit(kind,reason,source_table,details)
 values('external_approval_recorded',p_note,'sc_external_mockup_approvals',jsonb_build_object('evidence_id',result,'output_id',p_output,'party',p_party,'decision',p_decision,'reference',p_reference));
 return result;
end $$;
revoke all on function public.sc_record_external_mockup_approval(uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.sc_record_external_mockup_approval(uuid,text,text,text,text) to authenticated;

alter function sc_certification.evaluate(uuid) rename to evaluate_before_external_approval;
create function sc_certification.evaluate(p_configuration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb; e jsonb; blockers jsonb; snap jsonb; proofs jsonb='[]';
 external public.sc_external_mockup_approvals%rowtype; prefix text; native_time timestamptz; source_time timestamptz;
begin
 v=sc_certification.evaluate_before_external_approval(p_configuration);blockers=v->'blockers';snap=v->'snapshot';
 for e in select value from jsonb_array_elements(coalesce(snap->'placements','[]')) loop
  select * into external from public.sc_external_mockup_approvals where output_id=(e->'output'->>'id')::uuid order by recorded_at desc,id desc limit 1;
  native_time=(e->'customer_review'->>'created_at')::timestamptz;
  if external.id is not null and (native_time is null or external.recorded_at>native_time) then
   prefix='Placement '||(e->>'position')||': ';
   proofs=proofs||jsonb_build_array(to_jsonb(external));
   source_time=greatest((e->'artwork'->>'updated_at')::timestamptz,(e->'placement'->>'updated_at')::timestamptz,
    (e->'mockup_blank'->>'updated_at')::timestamptz,(e->'output'->>'updated_at')::timestamptz);
   if external.decision='approved' and external.recorded_at>=source_time then
    select coalesce(jsonb_agg(value),'[]') into blockers from jsonb_array_elements(blockers)
     where value<>to_jsonb(prefix||'missing or withdrawn customer approval') and value<>to_jsonb(prefix||'customer approval is stale after evidence changes');
   else
    blockers=blockers||jsonb_build_array(prefix||'external customer approval is withdrawn or stale');
   end if;
  end if;
 end loop;
 snap=snap||jsonb_build_object('external_customer_approval_evidence',proofs);
 return v||jsonb_build_object('ready',jsonb_array_length(blockers)=0,'blockers',blockers,'snapshot',snap,'fingerprint',md5(snap::text));
end $$;
revoke all on function sc_certification.evaluate(uuid),sc_certification.evaluate_before_external_approval(uuid) from public,anon,authenticated,service_role;
create trigger sc_certification_source_revalidate after insert on public.sc_external_mockup_approvals
 for each statement execute function sc_certification.revalidate_sources();
