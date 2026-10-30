-- Additive source registry and page-level searchable chunks for approved business manuals.
-- All writes occur in authenticated server workflows; anonymous Data API access is denied.
create table if not exists public.sc_knowledge_sources (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique check(length(source_key) between 6 and 900),
 title text not null check(length(btrim(title)) between 2 and 240),
 category text not null default 'machine manual' check(length(category) between 1 and 80),
 object_etag text,
 sha256 text,
 bytes bigint not null default 0 check(bytes between 0 and 104857600),
 page_count integer not null default 0 check(page_count between 0 and 2500),
 status text not null default 'pending' check(status in ('pending','indexing','indexed','needs_ocr','error')),
 error_message text check(error_message is null or length(error_message)<=500),
 source_kind text not null default 'r2_pdf' check(source_kind in ('r2_pdf','nas_mirror')),
 indexed_at timestamptz,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table if not exists public.sc_knowledge_chunks (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.sc_knowledge_sources(id) on delete cascade,
 page_number integer not null check(page_number between 1 and 2500),
 chunk_number integer not null check(chunk_number between 1 and 10000),
 content text not null check(length(content) between 1 and 3500),
 search_vector tsvector generated always as (to_tsvector('english'::regconfig,content)) stored,
 unique(source_id,page_number,chunk_number)
);
create index if not exists sc_knowledge_chunks_fts_idx on public.sc_knowledge_chunks using gin(search_vector);
create index if not exists sc_knowledge_chunks_parent_idx on public.sc_knowledge_chunks(source_id,page_number);
create index if not exists sc_knowledge_sources_status_idx on public.sc_knowledge_sources(status,updated_at desc);
alter table public.sc_knowledge_sources enable row level security;
alter table public.sc_knowledge_chunks enable row level security;
revoke all on public.sc_knowledge_sources from anon, authenticated;
revoke all on public.sc_knowledge_chunks from anon, authenticated;
grant select on public.sc_knowledge_sources,public.sc_knowledge_chunks to authenticated;
drop policy if exists sc_knowledge_sources_staff on public.sc_knowledge_sources;
create policy sc_knowledge_sources_staff on public.sc_knowledge_sources for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing','viewer']::text[])));
drop policy if exists sc_knowledge_chunks_staff on public.sc_knowledge_chunks;
create policy sc_knowledge_chunks_staff on public.sc_knowledge_chunks for select to authenticated
 using ((select public.sc_internal_access_allowed(array['admin','manager','operator','marketing','viewer']::text[]))
   and exists (select 1 from public.sc_knowledge_sources s where s.id=source_id and s.status='indexed'));
