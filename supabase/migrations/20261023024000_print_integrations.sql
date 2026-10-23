-- Unified Print Center: service-only QuickBooks OAuth credentials and queued print jobs.
-- Never expose financial OAuth tokens or PDF payloads through client-side tables.
create table if not exists public.sc_qbo_print_connection (
  id smallint primary key default 1 check(id=1),
  realm_id text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_expires_at timestamptz not null,
  token_version bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.sc_qbo_print_oauth_states(
  state_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.sc_print_dispatch_jobs(
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete restrict,
  document_kind text not null check(document_kind in ('invoice_pair','customer_invoice','shop_invoice','packing_labels','production_packet')),
  queue_name text not null check(queue_name in ('letter','thermal')),
  storage_path text not null unique,
  status text not null default 'queued' check(status in ('queued','leased','spooled','failed')),
  idempotency_key uuid not null unique,
  requested_by uuid not null references auth.users(id),
  lease_id uuid,
  leased_at timestamptz,
  attempts int not null default 0 check(attempts between 0 and 20),
  cups_job_reference text,
  error_text text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  pdf_purged_at timestamptz
);
create index if not exists sc_print_dispatch_status_idx
  on public.sc_print_dispatch_jobs(status,created_at);
create table if not exists public.sc_print_layout_profiles(
  id text primary key check(id in ('default','woocommerce','quickbooks_manual')),
  settings jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.sc_product_production_profiles(
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check(source_kind in ('woo_variation','woo_product','sku','manual_item')),
  source_key text not null,
  recipe_version_id uuid not null references public.sc_manufacturing_recipe_versions(id) on delete restrict,
  artwork_asset_id uuid references public.mockup_artwork_assets(id) on delete restrict,
  notes text not null default '',
  approved_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(source_kind,source_key)
);
do $$ declare t text;
begin
 foreach t in array array[
   'sc_qbo_print_connection','sc_qbo_print_oauth_states','sc_print_dispatch_jobs',
   'sc_print_layout_profiles','sc_product_production_profiles'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Private service-role-only PDF archive, never public URLs.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('sc-private-print-pdfs','sc-private-print-pdfs',false,10485760,array['application/pdf'])
on conflict(id) do nothing;

-- Defense in depth against legacy storage policies permitting generic uploads.
-- Service role bypasses RLS; browser roles are explicitly excluded from this bucket.
create policy sc_private_print_browser_select_guard on storage.objects
  as restrictive for select to anon,authenticated
  using (bucket_id <> 'sc-private-print-pdfs');
create policy sc_private_print_browser_insert_guard on storage.objects
  as restrictive for insert to anon,authenticated
  with check (bucket_id <> 'sc-private-print-pdfs');
create policy sc_private_print_browser_update_guard on storage.objects
  as restrictive for update to anon,authenticated
  using (bucket_id <> 'sc-private-print-pdfs')
  with check (bucket_id <> 'sc-private-print-pdfs');
create policy sc_private_print_browser_delete_guard on storage.objects
  as restrictive for delete to anon,authenticated
  using (bucket_id <> 'sc-private-print-pdfs');
