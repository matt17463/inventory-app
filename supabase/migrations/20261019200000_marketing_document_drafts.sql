-- Draft marketing documents are private to authenticated staff until approved.
create table if not exists public.sc_growth_documents (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.sc_growth_accounts(id),
 template_id text not null check(length(template_id) between 1 and 80),
 title text not null check(length(btrim(title)) between 1 and 200),
 version integer not null default 1 check(version>0),
 status text not null default 'draft' check(status in ('draft','approved','retired')),
 content jsonb not null default '{}'::jsonb,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 approved_by uuid references auth.users(id),
 approved_at timestamptz
);
create index if not exists sc_growth_documents_client on public.sc_growth_documents(account_id,created_at desc);
alter table public.sc_growth_documents enable row level security;
revoke all on public.sc_growth_documents from public,anon,authenticated;
grant select,insert,update on public.sc_growth_documents to authenticated;
grant all on public.sc_growth_documents to service_role;
create policy growth_docs_read on public.sc_growth_documents for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','viewer','marketing'])));
create policy growth_docs_write on public.sc_growth_documents for insert to authenticated
 with check ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])) and created_by=(select auth.uid()) and status='draft');
create policy growth_docs_update on public.sc_growth_documents for update to authenticated
 using (status='draft' and (select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])))
 with check (status='draft' and (select public.sc_internal_access_allowed(array['admin','manager','operator','marketing'])));
-- Prevent direct manipulation of approvals and immutable historical identity.
create function sc_internal.sc_growth_document_guard_v1() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.status<>'draft' then raise exception 'Approved documents are immutable; create a new version.'; end if;
  if new.id<>old.id or new.account_id<>old.account_id or new.created_by<>old.created_by
     or new.created_at<>old.created_at or new.version<>old.version
     or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at
  then raise exception 'Protected document fields cannot be modified.';end if;
 end if;
 if new.status<>'draft' or new.approved_by is not null or new.approved_at is not null
  then raise exception 'Use an authorized approval workflow.';end if;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
revoke all on function sc_internal.sc_growth_document_guard_v1() from public,anon,authenticated;
create trigger sc_growth_document_guard before insert or update on public.sc_growth_documents
for each row execute function sc_internal.sc_growth_document_guard_v1();
