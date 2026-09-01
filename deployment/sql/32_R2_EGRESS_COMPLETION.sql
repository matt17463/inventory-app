-- Skilled Crafting Inventory v1.0.5
-- R2 egress completion: samples, production proofs, supplier documents/cache,
-- and legacy product-image tracking. Additive and safe to rerun.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table if exists public.sample_products
  add column if not exists image_storage_provider text,
  add column if not exists image_storage_bucket text,
  add column if not exists image_file_size_bytes bigint,
  add column if not exists image_mime_type text,
  add column if not exists preview_storage_provider text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists preview_size_bytes bigint;

alter table if exists public.sc_production_photos
  add column if not exists storage_provider text,
  add column if not exists storage_bucket text,
  add column if not exists file_size_bytes bigint,
  add column if not exists mime_type text,
  add column if not exists preview_storage_provider text,
  add column if not exists preview_storage_bucket text,
  add column if not exists preview_storage_path text,
  add column if not exists preview_size_bytes bigint;

alter table if exists public.sc_supplier_receiving_imports
  add column if not exists document_storage_provider text,
  add column if not exists document_storage_bucket text,
  add column if not exists document_size_bytes bigint,
  add column if not exists document_mime_type text;

alter table if exists public.sc_supplier_catalog_sync_runs
  add column if not exists cache_storage_provider text;

alter table if exists public.blank_products
  add column if not exists image_storage_provider text,
  add column if not exists image_storage_bucket text,
  add column if not exists image_storage_path text,
  add column if not exists image_file_size_bytes bigint,
  add column if not exists image_mime_type text,
  add column if not exists image_preview_storage_provider text,
  add column if not exists image_preview_storage_bucket text,
  add column if not exists image_preview_storage_path text,
  add column if not exists image_preview_size_bytes bigint;

update public.sample_products
set image_storage_provider = 'supabase',
    image_storage_bucket = 'sample-product-images'
where image_path is not null
  and image_storage_provider is null;

update public.sc_production_photos
set storage_provider = 'supabase',
    storage_bucket = 'production-photo-proof'
where storage_path is not null
  and storage_provider is null;

update public.sc_supplier_receiving_imports
set document_storage_provider = 'supabase',
    document_storage_bucket = 'sc-receiving-documents',
    document_mime_type = coalesce(document_mime_type, 'application/pdf')
where document_path is not null
  and document_storage_provider is null;

update public.sc_supplier_catalog_sync_runs
set cache_storage_provider = 'supabase'
where cache_object_path is not null
  and cache_storage_provider is null;

update public.blank_products
set image_storage_provider = 'supabase',
    image_storage_bucket = 'product-images',
    image_storage_path = substring(image_url from '/product-images/(.*)$')
where image_storage_provider is null
  and image_url like '%/product-images/%';

do $constraints$
declare
  item record;
begin
  for item in select * from (values
    ('sample_products', 'image_storage_provider'),
    ('sample_products', 'preview_storage_provider'),
    ('sc_production_photos', 'storage_provider'),
    ('sc_production_photos', 'preview_storage_provider'),
    ('sc_supplier_receiving_imports', 'document_storage_provider'),
    ('sc_supplier_catalog_sync_runs', 'cache_storage_provider'),
    ('blank_products', 'image_storage_provider'),
    ('blank_products', 'image_preview_storage_provider')
  ) as x(table_name, column_name)
  loop
    if to_regclass('public.' || item.table_name) is not null then
      execute format('alter table public.%I drop constraint if exists %I', item.table_name, item.table_name || '_' || item.column_name || '_check');
      execute format(
        'alter table public.%I add constraint %I check (%I is null or %I in (''supabase'', ''r2''))',
        item.table_name, item.table_name || '_' || item.column_name || '_check', item.column_name, item.column_name
      );
    end if;
  end loop;
end
$constraints$;

-- Refresh the active sample view so the new storage columns are available to the browser.
do $view$
begin
  if to_regclass('public.sample_products') is not null then
    drop view if exists public.sample_products_with_bins;
    if to_regclass('public.bins') is not null then
      execute $sql$
        create view public.sample_products_with_bins
        with (security_invoker = true)
        as
        select sp.*, b.bin_code, b.label as bin_label, b.location as bin_location
        from public.sample_products sp
        left join public.bins b on b.id = sp.bin_id
      $sql$;
    else
      execute $sql$
        create view public.sample_products_with_bins
        with (security_invoker = true)
        as
        select sp.*, null::text as bin_code, null::text as bin_label, null::text as bin_location
        from public.sample_products sp
      $sql$;
    end if;
  end if;
end
$view$;

grant select on public.sample_products_with_bins to authenticated;

create or replace view public.sc_asset_storage_inventory
with (security_invoker = true)
as
with assets as (
  select 'sample_image'::text asset_type, id::text record_id,
    coalesce(image_storage_provider, case when image_path is not null then 'supabase' end, 'external') provider,
    image_storage_bucket bucket, image_path path, image_file_size_bytes bytes
  from public.sample_products
  union all
  select 'production_photo', id::text,
    coalesce(storage_provider, case when storage_path is not null then 'supabase' end, 'external'),
    storage_bucket, storage_path, file_size_bytes
  from public.sc_production_photos
  union all
  select 'supplier_document', id::text,
    coalesce(document_storage_provider, case when document_path is not null then 'supabase' end, 'external'),
    document_storage_bucket, document_path, document_size_bytes
  from public.sc_supplier_receiving_imports
  union all
  select 'supplier_cache', id::text,
    coalesce(cache_storage_provider, case when cache_object_path is not null then 'supabase' end, 'external'),
    cache_bucket, cache_object_path, source_bytes
  from public.sc_supplier_catalog_sync_runs
  union all
  select 'legacy_product_image', id::text,
    coalesce(image_storage_provider, case when image_storage_path is not null then 'supabase' end, 'external'),
    image_storage_bucket, image_storage_path, image_file_size_bytes
  from public.blank_products
)
select asset_type, provider, count(*)::bigint record_count,
  count(*) filter (where path is not null)::bigint stored_file_count,
  coalesce(sum(bytes), 0)::bigint known_bytes
from assets
group by asset_type, provider;

grant select on public.sc_asset_storage_inventory to authenticated, service_role;

create or replace function public.sc_storage_bucket_inventory_v1()
returns table(bucket_name text, object_count bigint, total_bytes bigint)
language sql
security definer
set search_path = pg_catalog, public, storage
as $function$
  select b.id::text,
    count(o.id)::bigint,
    coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end),0)::bigint
  from storage.buckets b
  left join storage.objects o on o.bucket_id=b.id
  where b.id in ('sample-product-images','product-images','production-photo-proof','sc-receiving-documents','supplier-sync-cache','sc-mockup-source','sc-mockup-output','sc-mockup-production')
  group by b.id
$function$;

revoke all on function public.sc_storage_bucket_inventory_v1() from public, anon, authenticated;
grant execute on function public.sc_storage_bucket_inventory_v1() to service_role;

insert into public.sc_application_schema_versions(version_key, phase, description, notes)
values (
  '202608260105',
  'r2_egress_completion',
  'Private R2 metadata for operational application assets',
  'Adds provider-aware storage for samples, production proofs, supplier documents, supplier cache, and legacy product images.'
)
on conflict (version_key) do update
set phase = excluded.phase, description = excluded.description, notes = excluded.notes;

commit;
