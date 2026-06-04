-- Skilled Crafting Inventory App
-- Safe helper migration for creating blank inventory items from the app.
-- Run this only if creating blank items fails because one of these columns is missing.

alter table public.blank_products
  add column if not exists barcode text,
  add column if not exists image_url text,
  add column if not exists unit_cost numeric(10,2) default 0,
  add column if not exists low_stock_threshold integer default 0;

create unique index if not exists blank_products_sku_base_unique_idx
  on public.blank_products(sku_base);

create index if not exists blank_products_barcode_idx
  on public.blank_products(barcode);

grant select, insert, update on public.blank_products to anon, authenticated;
