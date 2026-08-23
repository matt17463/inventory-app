-- Skilled Crafting Inventory v0.8.13
-- Background WooCommerce color scans and cleanup jobs.
-- Safe to run more than once.

begin;

create table if not exists public.sc_color_lifecycle_jobs (
  id uuid primary key,
  action text not null check (action in ('scan', 'cleanup')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  requested_keys jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.sc_color_woo_term_snapshot (
  scan_id uuid not null references public.sc_color_lifecycle_jobs(id) on delete cascade,
  attribute_id bigint not null,
  term_id bigint not null,
  term_name text not null,
  term_slug text,
  product_count bigint not null default 0,
  scanned_at timestamptz not null default now(),
  primary key (scan_id, term_id)
);

create index if not exists ix_sc_color_lifecycle_jobs_completed
  on public.sc_color_lifecycle_jobs (action, status, completed_at desc);

alter table public.sc_color_lifecycle_jobs enable row level security;
alter table public.sc_color_woo_term_snapshot enable row level security;
revoke all on public.sc_color_lifecycle_jobs from anon, authenticated;
revoke all on public.sc_color_woo_term_snapshot from anon, authenticated;
grant all on public.sc_color_lifecycle_jobs to service_role;
grant all on public.sc_color_woo_term_snapshot to service_role;

create or replace function public.sc_color_lifecycle_usage_counts()
returns table (
  color_id_text text,
  product_count bigint,
  blank_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with product_usage as (
    select p.color_id::text as color_id_text, count(*)::bigint as use_count
    from public.products p
    where p.color_id is not null
    group by p.color_id::text
  ),
  blank_usage as (
    select b.color_id::text as color_id_text, count(*)::bigint as use_count
    from public.blank_products b
    where b.color_id is not null
    group by b.color_id::text
  )
  select c.id::text,
         coalesce(pu.use_count, 0)::bigint,
         coalesce(bu.use_count, 0)::bigint
  from public.colors c
  left join product_usage pu on pu.color_id_text = c.id::text
  left join blank_usage bu on bu.color_id_text = c.id::text;
$$;

revoke all on function public.sc_color_lifecycle_usage_counts() from public, anon, authenticated;
grant execute on function public.sc_color_lifecycle_usage_counts() to service_role;

commit;

select
  to_regclass('public.sc_color_lifecycle_jobs') is not null as background_jobs_ready,
  to_regclass('public.sc_color_woo_term_snapshot') is not null as woo_snapshot_ready,
  to_regprocedure('public.sc_color_lifecycle_usage_counts()') is not null as usage_rpc_ready;
