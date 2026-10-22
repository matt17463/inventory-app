-- Owner-first guided job workspace: append-only notes, never a parallel order/status system.
-- Linked to existing authoritative jobs and protected by internal employee roles.
create table if not exists public.sc_job_work_handoffs(
 id uuid primary key default gen_random_uuid(),
 job_id bigint not null references public.jobs(id) on delete restrict,
 kind text not null check (kind in ('next_action','customer_update','production_note','blocker')),
 note text not null check (char_length(trim(note)) between 2 and 2000),
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists sc_job_work_handoffs_job_time_idx
 on public.sc_job_work_handoffs(job_id,created_at desc);

alter table public.sc_job_work_handoffs enable row level security;
revoke all on public.sc_job_work_handoffs from public,anon,authenticated;
grant select,insert on public.sc_job_work_handoffs to authenticated;

create policy sc_job_work_handoff_read on public.sc_job_work_handoffs
 for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer'])));
create policy sc_job_work_handoff_add on public.sc_job_work_handoffs
 for insert to authenticated
 with check ((select public.sc_internal_access_allowed(array['admin','manager','operator']))
   and created_by=(select auth.uid()));

-- Handoff entries are immutable: a new note corrects/updates earlier instructions.
-- App never grants update/delete and no statuses, invoices or inventory balances are mutated.
