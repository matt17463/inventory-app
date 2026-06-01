-- Skilled Crafting Inventory App updates
-- Adds bin-content support, quantity adjustment RPC, and optional NFC URL storage.
-- Run this in Supabase SQL Editor before using the updated app screens.

-- Optional columns used by the app. These are safe if they already exist.
alter table public.bins
  add column if not exists bin_code text,
  add column if not exists label text,
  add column if not exists location text,
  add column if not exists nfc_url text,
  add column if not exists created_at timestamptz default now();

-- Movement ledger for blank inventory by bin.
-- If your original project already has this table, this statement will not replace it.
create table if not exists public.blank_inventory_movements (
  id bigserial primary key,
  bin_id bigint not null references public.bins(id) on delete cascade,
  blank_product_id bigint not null references public.blank_products(id) on delete cascade,
  quantity_change integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists blank_inventory_movements_bin_idx
  on public.blank_inventory_movements(bin_id);

create index if not exists blank_inventory_movements_product_idx
  on public.blank_inventory_movements(blank_product_id);

-- Aggregate bin-level blank inventory contents.
create or replace view public.bin_blank_inventory_contents as
select
  m.bin_id,
  b.bin_code,
  b.label as bin_label,
  b.location as bin_location,
  bp.id as blank_product_id,
  bp.sku_base,
  bp.name,
  bp.image_url,
  br.name as brand,
  br.code as brand_code,
  pt.name as product_type,
  pt.code as product_type_code,
  c.name as color,
  c.code as color_code,
  s.name as size,
  s.code as size_code,
  coalesce(sum(m.quantity_change), 0)::integer as quantity_on_hand
from public.blank_inventory_movements m
join public.bins b on b.id = m.bin_id
join public.blank_products bp on bp.id = m.blank_product_id
left join public.brands br on br.id = bp.brand_id
left join public.product_types pt on pt.id = bp.product_type_id
left join public.colors c on c.id = bp.color_id
left join public.sizes s on s.id = bp.size_id
group by
  m.bin_id,
  b.bin_code,
  b.label,
  b.location,
  bp.id,
  bp.sku_base,
  bp.name,
  bp.image_url,
  br.name,
  br.code,
  pt.name,
  pt.code,
  c.name,
  c.code,
  s.name,
  s.code
having coalesce(sum(m.quantity_change), 0) <> 0;

-- If your receive_blank_inventory function does not already exist, this provides it.
-- If it already exists with this signature, it will be replaced with ledger behavior.
create or replace function public.receive_blank_inventory(
  p_bin_id bigint,
  p_blank_product_id bigint,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
as $$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  insert into public.blank_inventory_movements (
    bin_id,
    blank_product_id,
    quantity_change,
    notes
  ) values (
    p_bin_id,
    p_blank_product_id,
    p_quantity,
    p_notes
  );
end;
$$;

-- Sets an exact quantity for one blank item in one bin by inserting an adjustment movement.
create or replace function public.set_bin_blank_inventory_quantity(
  p_bin_id bigint,
  p_blank_product_id bigint,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_current integer;
  v_delta integer;
begin
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Quantity must be zero or greater';
  end if;

  select coalesce(sum(quantity_change), 0)::integer
    into v_current
  from public.blank_inventory_movements
  where bin_id = p_bin_id
    and blank_product_id = p_blank_product_id;

  v_delta := p_quantity - coalesce(v_current, 0);

  if v_delta <> 0 then
    insert into public.blank_inventory_movements (
      bin_id,
      blank_product_id,
      quantity_change,
      notes
    ) values (
      p_bin_id,
      p_blank_product_id,
      v_delta,
      coalesce(p_notes, 'Manual bin quantity adjustment')
    );
  end if;
end;
$$;

-- Optional convenience RPC for creating bins.
create or replace function public.create_inventory_bin(
  p_bin_code text default null,
  p_label text default null,
  p_location text default null
)
returns public.bins
language plpgsql
security definer
as $$
declare
  v_bin public.bins;
begin
  insert into public.bins (bin_code, label, location)
  values (nullif(trim(p_bin_code), ''), nullif(trim(p_label), ''), nullif(trim(p_location), ''))
  returning * into v_bin;

  return v_bin;
end;
$$;

grant select on public.bin_blank_inventory_contents to anon, authenticated;
grant execute on function public.receive_blank_inventory(bigint, bigint, integer, text) to anon, authenticated;
grant execute on function public.set_bin_blank_inventory_quantity(bigint, bigint, integer, text) to anon, authenticated;
grant execute on function public.create_inventory_bin(text, text, text) to anon, authenticated;
