-- New additive staff-only document library. No existing table modifications.
create table if not exists public.sc_creative_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 180),
  body text not null check (length(btrim(body)) between 1 and 100000),
  category text not null default 'general' check (length(category) between 1 and 80),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig,coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english'::regconfig,coalesce(category,'')), 'B') ||
    setweight(to_tsvector('english'::regconfig,coalesce(body,'')), 'C')
  ) stored
);
create index if not exists sc_creative_knowledge_documents_search_idx
  on public.sc_creative_knowledge_documents using gin(search_vector);
create index if not exists sc_creative_knowledge_documents_updated_idx
  on public.sc_creative_knowledge_documents(updated_at desc);
alter table public.sc_creative_knowledge_documents enable row level security;
revoke all on public.sc_creative_knowledge_documents from anon;
grant select, insert, update, delete on public.sc_creative_knowledge_documents to authenticated;
drop policy if exists sc_knowledge_staff_read on public.sc_creative_knowledge_documents;
create policy sc_knowledge_staff_read on public.sc_creative_knowledge_documents
  for select to authenticated
  using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing','viewer']::text[])));
drop policy if exists sc_knowledge_editor_insert on public.sc_creative_knowledge_documents;
create policy sc_knowledge_editor_insert on public.sc_creative_knowledge_documents
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select public.sc_internal_access_allowed(array['admin','manager']::text[]))
  );
drop policy if exists sc_knowledge_editor_update on public.sc_creative_knowledge_documents;
create policy sc_knowledge_editor_update on public.sc_creative_knowledge_documents
  for update to authenticated
  using ((select public.sc_internal_access_allowed(array['admin','manager']::text[])))
  with check (
    created_by = (select auth.uid())
    and (select public.sc_internal_access_allowed(array['admin','manager']::text[]))
  );
drop policy if exists sc_knowledge_editor_delete on public.sc_creative_knowledge_documents;
create policy sc_knowledge_editor_delete on public.sc_creative_knowledge_documents
  for delete to authenticated
  using ((select public.sc_internal_access_allowed(array['admin','manager']::text[])));
