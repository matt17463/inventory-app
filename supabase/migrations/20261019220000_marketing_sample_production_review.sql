-- Manager authorization for marketing sample requests. No stock movement is performed.
alter table public.sc_growth_samples
 add column if not exists production_review_status text not null default 'pending'
   check (production_review_status in ('pending','approved','rejected')),
 add column if not exists production_review_note text,
 add column if not exists production_reviewed_by uuid references auth.users(id),
 add column if not exists production_reviewed_at timestamptz;
create or replace function public.sc_growth_review_sample_v1(
 p_sample_id uuid, p_decision text, p_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sc_growth_samples;
begin
 perform public.sc_require_internal_access(array['admin','manager']);
 if p_decision not in ('approved','rejected') then raise exception 'Choose approve or reject.'; end if;
 if p_decision='rejected' and nullif(btrim(p_note),'') is null then raise exception 'Explain why the sample is rejected.'; end if;
 select * into s from public.sc_growth_samples where id=p_sample_id for update;
 if s.id is null then raise exception 'Sample not found.'; end if;
 if s.production_review_status <> 'pending' then raise exception 'Sample already reviewed. Create another request for changes.'; end if;
 update public.sc_growth_samples
 set production_review_status=p_decision, production_review_note=nullif(btrim(p_note),''),
     production_reviewed_by=auth.uid(),production_reviewed_at=now()
 where id=s.id;
 if p_decision='approved' then
   insert into public.sc_growth_tasks(opportunity_id,task_key,title,department,status,notes)
   values(s.opportunity_id,'sample-production-'||s.id::text,
     'Review and create production job for marketing sample: '||s.description,'production','open',
     'Approved marketing sample '||s.id::text||'; quantity '||s.quantity||
     '. A production operator must verify blank/style/color, decoration, artwork and stock before creating any job.')
   on conflict(opportunity_id,task_key) do nothing;
 end if;
 return jsonb_build_object('sample_id',s.id,'decision',p_decision,'production_job_created',false);
end $$;
revoke all on function public.sc_growth_review_sample_v1(uuid,text,text) from public,anon;
grant execute on function public.sc_growth_review_sample_v1(uuid,text,text) to authenticated,service_role;

-- Prevent a direct table update from bypassing manager review or modifying final decisions.
create function sc_internal.sc_growth_sample_review_guard_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   if new.production_review_status<>'pending' or new.production_reviewed_by is not null
     or new.production_reviewed_at is not null then raise exception 'New sample requests start pending.';end if;
 elsif new.production_review_status is distinct from old.production_review_status
   or new.production_review_note is distinct from old.production_review_note
   or new.production_reviewed_by is distinct from old.production_reviewed_by
   or new.production_reviewed_at is distinct from old.production_reviewed_at then
   perform public.sc_require_internal_access(array['admin','manager']);
   if old.production_review_status <> 'pending' then raise exception 'Reviewed sample decisions cannot be changed.';end if;
 end if;
 return new;
end $$;
revoke all on function sc_internal.sc_growth_sample_review_guard_v1() from public,anon,authenticated;
create trigger sc_growth_sample_review_guard before insert or update on public.sc_growth_samples
for each row execute function sc_internal.sc_growth_sample_review_guard_v1();
