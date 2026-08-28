-- Skilled Crafting Inventory v1.1.6
-- Read-only verification. Run after SQL 42. It must return one row with
-- contract_ready = true and every duplicate count = 0.

with required_columns(table_name, column_name) as (
  values
    ('sc_supplier_item_mappings','supplier_key'),
    ('sc_supplier_item_mappings','supplier_sku'),
    ('sc_supplier_item_mappings','blank_product_id_text'),
    ('sc_supplier_receiving_imports','supplier_key'),
    ('sc_supplier_receiving_imports','order_number'),
    ('sc_supplier_receiving_imports','document_storage_provider'),
    ('sc_supplier_receiving_imports','document_storage_bucket'),
    ('sc_supplier_receiving_imports','document_path'),
    ('sc_supplier_receiving_imports','document_size_bytes'),
    ('sc_supplier_receiving_imports','document_mime_type'),
    ('sc_supplier_receiving_imports','document_sha256'),
    ('sc_supplier_receiving_lines','import_id'),
    ('sc_supplier_receiving_lines','supplier_line_key'),
    ('sc_supplier_receiving_lines','unit_cost'),
    ('sc_supplier_receiving_receipts','idempotency_key'),
    ('sc_supplier_receiving_receipts','rolled_back_at'),
    ('sc_supplier_receiving_receipt_lines','receipt_id'),
    ('sc_supplier_receiving_receipt_lines','import_line_id'),
    ('sc_supplier_receiving_receipt_lines','unit_cost')
), missing as (
  select r.table_name, r.column_name
  from required_columns r
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = r.table_name
   and c.column_name = r.column_name
  where c.column_name is null
), mapping_duplicates as (
  select count(*)::integer duplicate_groups from (
    select supplier_key, supplier_sku from public.sc_supplier_item_mappings
    where supplier_key is not null and supplier_sku is not null
    group by supplier_key, supplier_sku having count(*) > 1
  ) d
), import_duplicates as (
  select count(*)::integer duplicate_groups from (
    select supplier_key, order_number from public.sc_supplier_receiving_imports
    where supplier_key is not null and order_number is not null
    group by supplier_key, order_number having count(*) > 1
  ) d
), line_duplicates as (
  select count(*)::integer duplicate_groups from (
    select import_id, supplier_line_key from public.sc_supplier_receiving_lines
    where import_id is not null and supplier_line_key is not null
    group by import_id, supplier_line_key having count(*) > 1
  ) d
), receipt_duplicates as (
  select count(*)::integer duplicate_groups from (
    select idempotency_key from public.sc_supplier_receiving_receipts
    where idempotency_key is not null
    group by idempotency_key having count(*) > 1
  ) d
), receipt_line_duplicates as (
  select count(*)::integer duplicate_groups from (
    select receipt_id, import_line_id from public.sc_supplier_receiving_receipt_lines
    where receipt_id is not null and import_line_id is not null
    group by receipt_id, import_line_id having count(*) > 1
  ) d
)
select
  not exists (select 1 from missing) as contract_ready,
  coalesce((select jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name) order by table_name, column_name) from missing), '[]'::jsonb) as missing_columns,
  (select duplicate_groups from mapping_duplicates) as mapping_duplicate_groups,
  (select duplicate_groups from import_duplicates) as import_duplicate_groups,
  (select duplicate_groups from line_duplicates) as line_duplicate_groups,
  (select duplicate_groups from receipt_duplicates) as receipt_duplicate_groups,
  (select duplicate_groups from receipt_line_duplicates) as receipt_line_duplicate_groups,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sc_supplier_receiving_imports'
      and column_name='document_mime_type' and data_type='text'
  ) as document_mime_type_ready;

