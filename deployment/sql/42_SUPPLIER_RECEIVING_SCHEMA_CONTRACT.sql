-- Skilled Crafting Inventory v1.1.6
-- Cumulative supplier-confirmation receiving schema contract.
-- ADDITIVE / NON-DESTRUCTIVE. Safe to run more than once.
--
-- This migration intentionally repeats the complete current table shape. A
-- prior installation may have run the original receiving migration without
-- the later R2 metadata migration; CREATE TABLE IF NOT EXISTS alone does not
-- add columns to an existing table.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table if not exists public.sc_supplier_item_mappings (
  id uuid primary key default gen_random_uuid(),
  supplier_key text not null,
  supplier_sku text not null,
  blank_product_id_text text not null,
  last_brand text,
  last_style text,
  last_color text,
  last_size text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sc_supplier_receiving_imports (
  id uuid primary key default gen_random_uuid(),
  supplier_key text not null,
  supplier_name text not null,
  order_number text not null,
  po_number text,
  order_date text,
  original_file_name text,
  document_storage_provider text,
  document_storage_bucket text,
  document_path text,
  document_size_bytes bigint,
  document_mime_type text,
  document_sha256 text,
  ordered_lines integer not null default 0,
  ordered_units numeric not null default 0,
  received_units numeric not null default 0,
  order_total numeric(14,2),
  status text not null default 'review',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sc_supplier_receiving_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sc_supplier_receiving_imports(id) on delete cascade,
  supplier_line_key text not null,
  supplier_sku text,
  description text,
  brand text,
  style text,
  color text,
  size text,
  source_page integer,
  ordered_quantity numeric not null default 0,
  received_quantity numeric not null default 0,
  unit_cost numeric(14,4),
  line_total numeric(14,2),
  blank_product_id_text text,
  updated_at timestamptz not null default now()
);

create table if not exists public.sc_supplier_receiving_receipts (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sc_supplier_receiving_imports(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'processing',
  received_units numeric not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by uuid,
  rollback_reason text
);

create table if not exists public.sc_supplier_receiving_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.sc_supplier_receiving_receipts(id) on delete cascade,
  import_line_id uuid not null references public.sc_supplier_receiving_lines(id),
  blank_product_id_text text not null,
  bin_id_text text not null,
  quantity numeric not null,
  unit_cost numeric(14,4),
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

-- Retrofit every column used by the current functions onto older tables.
alter table public.sc_supplier_item_mappings
  add column if not exists supplier_key text,
  add column if not exists supplier_sku text,
  add column if not exists blank_product_id_text text,
  add column if not exists last_brand text,
  add column if not exists last_style text,
  add column if not exists last_color text,
  add column if not exists last_size text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.sc_supplier_receiving_imports
  add column if not exists supplier_key text,
  add column if not exists supplier_name text,
  add column if not exists order_number text,
  add column if not exists po_number text,
  add column if not exists order_date text,
  add column if not exists original_file_name text,
  add column if not exists document_storage_provider text,
  add column if not exists document_storage_bucket text,
  add column if not exists document_path text,
  add column if not exists document_size_bytes bigint,
  add column if not exists document_mime_type text,
  add column if not exists document_sha256 text,
  add column if not exists ordered_lines integer default 0,
  add column if not exists ordered_units numeric default 0,
  add column if not exists received_units numeric default 0,
  add column if not exists order_total numeric(14,2),
  add column if not exists status text default 'review',
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.sc_supplier_receiving_lines
  add column if not exists import_id uuid,
  add column if not exists supplier_line_key text,
  add column if not exists supplier_sku text,
  add column if not exists description text,
  add column if not exists brand text,
  add column if not exists style text,
  add column if not exists color text,
  add column if not exists size text,
  add column if not exists source_page integer,
  add column if not exists ordered_quantity numeric default 0,
  add column if not exists received_quantity numeric default 0,
  add column if not exists unit_cost numeric(14,4),
  add column if not exists line_total numeric(14,2),
  add column if not exists blank_product_id_text text,
  add column if not exists updated_at timestamptz default now();

alter table public.sc_supplier_receiving_receipts
  add column if not exists import_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists status text default 'processing',
  add column if not exists received_units numeric default 0,
  add column if not exists notes text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists rolled_back_at timestamptz,
  add column if not exists rolled_back_by uuid,
  add column if not exists rollback_reason text;

alter table public.sc_supplier_receiving_receipt_lines
  add column if not exists receipt_id uuid,
  add column if not exists import_line_id uuid,
  add column if not exists blank_product_id_text text,
  add column if not exists bin_id_text text,
  add column if not exists quantity numeric,
  add column if not exists unit_cost numeric(14,4),
  add column if not exists status text default 'pending',
  add column if not exists error_message text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists rolled_back_at timestamptz;

-- Identify legacy Supabase documents without moving or deleting them.
update public.sc_supplier_receiving_imports
set document_storage_provider = 'supabase',
    document_storage_bucket = coalesce(document_storage_bucket, 'sc-receiving-documents'),
    document_mime_type = coalesce(document_mime_type, 'application/pdf')
where document_path is not null
  and document_storage_provider is null;

alter table public.sc_supplier_receiving_imports
  drop constraint if exists sc_supplier_receiving_imports_document_storage_provider_check;
alter table public.sc_supplier_receiving_imports
  add constraint sc_supplier_receiving_imports_document_storage_provider_check
  check (document_storage_provider is null or document_storage_provider in ('supabase', 'r2')) not valid;

create index if not exists ix_sc_supplier_receiving_imports_created_at
  on public.sc_supplier_receiving_imports(created_at desc);
create index if not exists ix_sc_supplier_receiving_lines_import
  on public.sc_supplier_receiving_lines(import_id);
create index if not exists ix_sc_supplier_receiving_receipts_import
  on public.sc_supplier_receiving_receipts(import_id, created_at desc);

-- Add natural-key protection when the existing data is clean. If legacy
-- duplicates exist, the migration stays non-destructive and the verification
-- query reports the exact duplicate group count for review.
do $indexes$
begin
  if not exists (
    select 1 from public.sc_supplier_item_mappings
    where supplier_key is not null and supplier_sku is not null
    group by supplier_key, supplier_sku having count(*) > 1
  ) then
    create unique index if not exists ux_sc_supplier_item_mappings_key
      on public.sc_supplier_item_mappings(supplier_key, supplier_sku);
  end if;

  if not exists (
    select 1 from public.sc_supplier_receiving_imports
    where supplier_key is not null and order_number is not null
    group by supplier_key, order_number having count(*) > 1
  ) then
    create unique index if not exists ux_sc_supplier_receiving_imports_order
      on public.sc_supplier_receiving_imports(supplier_key, order_number);
  end if;

  if not exists (
    select 1 from public.sc_supplier_receiving_lines
    where import_id is not null and supplier_line_key is not null
    group by import_id, supplier_line_key having count(*) > 1
  ) then
    create unique index if not exists ux_sc_supplier_receiving_lines_key
      on public.sc_supplier_receiving_lines(import_id, supplier_line_key);
  end if;

  if not exists (
    select 1 from public.sc_supplier_receiving_receipts
    where idempotency_key is not null
    group by idempotency_key having count(*) > 1
  ) then
    create unique index if not exists ux_sc_supplier_receiving_receipts_request
      on public.sc_supplier_receiving_receipts(idempotency_key);
  end if;

  if not exists (
    select 1 from public.sc_supplier_receiving_receipt_lines
    where receipt_id is not null and import_line_id is not null
    group by receipt_id, import_line_id having count(*) > 1
  ) then
    create unique index if not exists ux_sc_supplier_receiving_receipt_lines_key
      on public.sc_supplier_receiving_receipt_lines(receipt_id, import_line_id);
  end if;
end
$indexes$;

alter table public.sc_supplier_item_mappings enable row level security;
alter table public.sc_supplier_receiving_imports enable row level security;
alter table public.sc_supplier_receiving_lines enable row level security;
alter table public.sc_supplier_receiving_receipts enable row level security;
alter table public.sc_supplier_receiving_receipt_lines enable row level security;

revoke all on public.sc_supplier_item_mappings from anon, authenticated;
revoke all on public.sc_supplier_receiving_imports from anon, authenticated;
revoke all on public.sc_supplier_receiving_lines from anon, authenticated;
revoke all on public.sc_supplier_receiving_receipts from anon, authenticated;
revoke all on public.sc_supplier_receiving_receipt_lines from anon, authenticated;
grant all on public.sc_supplier_item_mappings to service_role;
grant all on public.sc_supplier_receiving_imports to service_role;
grant all on public.sc_supplier_receiving_lines to service_role;
grant all on public.sc_supplier_receiving_receipts to service_role;
grant all on public.sc_supplier_receiving_receipt_lines to service_role;

comment on column public.sc_supplier_receiving_imports.document_mime_type is
  'MIME type for the private R2 or legacy Supabase supplier document.';

commit;

-- Force PostgREST to discard the stale column cache that produced errors such
-- as "Could not find document_mime_type in the schema cache".
select pg_notify('pgrst', 'reload schema');

