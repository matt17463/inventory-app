-- Skilled Crafting Inventory App v0.7.0
-- Mockup Studio: all phases
-- Additive migration. Does not modify inventory, pull sheets, reservations,
-- WooCommerce catalog rows, or existing artwork records.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '180s';

create extension if not exists pgcrypto;

create or replace function public.sc_mockup_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  new.updated_at := now();
  return new;
end
$function$;

create table if not exists public.mockup_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  customer_id_text text,
  customer_name text,
  campaign_name text,
  project_type text not null default 'store_product',
  status text not null default 'draft'
    check (status in (
      'draft', 'assets_ready', 'generating', 'review',
      'changes_requested', 'approved', 'woo_draft',
      'published', 'production_ready', 'archived'
    )),
  output_style text not null default 'clean_catalog',
  background_preference text not null default 'preserve_source',
  exact_artwork_required boolean not null default true,
  default_caption_font text not null default 'Arial',
  default_caption_size integer not null default 36
    check (default_caption_size between 8 and 240),
  default_caption_color text not null default '#111827',
  default_caption_background text not null default '#ffffff',
  pricing_config jsonb not null default '{}'::jsonb,
  woo_config jsonb not null default '{}'::jsonb,
  notes text,
  woo_product_id bigint,
  woo_product_url text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mockup_blank_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  blank_product_id_text text,
  asset_name text not null,
  product_type text not null default 'other',
  product_color text,
  product_view text not null default 'front',
  storage_bucket text,
  storage_path text,
  source_url text,
  mime_type text,
  original_file_name text,
  pixel_width integer,
  pixel_height integer,
  print_area jsonb not null default
    '{"x_pct":25,"y_pct":20,"width_pct":50,"height_pct":60}'::jsonb,
  preflight_status text not null default 'pending'
    check (preflight_status in ('pending', 'passed', 'warning', 'failed')),
  preflight_notes text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or source_url is not null)
);

create table if not exists public.mockup_artwork_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  artwork_name text not null,
  artwork_request_id_text text,
  artwork_vault_reference text,
  storage_bucket text,
  storage_path text,
  source_url text,
  prepared_storage_path text,
  mime_type text,
  original_file_name text,
  pixel_width integer,
  pixel_height integer,
  has_transparency boolean,
  background_removed boolean not null default false,
  exact_artwork_locked boolean not null default true,
  preflight_status text not null default 'pending'
    check (preflight_status in ('pending', 'passed', 'warning', 'failed')),
  preflight_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or source_url is not null)
);

create table if not exists public.mockup_placements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  blank_asset_id uuid not null references public.mockup_blank_assets(id) on delete cascade,
  artwork_asset_id uuid not null references public.mockup_artwork_assets(id) on delete cascade,
  placement_name text not null default 'center_chest',
  decoration_method text not null default 'dtf',
  x_pct numeric(7,3) not null default 50 check (x_pct between 0 and 100),
  y_pct numeric(7,3) not null default 45 check (y_pct between 0 and 100),
  width_pct numeric(7,3) not null default 40 check (width_pct > 0 and width_pct <= 100),
  height_pct numeric(7,3) check (height_pct is null or (height_pct > 0 and height_pct <= 100)),
  print_width_inches numeric(8,3) check (print_width_inches is null or print_width_inches > 0),
  print_height_inches numeric(8,3) check (print_height_inches is null or print_height_inches > 0),
  rotation_degrees numeric(8,3) not null default 0,
  opacity numeric(5,4) not null default 1 check (opacity between 0 and 1),
  blend_mode text not null default 'multiply',
  shadow_strength numeric(5,4) not null default 0.15 check (shadow_strength between 0 and 1),
  curvature numeric(6,3) not null default 0,
  perspective_config jsonb not null default '{}'::jsonb,
  generation_instructions text,
  layer_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blank_asset_id, artwork_asset_id, placement_name)
);

create table if not exists public.mockup_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  placement_id uuid references public.mockup_placements(id) on delete set null,
  generation_mode text not null default 'ai_assisted'
    check (generation_mode in ('exact_composite', 'ai_assisted', 'background_cleanup')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  requested_variants integer not null default 1 check (requested_variants between 1 and 10),
  model_name text,
  quality text not null default 'high',
  output_size text not null default '1024x1024',
  prompt_text text,
  request_metadata jsonb not null default '{}'::jsonb,
  provider_request_id text,
  estimated_cost numeric(12,4),
  actual_cost numeric(12,4),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mockup_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  placement_id uuid references public.mockup_placements(id) on delete set null,
  generation_job_id uuid references public.mockup_generation_jobs(id) on delete set null,
  output_name text not null,
  output_kind text not null default 'clean'
    check (output_kind in ('clean', 'captioned', 'ai_enhanced', 'thumbnail', 'production_reference')),
  variant_number integer not null default 1,
  storage_bucket text not null default 'sc-mockup-output',
  storage_path text not null,
  mime_type text not null default 'image/png',
  pixel_width integer,
  pixel_height integer,
  caption_text text,
  caption_font text not null default 'Arial',
  caption_size integer not null default 36 check (caption_size between 8 and 240),
  caption_color text not null default '#111827',
  caption_background text not null default '#ffffff',
  caption_alignment text not null default 'center'
    check (caption_alignment in ('left', 'center', 'right')),
  caption_padding integer not null default 32 check (caption_padding between 0 and 300),
  is_selected boolean not null default false,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'internal_approved', 'customer_approved', 'changes_requested', 'rejected')),
  approved_at timestamptz,
  approved_by text,
  woo_media_id bigint,
  woo_position integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mockup_review_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active'
    check (status in ('active', 'used', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create table if not exists public.mockup_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  output_id uuid references public.mockup_outputs(id) on delete set null,
  review_token_id uuid references public.mockup_review_tokens(id) on delete set null,
  decision text not null check (decision in ('approved', 'changes_requested', 'comment')),
  reviewer_name text,
  reviewer_email text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mockup_pricing_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  label text not null,
  pricing_type text not null default 'per_item'
    check (pricing_type in ('per_item', 'flat', 'percentage')),
  quantity numeric(12,3) not null default 1,
  unit_cost numeric(12,4) not null default 0,
  markup_percent numeric(9,4) not null default 0,
  sell_price numeric(12,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mockup_woo_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  operation text not null default 'create_draft'
    check (operation in ('create_draft', 'update_draft', 'publish', 'update_published')),
  woo_product_id bigint,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.mockup_production_packets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mockup_projects(id) on delete cascade,
  packet_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'printed', 'completed')),
  packet_data jsonb not null default '{}'::jsonb,
  storage_bucket text,
  storage_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, packet_number)
);

create index if not exists ix_mockup_projects_status
  on public.mockup_projects(status, updated_at desc);
create index if not exists ix_mockup_blank_assets_project
  on public.mockup_blank_assets(project_id, sort_order, created_at);
create index if not exists ix_mockup_artwork_assets_project
  on public.mockup_artwork_assets(project_id, created_at);
create index if not exists ix_mockup_placements_project
  on public.mockup_placements(project_id, layer_order, created_at);
create index if not exists ix_mockup_generation_jobs_queue
  on public.mockup_generation_jobs(status, created_at);
create index if not exists ix_mockup_outputs_project
  on public.mockup_outputs(project_id, is_selected desc, created_at desc);
create index if not exists ix_mockup_review_tokens_lookup
  on public.mockup_review_tokens(token_hash, status, expires_at);
create index if not exists ix_mockup_reviews_project
  on public.mockup_reviews(project_id, created_at desc);
create index if not exists ix_mockup_woo_exports_project
  on public.mockup_woo_exports(project_id, created_at desc);

do $triggers$
declare
  v_table text;
begin
  foreach v_table in array array[
    'mockup_projects',
    'mockup_blank_assets',
    'mockup_artwork_assets',
    'mockup_placements',
    'mockup_generation_jobs',
    'mockup_outputs',
    'mockup_pricing_items',
    'mockup_production_packets'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', v_table, v_table);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.sc_mockup_touch_updated_at()',
      v_table,
      v_table
    );
  end loop;
end
$triggers$;

create or replace view public.mockup_project_summary
with (security_invoker = true)
as
select
  p.*,
  coalesce(b.blank_count, 0)::integer as blank_count,
  coalesce(a.artwork_count, 0)::integer as artwork_count,
  coalesce(pl.placement_count, 0)::integer as placement_count,
  coalesce(o.output_count, 0)::integer as output_count,
  coalesce(o.selected_count, 0)::integer as selected_output_count,
  coalesce(r.review_count, 0)::integer as review_count,
  coalesce(w.export_count, 0)::integer as woo_export_count,
  w.last_export_status
from public.mockup_projects p
left join lateral (
  select count(*) as blank_count
  from public.mockup_blank_assets x where x.project_id = p.id
) b on true
left join lateral (
  select count(*) as artwork_count
  from public.mockup_artwork_assets x where x.project_id = p.id
) a on true
left join lateral (
  select count(*) as placement_count
  from public.mockup_placements x where x.project_id = p.id and x.is_active
) pl on true
left join lateral (
  select count(*) as output_count,
         count(*) filter (where x.is_selected) as selected_count
  from public.mockup_outputs x where x.project_id = p.id
) o on true
left join lateral (
  select count(*) as review_count
  from public.mockup_reviews x where x.project_id = p.id
) r on true
left join lateral (
  select count(*) as export_count,
         (array_agg(x.status order by x.created_at desc))[1] as last_export_status
  from public.mockup_woo_exports x where x.project_id = p.id
) w on true;

create or replace function public.sc_mockup_create_review_token(
  p_project_id uuid,
  p_expires_in_days integer default 14
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_token text;
  v_days integer;
begin
  if auth.uid() is null then
    raise exception 'Employee authentication is required.';
  end if;

  if not exists (select 1 from public.mockup_projects where id = p_project_id) then
    raise exception 'Mockup project was not found.';
  end if;

  v_days := greatest(1, least(coalesce(p_expires_in_days, 14), 90));
  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.mockup_review_tokens(
    project_id,
    token_hash,
    expires_at,
    created_by
  ) values (
    p_project_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(days => v_days),
    auth.uid()
  );

  update public.mockup_projects
  set status = case when status in ('approved', 'published', 'production_ready') then status else 'review' end
  where id = p_project_id;

  return v_token;
end
$function$;

create or replace function public.sc_mockup_select_output(
  p_output_id uuid,
  p_selected boolean default true
)
returns public.mockup_outputs
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_output public.mockup_outputs;
begin
  select * into v_output from public.mockup_outputs where id = p_output_id;
  if not found then raise exception 'Mockup output was not found.'; end if;

  if coalesce(p_selected, true) then
    update public.mockup_outputs
    set is_selected = false
    where project_id = v_output.project_id
      and placement_id is not distinct from v_output.placement_id;
  end if;

  update public.mockup_outputs
  set
    is_selected = coalesce(p_selected, true),
    approval_status = case
      when coalesce(p_selected, true) and approval_status = 'pending'
        then 'internal_approved'
      else approval_status
    end,
    approved_at = case when coalesce(p_selected, true) then now() else approved_at end,
    approved_by = case when coalesce(p_selected, true) then auth.uid()::text else approved_by end
  where id = p_output_id
  returning * into v_output;

  return v_output;
end
$function$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'sc-mockup-source',
    'sc-mockup-source',
    false,
    52428800,
    array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']
  ),
  (
    'sc-mockup-output',
    'sc-mockup-output',
    false,
    52428800,
    array['image/png','image/jpeg','image/webp','application/pdf','application/json']
  ),
  (
    'sc-mockup-production',
    'sc-mockup-production',
    false,
    104857600,
    array['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf','application/json','text/csv']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $security$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'mockup_projects',
    'mockup_blank_assets',
    'mockup_artwork_assets',
    'mockup_placements',
    'mockup_generation_jobs',
    'mockup_outputs',
    'mockup_review_tokens',
    'mockup_reviews',
    'mockup_pricing_items',
    'mockup_woo_exports',
    'mockup_production_packets'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all privileges on table public.%I from public, anon', v_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', v_table);
    execute format('grant all privileges on table public.%I to service_role', v_table);

    for v_policy in
      select polname
      from pg_policy
      where polrelid = to_regclass(format('public.%I', v_table))
        and polname = 'sc_mockup_authenticated_all'
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.polname, v_table);
    end loop;

    execute format(
      'create policy sc_mockup_authenticated_all on public.%I for all to authenticated using (true) with check (true)',
      v_table
    );
  end loop;
end
$security$;

revoke all privileges on table public.mockup_project_summary from public, anon;
grant select on table public.mockup_project_summary to authenticated, service_role;

drop policy if exists sc_mockup_storage_select on storage.objects;
drop policy if exists sc_mockup_storage_insert on storage.objects;
drop policy if exists sc_mockup_storage_update on storage.objects;
drop policy if exists sc_mockup_storage_delete on storage.objects;

create policy sc_mockup_storage_select
on storage.objects for select to authenticated
using (bucket_id in ('sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production'));

create policy sc_mockup_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id in ('sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy sc_mockup_storage_update
on storage.objects for update to authenticated
using (
  bucket_id in ('sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy sc_mockup_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id in ('sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production')
  and (storage.foldername(name))[1] = auth.uid()::text
);

revoke all on function public.sc_mockup_touch_updated_at() from public, anon;
revoke all on function public.sc_mockup_create_review_token(uuid, integer) from public, anon;
revoke all on function public.sc_mockup_select_output(uuid, boolean) from public, anon;
grant execute on function public.sc_mockup_touch_updated_at() to authenticated, service_role;
grant execute on function public.sc_mockup_create_review_token(uuid, integer) to authenticated, service_role;
grant execute on function public.sc_mockup_select_output(uuid, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- Single-grid post-install verification.
with expected_tables(table_name) as (
  values
    ('mockup_projects'),
    ('mockup_blank_assets'),
    ('mockup_artwork_assets'),
    ('mockup_placements'),
    ('mockup_generation_jobs'),
    ('mockup_outputs'),
    ('mockup_review_tokens'),
    ('mockup_reviews'),
    ('mockup_pricing_items'),
    ('mockup_woo_exports'),
    ('mockup_production_packets')
), checks as (
  select 'mockup_tables' as check_name,
         count(*)::text as current_value,
         '11' as expected_value
  from expected_tables e
  where to_regclass(format('public.%I', e.table_name)) is not null

  union all
  select 'private_storage_buckets', count(*)::text, '3'
  from storage.buckets
  where id in ('sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production')
    and public = false

  union all
  select 'security_invoker_summary_view',
         (coalesce('security_invoker=true' = any(c.reloptions), false))::text,
         'true'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'mockup_project_summary'

  union all
  select 'authenticated_table_policies', count(*)::text, '11'
  from pg_policies p
  join expected_tables e on e.table_name = p.tablename
  where p.schemaname = 'public'
    and p.policyname = 'sc_mockup_authenticated_all'
    and p.roles = array['authenticated']::name[]

  union all
  select 'anonymous_table_privileges', count(*)::text, '0'
  from expected_tables e
  join pg_class c on c.relname = e.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where has_table_privilege('anon', c.oid, 'select')
     or has_table_privilege('anon', c.oid, 'insert')
     or has_table_privilege('anon', c.oid, 'update')
     or has_table_privilege('anon', c.oid, 'delete')

  union all
  select 'required_functions', count(*)::text, '2'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('sc_mockup_create_review_token', 'sc_mockup_select_output')
)
select
  check_name,
  current_value,
  expected_value,
  case when current_value = expected_value then 'PASS' else 'STOP' end as status
from checks
order by check_name;
