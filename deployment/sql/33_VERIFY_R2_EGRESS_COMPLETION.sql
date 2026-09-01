-- Read-only verification for Skilled Crafting Inventory v1.0.5.

with checks as (
  select 'asset inventory view' check_name, to_regclass('public.sc_asset_storage_inventory') is not null passed
  union all select 'sample provider column', exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='sample_products' and column_name='image_storage_provider'
  )
  union all select 'production provider column', exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='sc_production_photos' and column_name='storage_provider'
  )
  union all select 'receiving provider column', exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='sc_supplier_receiving_imports' and column_name='document_storage_provider'
  )
  union all select 'supplier cache provider column', exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='sc_supplier_catalog_sync_runs' and column_name='cache_storage_provider'
  )
)
select check_name, case when passed then 'PASS' else 'FAIL' end result
from checks order by check_name;

select asset_type, provider, record_count, stored_file_count, pg_size_pretty(known_bytes) known_size
from public.sc_asset_storage_inventory
order by asset_type, provider;

select b.id bucket_name, count(o.id)::bigint object_count,
  pg_size_pretty(coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end),0)::bigint) total_size
from storage.buckets b
left join storage.objects o on o.bucket_id=b.id
where b.id in ('sample-product-images','product-images','production-photo-proof','sc-receiving-documents','supplier-sync-cache','sc-mockup-source','sc-mockup-output','sc-mockup-production')
group by b.id order by b.id;
