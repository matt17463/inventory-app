-- Skilled Crafting Inventory Operations Update
-- Features: barcode/QR scan support, bin transfers, audit mode, low-stock alerts,
-- inventory valuation, non-blocking reservations, NFC bin dashboard fields,
-- dashboard KPIs, activity feed, and WooCommerce sync queue foundation.
--
-- Run the whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- =========================================================
-- 1. TABLE UPDATES
-- =========================================================

alter table public.bins
  add column if not exists bin_code text,
  add column if not exists label text,
  add column if not exists location text,
  add column if not exists nfc_url text,
  add column if not exists created_at timestamptz default now();

create index if not exists bins_bin_code_idx on public.bins(bin_code);

alter table public.blank_products
  add column if not exists barcode text,
  add column if not exists unit_cost numeric(10,2) not null default 0,
  add column if not exists low_stock_threshold integer not null default 0;

create index if not exists blank_products_barcode_idx on public.blank_products(barcode);
create index if not exists blank_products_sku_base_idx on public.blank_products(sku_base);

-- Movement ledger. blank_products.id is UUID in your database.
create table if not exists public.blank_inventory_movements (
  id bigserial primary key,
  bin_id bigint not null references public.bins(id) on delete cascade,
  blank_product_id uuid not null references public.blank_products(id) on delete cascade,
  quantity_change integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists blank_inventory_movements_bin_idx on public.blank_inventory_movements(bin_id);
create index if not exists blank_inventory_movements_product_idx on public.blank_inventory_movements(blank_product_id);
create index if not exists blank_inventory_movements_bin_product_idx on public.blank_inventory_movements(bin_id, blank_product_id);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  from_bin_id bigint not null references public.bins(id) on delete restrict,
  to_bin_id bigint not null references public.bins(id) on delete restrict,
  blank_product_id uuid not null references public.blank_products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  blank_product_id uuid not null references public.blank_products(id) on delete cascade,
  bin_id bigint references public.bins(id) on delete set null,
  quantity_reserved integer not null check (quantity_reserved > 0),
  order_ref text,
  customer_name text,
  notes text,
  status text not null default 'active' check (status in ('active', 'released', 'fulfilled')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists inventory_reservations_product_idx on public.inventory_reservations(blank_product_id);
create index if not exists inventory_reservations_status_idx on public.inventory_reservations(status);

create table if not exists public.inventory_audit_counts (
  id uuid primary key default gen_random_uuid(),
  bin_id bigint not null references public.bins(id) on delete cascade,
  blank_product_id uuid not null references public.blank_products(id) on delete cascade,
  expected_quantity integer not null default 0,
  counted_quantity integer not null default 0,
  adjustment_quantity integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_activity (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null,
  description text not null,
  bin_id bigint,
  blank_product_id uuid,
  quantity integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_activity_created_idx on public.inventory_activity(created_at desc);

create table if not exists public.woo_sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'failed', 'ignored')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists woo_sync_queue_status_idx on public.woo_sync_queue(status, created_at);

-- =========================================================
-- 2. LOGGING HELPER
-- =========================================================

create or replace function public.log_inventory_activity(
  p_activity_type text,
  p_description text,
  p_bin_id bigint default null,
  p_blank_product_id uuid default null,
  p_quantity integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_activity(activity_type, description, bin_id, blank_product_id, quantity, metadata)
  values (p_activity_type, p_description, p_bin_id, p_blank_product_id, p_quantity, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- =========================================================
-- 3. RPC FUNCTIONS
-- =========================================================

create or replace function public.receive_blank_inventory(
  p_bin_id bigint,
  p_blank_product_id uuid,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  insert into public.blank_inventory_movements(bin_id, blank_product_id, quantity_change, notes)
  values (p_bin_id, p_blank_product_id, p_quantity, coalesce(p_notes, 'Received blank inventory'));

  perform public.log_inventory_activity('receive', 'Received blank inventory into bin', p_bin_id, p_blank_product_id, p_quantity, jsonb_build_object('notes', p_notes));

  insert into public.woo_sync_queue(entity_type, entity_id, action, payload)
  values ('blank_product', p_blank_product_id::text, 'inventory_received', jsonb_build_object('bin_id', p_bin_id, 'quantity', p_quantity));
end;
$$;

create or replace function public.set_bin_blank_inventory_quantity(
  p_bin_id bigint,
  p_blank_product_id uuid,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_delta integer;
begin
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Quantity must be zero or greater';
  end if;

  select coalesce(sum(quantity_change), 0)::integer into v_current
  from public.blank_inventory_movements
  where bin_id = p_bin_id and blank_product_id = p_blank_product_id;

  v_delta := p_quantity - coalesce(v_current, 0);

  if v_delta <> 0 then
    insert into public.blank_inventory_movements(bin_id, blank_product_id, quantity_change, notes)
    values (p_bin_id, p_blank_product_id, v_delta, coalesce(p_notes, 'Manual bin quantity adjustment'));

    perform public.log_inventory_activity('adjustment', 'Set exact bin quantity', p_bin_id, p_blank_product_id, v_delta, jsonb_build_object('from', v_current, 'to', p_quantity, 'notes', p_notes));

    insert into public.woo_sync_queue(entity_type, entity_id, action, payload)
    values ('blank_product', p_blank_product_id::text, 'inventory_adjusted', jsonb_build_object('bin_id', p_bin_id, 'delta', v_delta, 'new_quantity', p_quantity));
  end if;
end;
$$;

create or replace function public.transfer_blank_inventory(
  p_from_bin_id bigint,
  p_to_bin_id bigint,
  p_blank_product_id uuid,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available integer;
  v_transfer_id uuid;
begin
  if p_from_bin_id = p_to_bin_id then
    raise exception 'Source and destination bins must be different';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select coalesce(sum(quantity_change), 0)::integer into v_available
  from public.blank_inventory_movements
  where bin_id = p_from_bin_id and blank_product_id = p_blank_product_id;

  if coalesce(v_available, 0) < p_quantity then
    raise exception 'Not enough quantity in source bin. Available: %, requested: %', coalesce(v_available, 0), p_quantity;
  end if;

  insert into public.inventory_transfers(from_bin_id, to_bin_id, blank_product_id, quantity, notes)
  values (p_from_bin_id, p_to_bin_id, p_blank_product_id, p_quantity, p_notes)
  returning id into v_transfer_id;

  insert into public.blank_inventory_movements(bin_id, blank_product_id, quantity_change, notes)
  values
    (p_from_bin_id, p_blank_product_id, -p_quantity, coalesce(p_notes, 'Transfer out') || ' transfer ' || v_transfer_id::text),
    (p_to_bin_id, p_blank_product_id, p_quantity, coalesce(p_notes, 'Transfer in') || ' transfer ' || v_transfer_id::text);

  perform public.log_inventory_activity('transfer', 'Transferred inventory between bins', p_from_bin_id, p_blank_product_id, p_quantity, jsonb_build_object('to_bin_id', p_to_bin_id, 'transfer_id', v_transfer_id, 'notes', p_notes));

  insert into public.woo_sync_queue(entity_type, entity_id, action, payload)
  values ('blank_product', p_blank_product_id::text, 'inventory_transferred', jsonb_build_object('from_bin_id', p_from_bin_id, 'to_bin_id', p_to_bin_id, 'quantity', p_quantity));
end;
$$;

create or replace function public.reserve_blank_inventory(
  p_blank_product_id uuid,
  p_bin_id bigint default null,
  p_quantity integer default 1,
  p_order_ref text default null,
  p_customer_name text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  insert into public.inventory_reservations(blank_product_id, bin_id, quantity_reserved, order_ref, customer_name, notes)
  values (p_blank_product_id, p_bin_id, p_quantity, p_order_ref, p_customer_name, p_notes)
  returning id into v_id;

  perform public.log_inventory_activity('reservation', 'Reserved inventory internally', p_bin_id, p_blank_product_id, p_quantity, jsonb_build_object('reservation_id', v_id, 'order_ref', p_order_ref, 'customer_name', p_customer_name));

  insert into public.woo_sync_queue(entity_type, entity_id, action, payload, status)
  values ('reservation', v_id::text, 'reservation_created_internal_only', jsonb_build_object('blank_product_id', p_blank_product_id, 'quantity', p_quantity, 'order_ref', p_order_ref), 'ignored');

  return v_id;
end;
$$;

create or replace function public.release_inventory_reservation(
  p_reservation_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.inventory_reservations;
begin
  update public.inventory_reservations
  set status = 'released', released_at = now(), notes = coalesce(p_notes, notes)
  where id = p_reservation_id and status = 'active'
  returning * into v_res;

  if not found then
    raise exception 'Active reservation not found';
  end if;

  perform public.log_inventory_activity('reservation_released', 'Released inventory reservation', v_res.bin_id, v_res.blank_product_id, v_res.quantity_reserved, jsonb_build_object('reservation_id', p_reservation_id, 'notes', p_notes));
end;
$$;

create or replace function public.record_bin_audit_count(
  p_bin_id bigint,
  p_blank_product_id uuid,
  p_counted_quantity integer,
  p_expected_quantity integer default 0,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_delta integer;
begin
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'Counted quantity must be zero or greater';
  end if;

  select coalesce(sum(quantity_change), 0)::integer into v_current
  from public.blank_inventory_movements
  where bin_id = p_bin_id and blank_product_id = p_blank_product_id;

  v_delta := p_counted_quantity - coalesce(v_current, 0);

  insert into public.inventory_audit_counts(bin_id, blank_product_id, expected_quantity, counted_quantity, adjustment_quantity, notes)
  values (p_bin_id, p_blank_product_id, coalesce(v_current, p_expected_quantity, 0), p_counted_quantity, v_delta, p_notes);

  if v_delta <> 0 then
    insert into public.blank_inventory_movements(bin_id, blank_product_id, quantity_change, notes)
    values (p_bin_id, p_blank_product_id, v_delta, coalesce(p_notes, 'Audit count adjustment'));
  end if;

  perform public.log_inventory_activity('audit', 'Recorded bin audit count', p_bin_id, p_blank_product_id, v_delta, jsonb_build_object('expected', coalesce(v_current, p_expected_quantity, 0), 'counted', p_counted_quantity, 'notes', p_notes));
end;
$$;

create or replace function public.create_inventory_bin(
  p_bin_code text default null,
  p_label text default null,
  p_location text default null
)
returns setof public.bins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bin public.bins;
begin
  insert into public.bins(bin_code, label, location)
  values (nullif(trim(p_bin_code), ''), nullif(trim(p_label), ''), nullif(trim(p_location), ''))
  returning * into v_bin;

  perform public.log_inventory_activity('bin_created', 'Created inventory bin', v_bin.id, null, null, jsonb_build_object('bin_code', v_bin.bin_code, 'label', v_bin.label));

  return next v_bin;
  return;
end;
$$;

create or replace function public.update_bin_nfc_url(
  p_bin_id bigint,
  p_nfc_url text
)
returns setof public.bins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bin public.bins;
begin
  update public.bins set nfc_url = nullif(trim(p_nfc_url), '') where id = p_bin_id returning * into v_bin;

  if not found then
    raise exception 'Bin not found';
  end if;

  perform public.log_inventory_activity('nfc_updated', 'Updated bin NFC URL', p_bin_id, null, null, jsonb_build_object('nfc_url', p_nfc_url));

  return next v_bin;
  return;
end;
$$;

-- =========================================================
-- 4. VIEWS
-- =========================================================

drop view if exists public.inventory_dashboard_metrics;
drop view if exists public.inventory_valuation_by_product;
drop view if exists public.low_stock_blank_inventory;
drop view if exists public.inventory_reservations_view;
drop view if exists public.inventory_activity_feed;
drop view if exists public.bin_blank_inventory_contents;
drop view if exists public.blank_inventory_by_product;

create view public.blank_inventory_by_product as
with totals as (
  select blank_product_id, coalesce(sum(quantity_change), 0)::integer as total_quantity
  from public.blank_inventory_movements
  group by blank_product_id
), reservations as (
  select blank_product_id, coalesce(sum(quantity_reserved), 0)::integer as reserved_quantity
  from public.inventory_reservations
  where status = 'active'
  group by blank_product_id
)
select
  bp.id as blank_product_id,
  bp.sku_base,
  bp.barcode,
  bp.name,
  bp.image_url,
  bp.unit_cost,
  bp.low_stock_threshold,
  br.name as brand,
  br.code as brand_code,
  pt.name as product_type,
  pt.code as product_type_code,
  c.name as color,
  c.code as color_code,
  s.name as size,
  s.code as size_code,
  coalesce(t.total_quantity, 0)::integer as total_quantity,
  coalesce(r.reserved_quantity, 0)::integer as reserved_quantity,
  (coalesce(t.total_quantity, 0) - coalesce(r.reserved_quantity, 0))::integer as available_quantity
from public.blank_products bp
left join totals t on t.blank_product_id = bp.id
left join reservations r on r.blank_product_id = bp.id
left join public.brands br on br.id = bp.brand_id
left join public.product_types pt on pt.id = bp.product_type_id
left join public.colors c on c.id = bp.color_id
left join public.sizes s on s.id = bp.size_id;

create view public.bin_blank_inventory_contents as
with reservations as (
  select blank_product_id, bin_id, coalesce(sum(quantity_reserved), 0)::integer as reserved_quantity
  from public.inventory_reservations
  where status = 'active' and bin_id is not null
  group by blank_product_id, bin_id
)
select
  m.bin_id,
  b.bin_code,
  b.label as bin_label,
  b.location as bin_location,
  b.nfc_url,
  bp.id as blank_product_id,
  bp.sku_base,
  bp.barcode,
  bp.name,
  bp.image_url,
  bp.unit_cost,
  bp.low_stock_threshold,
  br.name as brand,
  br.code as brand_code,
  pt.name as product_type,
  pt.code as product_type_code,
  c.name as color,
  c.code as color_code,
  s.name as size,
  s.code as size_code,
  coalesce(sum(m.quantity_change), 0)::integer as quantity_on_hand,
  coalesce(r.reserved_quantity, 0)::integer as reserved_quantity,
  (coalesce(sum(m.quantity_change), 0) - coalesce(r.reserved_quantity, 0))::integer as available_quantity,
  (coalesce(sum(m.quantity_change), 0) * coalesce(bp.unit_cost, 0))::numeric(12,2) as inventory_value
from public.blank_inventory_movements m
join public.bins b on b.id = m.bin_id
join public.blank_products bp on bp.id = m.blank_product_id
left join reservations r on r.blank_product_id = bp.id and r.bin_id = m.bin_id
left join public.brands br on br.id = bp.brand_id
left join public.product_types pt on pt.id = bp.product_type_id
left join public.colors c on c.id = bp.color_id
left join public.sizes s on s.id = bp.size_id
group by m.bin_id, b.bin_code, b.label, b.location, b.nfc_url, bp.id, bp.sku_base, bp.barcode, bp.name, bp.image_url, bp.unit_cost, bp.low_stock_threshold, br.name, br.code, pt.name, pt.code, c.name, c.code, s.name, s.code, r.reserved_quantity
having coalesce(sum(m.quantity_change), 0) <> 0;

create view public.low_stock_blank_inventory as
select *
from public.blank_inventory_by_product
where low_stock_threshold > 0 and available_quantity <= low_stock_threshold;

create view public.inventory_valuation_by_product as
select
  *,
  (coalesce(total_quantity, 0) * coalesce(unit_cost, 0))::numeric(12,2) as inventory_value
from public.blank_inventory_by_product
where total_quantity <> 0;

create view public.inventory_dashboard_metrics as
select
  (select count(*) from public.bins)::integer as total_bins,
  coalesce((select sum(total_quantity) from public.blank_inventory_by_product), 0)::integer as total_units_on_hand,
  coalesce((select sum(reserved_quantity) from public.blank_inventory_by_product), 0)::integer as total_reserved_units,
  coalesce((select sum(available_quantity) from public.blank_inventory_by_product), 0)::integer as total_available_units,
  coalesce((select sum(inventory_value) from public.inventory_valuation_by_product), 0)::numeric(12,2) as total_inventory_value,
  (select count(*) from public.low_stock_blank_inventory)::integer as low_stock_count;

create view public.inventory_reservations_view as
select
  r.*,
  bp.sku_base,
  bp.name,
  b.bin_code,
  b.label as bin_label,
  b.location as bin_location
from public.inventory_reservations r
join public.blank_products bp on bp.id = r.blank_product_id
left join public.bins b on b.id = r.bin_id;

create view public.inventory_activity_feed as
select
  a.*,
  bp.sku_base,
  bp.name as blank_product_name,
  b.bin_code,
  b.label as bin_label,
  b.location as bin_location
from public.inventory_activity a
left join public.blank_products bp on bp.id = a.blank_product_id
left join public.bins b on b.id = a.bin_id;

-- =========================================================
-- 5. GRANTS
-- =========================================================

grant select on public.blank_inventory_by_product to anon, authenticated;
grant select on public.bin_blank_inventory_contents to anon, authenticated;
grant select on public.low_stock_blank_inventory to anon, authenticated;
grant select on public.inventory_valuation_by_product to anon, authenticated;
grant select on public.inventory_dashboard_metrics to anon, authenticated;
grant select on public.inventory_reservations_view to anon, authenticated;
grant select on public.inventory_activity_feed to anon, authenticated;

grant select, insert, update on public.bins to anon, authenticated;
grant select, insert on public.blank_inventory_movements to anon, authenticated;
grant select, insert, update on public.inventory_transfers to anon, authenticated;
grant select, insert, update on public.inventory_reservations to anon, authenticated;
grant select, insert on public.inventory_audit_counts to anon, authenticated;
grant select, insert on public.inventory_activity to anon, authenticated;
grant select, insert, update on public.woo_sync_queue to anon, authenticated;

grant execute on function public.receive_blank_inventory(bigint, uuid, integer, text) to anon, authenticated;
grant execute on function public.set_bin_blank_inventory_quantity(bigint, uuid, integer, text) to anon, authenticated;
grant execute on function public.transfer_blank_inventory(bigint, bigint, uuid, integer, text) to anon, authenticated;
grant execute on function public.reserve_blank_inventory(uuid, bigint, integer, text, text, text) to anon, authenticated;
grant execute on function public.release_inventory_reservation(uuid, text) to anon, authenticated;
grant execute on function public.record_bin_audit_count(bigint, uuid, integer, integer, text) to anon, authenticated;
grant execute on function public.create_inventory_bin(text, text, text) to anon, authenticated;
grant execute on function public.update_bin_nfc_url(bigint, text) to anon, authenticated;

-- RLS note:
-- If you enable Row Level Security, add policies for your app roles. Grants alone do not bypass RLS.
