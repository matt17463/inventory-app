-- Skilled Crafting Inventory App v1.4.16
-- SQL 66 - Verify Pull Sheet / Purchasing Integrity NULL-reservation hotfix
-- Read-only.

-- Pull Sheet 272 should no longer report a reservation mismatch merely because
-- no linked active reservation exists.
select
  job_id,
  job_item_id,
  blank_product_id,
  ordered_quantity,
  correct_active_reservation_quantity,
  mismatched_active_reservation_count,
  quantity_on_hand,
  authoritative_reserved_quantity,
  authoritative_available_quantity,
  unreserved_line_quantity,
  expected_missing_quantity,
  selected_bin_id,
  selected_bin_is_pending,
  issue_code,
  issue_detail
from public.sc_pullsheet_purchasing_integrity_v1(272)
order by job_item_id;

-- Any remaining true mismatch must correspond to at least one real active
-- reservation row joined to the same job_item_id and a different blank.
select
  i.job_id,
  i.job_item_id,
  i.blank_product_id as expected_blank_product_id,
  r.id as reservation_id,
  r.blank_product_id as reservation_blank_product_id,
  coalesce(
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'quantity',
      'reserved_quantity'
    ),
    0
  ) as reservation_quantity,
  public.sc_purchasing_json_text_v1(
    to_jsonb(r),
    'status'
  ) as reservation_status
from public.sc_pullsheet_purchasing_integrity_v1(272) i
join public.inventory_reservations r
  on public.sc_purchasing_json_numeric_v1(
       to_jsonb(r),
       'job_item_id'
     )::bigint = i.job_item_id
where i.mismatched_active_reservation_count > 0
  and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(
          to_jsonb(r),
          'status'
        )
      )
  and r.blank_product_id is distinct from i.blank_product_id
order by i.job_item_id, r.id;

-- Show the fallback adjustments that Purchasing will merge.
select *
from public.sc_missing_pullsheet_purchasing_demand_v1()
where demand_pullsheet_numbers like '%272%'
order by recommended_order_quantity desc, need_to_order desc, sku_base;
