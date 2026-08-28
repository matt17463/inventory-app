-- Skilled Crafting Inventory v1.1.2
-- READ ONLY verification for migration 38.

select
  to_regclass('public.sc_purchasing_demand_sources_v2') is not null
    as compatibility_view_installed,
  has_table_privilege(
    'authenticated',
    'public.sc_purchasing_demand_sources_v2',
    'select'
  ) as authenticated_can_read;

select
  blank_product_id,
  demand_source_count,
  demand_total_quantity,
  demand_order_numbers,
  demand_pullsheet_numbers,
  demand_sources
from public.sc_purchasing_demand_sources_v2
where blank_product_id::text =
  '77b3a4a2-82c3-4ca2-a350-7a76a2b1818e';

-- Expected for Pullsheet 195 / Gildan 18500 Purple YM before changing
-- the manual invoice quantity:
--   demand_source_count    = 1
--   demand_total_quantity  = 3
--   demand_sources[0].job_item_id = 906
--   demand_sources[0].quantity    = 3

select
  ji.job_id,
  ji.id as job_item_id,
  ji.sku,
  ji.quantity as pullsheet_quantity,
  sum(
    case
      when lower(coalesce(r.status, '')) in
        ('released', 'completed', 'cancelled', 'canceled', 'voided')
        then 0
      else greatest(
        coalesce(r.quantity_reserved, 0),
        coalesce(r.quantity, 0)
      )
    end
  ) as active_reserved_quantity,
  count(*) filter (
    where lower(coalesce(r.status, '')) not in
      ('released', 'completed', 'cancelled', 'canceled', 'voided')
  ) as active_reservation_rows
from public.job_items ji
left join public.inventory_reservations r
  on r.job_item_id::text = ji.id::text
where ji.job_id = 195
  and ji.sku = 'GILDAN-18500-PURPLE-YM'
group by ji.job_id, ji.id, ji.sku, ji.quantity;
