-- Skilled Crafting Inventory v0.8.0
-- Supplier confirmation receiving for S&S Activewear and Momentec.
-- Safe to run more than once in Supabase SQL Editor.

begin;

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
  updated_at timestamptz not null default now(),
  unique (supplier_key, supplier_sku)
);

create table if not exists public.sc_supplier_receiving_imports (
  id uuid primary key default gen_random_uuid(),
  supplier_key text not null,
  supplier_name text not null,
  order_number text not null,
  po_number text,
  order_date text,
  original_file_name text,
  document_path text,
  document_sha256 text,
  ordered_lines integer not null default 0,
  ordered_units numeric not null default 0,
  received_units numeric not null default 0,
  order_total numeric(14,2),
  status text not null default 'review',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_key, order_number)
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
  ordered_quantity numeric not null default 0 check (ordered_quantity >= 0),
  received_quantity numeric not null default 0 check (received_quantity >= 0),
  unit_cost numeric(14,4),
  line_total numeric(14,2),
  blank_product_id_text text,
  updated_at timestamptz not null default now(),
  unique (import_id, supplier_line_key),
  check (received_quantity <= ordered_quantity)
);

create table if not exists public.sc_supplier_receiving_receipts (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sc_supplier_receiving_imports(id) on delete cascade,
  idempotency_key text not null unique,
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
  quantity numeric not null check (quantity > 0),
  unit_cost numeric(14,4),
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  unique (receipt_id, import_line_id)
);

create index if not exists ix_sc_supplier_receiving_imports_created_at on public.sc_supplier_receiving_imports(created_at desc);
create index if not exists ix_sc_supplier_receiving_lines_import on public.sc_supplier_receiving_lines(import_id);
create index if not exists ix_sc_supplier_receiving_receipts_import on public.sc_supplier_receiving_receipts(import_id, created_at desc);

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sc-receiving-documents', 'sc-receiving-documents', false, 12582912, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

select
  to_regclass('public.sc_supplier_receiving_imports') is not null as imports_ready,
  to_regclass('public.sc_supplier_receiving_receipts') is not null as receipts_ready,
  exists(select 1 from storage.buckets where id = 'sc-receiving-documents' and public = false) as private_pdf_storage_ready;
