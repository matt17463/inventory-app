-- Skilled Crafting v1.4.29
-- Client Order Pricing + Controlled Conversion
--
-- Phase 3:
--   * map submitted client-order lines to authoritative blank products
--   * save pricing/costing per line
--   * track quote totals and approval/payment state
-- Phase 4:
--   * save external/QuickBooks invoice reference
--   * record conversion to the existing manual-order/job workflow
--
-- This migration does NOT create jobs, reservations, purchasing demand,
-- invoices, or inventory movements by itself. Those remain explicit operator actions.

alter table public.sc_client_order_requests
  add column if not exists quote_notes text,
  add column if not exists shipping_amount numeric(12,2) not null default 0,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists payment_received_at timestamptz,
  add column if not exists external_invoice_number text,
  add column if not exists manual_order_id bigint,
  add column if not exists generated_job_id bigint,
  add column if not exists converted_at timestamptz,
  add column if not exists conversion_note text;

alter table public.sc_client_order_request_items
  add column if not exists blank_product_id uuid references public.blank_products(id) on delete set null,
  add column if not exists sku_base text,
  add column if not exists mapped_item_name text,
  add column if not exists brand text,
  add column if not exists style text,
  add column if not exists mapped_color text,
  add column if not exists mapped_size text,
  add column if not exists unit_cost numeric(12,2) not null default 0,
  add column if not exists decoration_cost numeric(12,2) not null default 0,
  add column if not exists labor_cost numeric(12,2) not null default 0,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists pricing_rule_id text,
  add column if not exists pricing_rule_name text,
  add column if not exists placement text,
  add column if not exists decoration_size text,
  add column if not exists artwork_note text;

create index if not exists sc_client_order_items_blank_product_idx
  on public.sc_client_order_request_items(blank_product_id)
  where blank_product_id is not null;

create index if not exists sc_client_order_conversion_idx
  on public.sc_client_order_requests(manual_order_id, generated_job_id)
  where manual_order_id is not null or generated_job_id is not null;

grant update on public.sc_client_order_request_items to authenticated;

drop policy if exists sc_client_order_items_employee_update
  on public.sc_client_order_request_items;

create policy sc_client_order_items_employee_update
on public.sc_client_order_request_items
for update to authenticated
using (
  exists (
    select 1
    from public.sc_app_user_roles r
    where r.user_id = auth.uid()
      and r.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.sc_app_user_roles r
    where r.user_id = auth.uid()
      and r.is_active = true
  )
);

drop view if exists public.sc_client_order_requests_detail;

create view public.sc_client_order_requests_detail
with (security_invoker = true) as
select
  r.*,
  coalesce(i.item_count, 0)::integer as item_count,
  coalesce(i.total_quantity, 0)::integer as total_quantity,
  coalesce(i.mapped_item_count, 0)::integer as mapped_item_count,
  coalesce(i.priced_item_count, 0)::integer as priced_item_count,
  coalesce(i.quote_subtotal, 0)::numeric(12,2) as quote_subtotal,
  (
    coalesce(i.quote_subtotal, 0)
    + coalesce(r.shipping_amount, 0)
    + coalesce(r.tax_amount, 0)
  )::numeric(12,2) as quote_total
from public.sc_client_order_requests r
left join (
  select
    request_id,
    count(*) as item_count,
    sum(quantity) as total_quantity,
    count(*) filter (where blank_product_id is not null) as mapped_item_count,
    count(*) filter (where unit_price > 0) as priced_item_count,
    sum(quantity * unit_price) as quote_subtotal
  from public.sc_client_order_request_items
  group by request_id
) i on i.request_id = r.id;

grant select on public.sc_client_order_requests_detail to authenticated;
