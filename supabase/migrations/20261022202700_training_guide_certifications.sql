-- Central training progress and manager qualification signoff.
-- All tables are service-role-only; Netlify verifies active Supabase users and their
-- sc_app_user_roles before any row access. No production jobs, Woo, or stock writes.
create table if not exists public.sc_training_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 tutorial_id text not null check (length(tutorial_id) between 1 and 120 and tutorial_id ~ '^[a-zA-Z0-9_-]+$'),
 curriculum_version text not null check (length(curriculum_version) between 1 and 30),
 completed_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(completed_steps)='array' and pg_column_size(completed_steps)<=4096),
 completed boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (user_id,tutorial_id)
);
create index if not exists sc_training_progress_updated_idx on public.sc_training_progress(updated_at desc);
alter table public.sc_training_progress enable row level security;
revoke all on public.sc_training_progress from public,anon,authenticated;
grant select,insert,update,delete on public.sc_training_progress to service_role;

create table if not exists public.sc_training_certifications (
 user_id uuid not null references auth.users(id) on delete cascade,
 tutorial_id text not null check (length(tutorial_id) between 1 and 120),
 curriculum_version text not null check (length(curriculum_version) between 1 and 30),
 signed_off_by uuid not null references auth.users(id) on delete restrict,
 signed_off_at timestamptz not null default now(),
 manager_note text not null default '' check (length(manager_note)<=1000),
 primary key (user_id,tutorial_id)
);
create index if not exists sc_training_certifications_manager_idx on public.sc_training_certifications(signed_off_by,signed_off_at desc);
alter table public.sc_training_certifications enable row level security;
revoke all on public.sc_training_certifications from public,anon,authenticated;
grant select,insert,update,delete on public.sc_training_certifications to service_role;

-- QA triage notes are never treated as independent live verification.
-- Validated browser evidence and source registry updates require separate code review.
create table if not exists public.sc_documentation_qa_reviews (
 target_type text not null check (target_type in ('wordpress-plugin','conditional-dialog','application-route')),
 target_id text not null check (length(target_id) between 1 and 200),
 review_state text not null default 'needs-review' check (review_state in ('needs-review','in-progress','evidence-captured','blocked')),
 evidence_reference text not null default '' check (length(evidence_reference)<=500),
 reviewer_note text not null default '' check (length(reviewer_note)<=2000),
 reviewed_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key (target_type,target_id)
);
alter table public.sc_documentation_qa_reviews enable row level security;
revoke all on public.sc_documentation_qa_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.sc_documentation_qa_reviews to service_role;

comment on table public.sc_training_progress is 'Per-user browser-independent training steps; not a safety sandbox.';
comment on table public.sc_training_certifications is 'Manager signoff is valid only if curriculum_version matches current training and signoff follows last progress edit.';
comment on table public.sc_documentation_qa_reviews is 'Manager-only audit-triage notes; never automatically upgrades live-verified claims.';
