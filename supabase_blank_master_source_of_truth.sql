-- Skilled Crafting Blank Products Source-of-Truth Migration
-- Supabase blank_products becomes the master blank catalog.
-- The app uploads a spreadsheet and calls replace_blank_product_master_from_json().
--
-- This migration:
-- 1) Adds needed columns to blank_products/products/finished_products.
-- 2) Creates helper functions.
-- 3) Creates RPC replace_blank_product_master_from_json(jsonb, text).
-- 4) Creates RPC wcsb_link_woo_product_to_blank_and_finished(text).
--
-- Run this in Supabase SQL Editor before deploying the app update.

create extension if not exists pgcrypto;

-- =========================================================
-- Schema compatibility
-- =========================================================

alter table public.blank_products add column if not exists barcode text;
alter table public.blank_products add column if not exists image_url text;
alter table public.blank_products add column if not exists unit_cost numeric default 0;
alter table public.blank_products add column if not exists low_stock_threshold integer;
alter table public.blank_products add column if not exists supplier text;
alter table public.blank_products add column if not exists supplier_sku text;
alter table public.blank_products add column if not exists notes text;
alter table public.blank_products add column if not exists master_source text default 'manual';
alter table public.blank_products add column if not exists master_imported_at timestamptz;
alter table public.blank_products add column if not exists master_import_file text;

alter table public.products add column if not exists blank_product_id uuid;
alter table public.products add column if not exists woo_link_status text;
alter table public.products add column if not exists woo_linked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'products'
      and constraint_name = 'products_blank_product_id_fkey'
  ) then
    alter table public.products
      add constraint products_blank_product_id_fkey
      foreign key (blank_product_id)
      references public.blank_products(id)
      on delete set null;
  end if;
end $$;

alter table public.finished_products add column if not exists sku text;
alter table public.finished_products add column if not exists finished_sku text;
alter table public.finished_products add column if not exists name text;
alter table public.finished_products add column if not exists customer_name text;
alter table public.finished_products add column if not exists logo_name text;
alter table public.finished_products add column if not exists blank_product_id uuid;
alter table public.finished_products add column if not exists placement text;
alter table public.finished_products add column if not exists decoration_size text;
alter table public.finished_products add column if not exists woo_product_id bigint;
alter table public.finished_products add column if not exists woo_variation_id bigint;
alter table public.finished_products add column if not exists source text default 'woocommerce';
alter table public.finished_products add column if not exists notes text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'finished_products'
      and constraint_name = 'finished_products_blank_product_id_fkey'
  ) then
    alter table public.finished_products
      add constraint finished_products_blank_product_id_fkey
      foreign key (blank_product_id)
      references public.blank_products(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists ux_blank_products_sku_base
on public.blank_products (sku_base);

create index if not exists idx_blank_products_attributes
on public.blank_products (brand_id, product_type_id, color_id, size_id);

create index if not exists idx_products_blank_product_id
on public.products (blank_product_id);

create index if not exists idx_products_woo_ids
on public.products (woocommerce_product_id, woocommerce_variation_id);

create index if not exists idx_finished_products_blank_product_id
on public.finished_products (blank_product_id);

create unique index if not exists ux_finished_products_sku_not_null
on public.finished_products (sku)
where sku is not null;

-- =========================================================
-- Helpers
-- =========================================================

create or replace function public.sc_master_norm(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9]+', '', 'g');
$$;

create or replace function public.sc_master_code(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9]+', '', 'g'), '');
$$;

create or replace function public.sc_master_sku(p_brand text, p_style text, p_color text, p_size text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    upper(concat_ws('-', nullif(trim(p_brand), ''), nullif(trim(p_style), ''), nullif(trim(p_color), ''), nullif(trim(p_size), ''))),
    '[^A-Z0-9]+',
    '-',
    'g'
  ));
$$;

-- =========================================================
-- Main RPC: replace blank product master
-- =========================================================

create or replace function public.replace_blank_product_master_from_json(
  p_rows jsonb,
  p_source_file_name text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row jsonb;
  v_brand text;
  v_style text;
  v_color text;
  v_size text;
  v_sku_base text;
  v_name text;
  v_bin_code text;
  v_barcode text;
  v_image_url text;
  v_supplier text;
  v_supplier_sku text;
  v_notes text;
  v_qty integer;
  v_unit_cost numeric;
  v_low_stock integer;

  v_brand_id public.brands.id%type;
  v_type_id public.product_types.id%type;
  v_color_id public.colors.id%type;
  v_size_id public.sizes.id%type;
  v_bin_id public.bins.id%type;
  v_blank_id public.blank_products.id%type;

  v_inserted_blanks integer := 0;
  v_inserted_movements integer := 0;
  v_created_bins integer := 0;
  v_created_brands integer := 0;
  v_created_styles integer := 0;
  v_created_colors integer := 0;
  v_created_sizes integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'p_rows must be a non-empty JSON array';
  end if;

  -- Backups. These are append-only snapshots.
  create table if not exists public.backup_blank_products_master_import as
  select now()::timestamptz as backup_created_at, * from public.blank_products where false;

  create table if not exists public.backup_blank_inventory_movements_master_import as
  select now()::timestamptz as backup_created_at, * from public.blank_inventory_movements where false;

  create table if not exists public.backup_finished_products_master_import as
  select now()::timestamptz as backup_created_at, * from public.finished_products where false;

  insert into public.backup_blank_products_master_import
  select now()::timestamptz, bp.* from public.blank_products bp;

  insert into public.backup_blank_inventory_movements_master_import
  select now()::timestamptz, bim.* from public.blank_inventory_movements bim;

  insert into public.backup_finished_products_master_import
  select now()::timestamptz, fp.* from public.finished_products fp;

  -- Clear dependent inventory/catalog rows because this is a replacement master import.
  if to_regclass('public.inventory_reservations') is not null then
    delete from public.inventory_reservations;
  end if;

  if to_regclass('public.finished_inventory_movements') is not null then
    delete from public.finished_inventory_movements;
  end if;

  if to_regclass('public.finished_products') is not null then
    delete from public.finished_products;
  end if;

  if to_regclass('public.blank_inventory_movements') is not null then
    delete from public.blank_inventory_movements;
  end if;

  update public.products set blank_product_id = null, woo_link_status = null, woo_linked_at = null
  where blank_product_id is not null or woo_link_status is not null or woo_linked_at is not null;

  delete from public.blank_products;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_brand := nullif(trim(coalesce(v_row->>'brand', '')), '');
    v_style := nullif(trim(coalesce(v_row->>'style', '')), '');
    v_color := nullif(trim(coalesce(v_row->>'color', '')), '');
    v_size := nullif(trim(coalesce(v_row->>'size', '')), '');

    if v_brand is null or v_style is null or v_color is null or v_size is null then
      raise exception 'Every row requires Brand, Style, Color, and Size. Bad row: %', v_row;
    end if;

    v_sku_base := nullif(trim(coalesce(v_row->>'sku_base', '')), '');
    if v_sku_base is null then
      v_sku_base := public.sc_master_sku(v_brand, v_style, v_color, v_size);
    else
      v_sku_base := upper(regexp_replace(v_sku_base, '[^A-Za-z0-9]+', '-', 'g'));
      v_sku_base := trim(both '-' from v_sku_base);
    end if;

    v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
    if v_name is null then
      v_name := concat_ws(' ', v_brand, v_style, v_color, v_size);
    end if;

    v_bin_code := nullif(trim(coalesce(v_row->>'bin', '')), '');
    v_barcode := nullif(trim(coalesce(v_row->>'barcode', '')), '');
    v_image_url := nullif(trim(coalesce(v_row->>'image_url', '')), '');
    v_supplier := nullif(trim(coalesce(v_row->>'supplier', '')), '');
    v_supplier_sku := nullif(trim(coalesce(v_row->>'supplier_sku', '')), '');
    v_notes := nullif(trim(coalesce(v_row->>'notes', '')), '');

    v_qty := coalesce(nullif(v_row->>'quantity','')::numeric, 0)::integer;
    v_unit_cost := coalesce(nullif(v_row->>'unit_cost','')::numeric, 0);
    v_low_stock := nullif(v_row->>'low_stock_threshold','')::numeric::integer;

    if v_qty < 0 then
      raise exception 'Quantity cannot be negative for SKU %', v_sku_base;
    end if;

    if v_qty > 0 and v_bin_code is null then
      raise exception 'Bin is required when quantity is greater than zero for SKU %', v_sku_base;
    end if;

    -- Brand
    select id into v_brand_id
    from public.brands
    where public.sc_master_norm(code) = public.sc_master_norm(v_brand)
       or public.sc_master_norm(name) = public.sc_master_norm(v_brand)
    limit 1;

    if v_brand_id is null then
      insert into public.brands (code, name)
      values (coalesce(public.sc_master_code(v_brand), v_brand), v_brand)
      returning id into v_brand_id;
      v_created_brands := v_created_brands + 1;
    end if;

    -- Style / Product Type
    select id into v_type_id
    from public.product_types
    where public.sc_master_norm(code) = public.sc_master_norm(v_style)
       or public.sc_master_norm(name) = public.sc_master_norm(v_style)
    limit 1;

    if v_type_id is null then
      insert into public.product_types (code, name)
      values (coalesce(public.sc_master_code(v_style), v_style), v_style)
      returning id into v_type_id;
      v_created_styles := v_created_styles + 1;
    end if;

    -- Color
    select id into v_color_id
    from public.colors
    where public.sc_master_norm(code) = public.sc_master_norm(v_color)
       or public.sc_master_norm(name) = public.sc_master_norm(v_color)
    limit 1;

    if v_color_id is null then
      insert into public.colors (code, name)
      values (coalesce(public.sc_master_code(v_color), v_color), v_color)
      returning id into v_color_id;
      v_created_colors := v_created_colors + 1;
    end if;

    -- Size
    select id into v_size_id
    from public.sizes
    where public.sc_master_norm(code) = public.sc_master_norm(v_size)
       or public.sc_master_norm(name) = public.sc_master_norm(v_size)
    limit 1;

    if v_size_id is null then
      insert into public.sizes (code, name)
      values (v_size, v_size)
      returning id into v_size_id;
      v_created_sizes := v_created_sizes + 1;
    end if;

    -- Insert blank product
    insert into public.blank_products (
      sku_base,
      barcode,
      name,
      brand_id,
      product_type_id,
      color_id,
      size_id,
      image_url,
      unit_cost,
      low_stock_threshold,
      supplier,
      supplier_sku,
      notes,
      master_source,
      master_imported_at,
      master_import_file
    ) values (
      v_sku_base,
      v_barcode,
      v_name,
      v_brand_id,
      v_type_id,
      v_color_id,
      v_size_id,
      v_image_url,
      v_unit_cost,
      v_low_stock,
      v_supplier,
      v_supplier_sku,
      v_notes,
      'spreadsheet',
      now(),
      p_source_file_name
    )
    returning id into v_blank_id;

    v_inserted_blanks := v_inserted_blanks + 1;

    -- Bin + initial inventory movement
    if v_qty > 0 then
      select id into v_bin_id
      from public.bins
      where public.sc_master_norm(bin_code) = public.sc_master_norm(v_bin_code)
         or public.sc_master_norm(label) = public.sc_master_norm(v_bin_code)
         or public.sc_master_norm(location) = public.sc_master_norm(v_bin_code)
      limit 1;

      if v_bin_id is null then
        insert into public.bins (bin_code, label, location)
        values (v_bin_code, v_bin_code, 'Imported master blank inventory')
        returning id into v_bin_id;
        v_created_bins := v_created_bins + 1;
      end if;

      insert into public.blank_inventory_movements (
        bin_id,
        blank_product_id,
        quantity_change,
        notes
      ) values (
        v_bin_id,
        v_blank_id,
        v_qty,
        concat_ws(' | ', 'Blank product master import', p_source_file_name, v_notes)
      );

      v_inserted_movements := v_inserted_movements + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'source_file', p_source_file_name,
    'input_rows', jsonb_array_length(p_rows),
    'inserted_blank_products', v_inserted_blanks,
    'inserted_inventory_movements', v_inserted_movements,
    'created_bins', v_created_bins,
    'created_brands', v_created_brands,
    'created_styles', v_created_styles,
    'created_colors', v_created_colors,
    'created_sizes', v_created_sizes
  );
end;
$$;

grant execute on function public.replace_blank_product_master_from_json(jsonb, text)
to anon, authenticated;

-- =========================================================
-- WooCommerce linking RPC
-- =========================================================

create or replace function public.wcsb_link_woo_product_to_blank_and_finished(p_sku text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_product public.products%rowtype;
  v_blank_id public.blank_products.id%type;
  v_blank_count integer := 0;
  v_customer_name text;
  v_logo_name text;
  v_finished_id public.finished_products.id%type;
begin
  select *
  into v_product
  from public.products
  where sku = p_sku
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_not_found', 'sku', p_sku);
  end if;

  -- First try exact attribute match against master blank catalog.
  select count(*)
  into v_blank_count
  from public.blank_products bp
  where bp.brand_id is not distinct from v_product.brand_id
    and bp.product_type_id is not distinct from v_product.product_type_id
    and bp.color_id is not distinct from v_product.color_id
    and bp.size_id is not distinct from v_product.size_id;

  if v_blank_count = 1 then
    select bp.id
    into v_blank_id
    from public.blank_products bp
    where bp.brand_id is not distinct from v_product.brand_id
      and bp.product_type_id is not distinct from v_product.product_type_id
      and bp.color_id is not distinct from v_product.color_id
      and bp.size_id is not distinct from v_product.size_id
    limit 1;
  elsif v_blank_count > 1 then
    -- If duplicates exist, prefer a blank SKU contained inside the Woo SKU.
    select bp.id
    into v_blank_id
    from public.blank_products bp
    where bp.brand_id is not distinct from v_product.brand_id
      and bp.product_type_id is not distinct from v_product.product_type_id
      and bp.color_id is not distinct from v_product.color_id
      and bp.size_id is not distinct from v_product.size_id
      and public.sc_master_norm(v_product.sku) like '%' || public.sc_master_norm(bp.sku_base) || '%'
    limit 1;
  end if;

  if v_blank_id is null then
    update public.products
    set blank_product_id = null,
        woo_link_status = 'no_blank_match',
        woo_linked_at = now()
    where sku = p_sku;

    return jsonb_build_object(
      'ok', false,
      'reason', 'no_blank_match',
      'sku', p_sku,
      'brand_id', v_product.brand_id,
      'product_type_id', v_product.product_type_id,
      'color_id', v_product.color_id,
      'size_id', v_product.size_id
    );
  end if;

  update public.products
  set blank_product_id = v_blank_id,
      woo_link_status = 'linked',
      woo_linked_at = now()
  where sku = p_sku;

  if coalesce(v_product.is_finished, false) then
    if v_product.customer_id is not null then
      select name into v_customer_name from public.customers where id = v_product.customer_id limit 1;
    end if;

    if v_product.logo_id is not null then
      select name into v_logo_name from public.logos where id = v_product.logo_id limit 1;
    end if;

    select id
    into v_finished_id
    from public.finished_products
    where sku = v_product.sku
       or finished_sku = v_product.sku
    limit 1;

    if v_finished_id is null then
      insert into public.finished_products (
        sku,
        finished_sku,
        name,
        customer_name,
        logo_name,
        blank_product_id,
        woo_product_id,
        woo_variation_id,
        source,
        notes
      ) values (
        v_product.sku,
        v_product.sku,
        v_product.name,
        v_customer_name,
        v_logo_name,
        v_blank_id,
        v_product.woocommerce_product_id,
        v_product.woocommerce_variation_id,
        'woocommerce',
        'Created by WooCommerce sync and linked to Supabase blank master'
      )
      returning id into v_finished_id;
    else
      update public.finished_products
      set
        finished_sku = v_product.sku,
        name = v_product.name,
        customer_name = coalesce(v_customer_name, customer_name),
        logo_name = coalesce(v_logo_name, logo_name),
        blank_product_id = v_blank_id,
        woo_product_id = v_product.woocommerce_product_id,
        woo_variation_id = v_product.woocommerce_variation_id,
        source = 'woocommerce'
      where id = v_finished_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'sku', p_sku,
    'blank_product_id', v_blank_id,
    'finished_product_id', v_finished_id
  );
end;
$$;

grant execute on function public.wcsb_link_woo_product_to_blank_and_finished(text)
to anon, authenticated;

-- =========================================================
-- Validation views/queries
-- =========================================================

create or replace view public.woo_products_unmatched_to_blank_master as
select
  p.id,
  p.sku,
  p.name,
  p.woocommerce_product_id,
  p.woocommerce_variation_id,
  p.brand_id,
  br.name as brand,
  p.product_type_id,
  pt.name as product_type,
  p.color_id,
  c.name as color,
  p.size_id,
  s.name as size,
  p.woo_link_status,
  p.woo_linked_at
from public.products p
left join public.brands br on br.id = p.brand_id
left join public.product_types pt on pt.id = p.product_type_id
left join public.colors c on c.id = p.color_id
left join public.sizes s on s.id = p.size_id
where p.blank_product_id is null;

create or replace view public.finished_products_linked_to_blank_master as
select
  fp.id,
  fp.sku,
  fp.finished_sku,
  fp.name,
  fp.customer_name,
  fp.logo_name,
  fp.blank_product_id,
  bp.sku_base as blank_sku_base,
  br.name as brand,
  pt.name as product_type,
  c.name as color,
  s.name as size
from public.finished_products fp
left join public.blank_products bp on bp.id = fp.blank_product_id
left join public.brands br on br.id = bp.brand_id
left join public.product_types pt on pt.id = bp.product_type_id
left join public.colors c on c.id = bp.color_id
left join public.sizes s on s.id = bp.size_id;
