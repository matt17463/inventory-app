-- External marketing review: hashed one-time-capability token, never public table access.
create table public.sc_growth_document_reviews (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.sc_growth_documents(id),
 token_hash text not null unique,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 decision text check(decision in ('approved','changes_requested')),
 feedback text,
 responded_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index sc_growth_document_reviews_document on public.sc_growth_document_reviews(document_id);
alter table public.sc_growth_document_reviews enable row level security;
revoke all on public.sc_growth_document_reviews from public,anon,authenticated;
grant all on public.sc_growth_document_reviews to service_role;
-- Reviews are only handled by dedicated authenticated or token-validating server functions.
