-- Work Hub step annotations. These are NOT production approvals or job statuses.
create table if not exists public.sc_workhub_step_reviews (
 job_id bigint not null references public.jobs(id) on delete cascade,
 step_id text not null check(step_id in ('order','artwork','stock','recipe','production','qc','delivery')),
 review_state text not null check(review_state in ('review','in_progress','blocked','not_applicable')),
 reason text not null check(length(trim(reason)) between 8 and 1000),
 reviewed_by uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now(),
 primary key(job_id,step_id)
);
alter table public.sc_workhub_step_reviews enable row level security;
revoke all on public.sc_workhub_step_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.sc_workhub_step_reviews to service_role;
create or replace function public.sc_set_workhub_step_review(p_job_id bigint,p_step_id text,p_state text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.sc_app_user_roles where user_id=v_actor and is_active and role in ('admin','manager'))
 then raise exception 'Manager access required' using errcode='42501';end if;
 if p_step_id not in ('order','artwork','stock','recipe','production','qc','delivery') or
 p_state not in ('review','in_progress','blocked','not_applicable') then raise exception 'Unsupported step review'; end if;
 if p_state='not_applicable' and p_step_id not in ('artwork','stock','recipe') then raise exception 'This step cannot be bypassed';end if;
 if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>1000 then raise exception 'Provide a meaningful reason (8–1000 characters)';end if;
 if not exists(select 1 from public.jobs where id=p_job_id)then raise exception 'Unknown production job';end if;
 insert into public.sc_workhub_step_reviews(job_id,step_id,review_state,reason,reviewed_by)
 values(p_job_id,p_step_id,p_state,trim(p_reason),v_actor)
 on conflict(job_id,step_id)do update set review_state=excluded.review_state,reason=excluded.reason,reviewed_by=excluded.reviewed_by,reviewed_at=now();
end $$;
revoke all on function public.sc_set_workhub_step_review(bigint,text,text,text) from public,anon;
grant execute on function public.sc_set_workhub_step_review(bigint,text,text,text) to authenticated;
create or replace function public.sc_get_workhub_step_reviews(p_job_id bigint)
returns table(step_id text,review_state text,reason text,reviewed_at timestamptz)
language sql security definer set search_path='' as $$
 select r.step_id,r.review_state,r.reason,r.reviewed_at
 from public.sc_workhub_step_reviews r where r.job_id=p_job_id
 and auth.uid() is not null
 and exists(select 1 from public.sc_app_user_roles x where x.user_id=auth.uid() and x.is_active);
$$;
revoke all on function public.sc_get_workhub_step_reviews(bigint) from public,anon;
grant execute on function public.sc_get_workhub_step_reviews(bigint) to authenticated;
