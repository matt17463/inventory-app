-- Skilled Crafting Inventory App v1.4.16
-- SQL 68 - Verify Pending Stock helper correction
-- Read-only.

select
  public.sc_ppi_pending_stock_bin_id_v1() as pending_stock_bin_id;

select
  b.id,
  b.bin_code,
  b.label,
  b.location,
  b.display_order,
  case
    when b.id = public.sc_ppi_pending_stock_bin_id_v1()
      then 'SELECTED BY INTEGRITY REPAIR'
    else ''
  end as integrity_role
from public.bins b
where lower(trim(coalesce(b.bin_code, ''))) like '%pending%'
   or lower(trim(coalesce(b.label, ''))) like '%pending%'
   or lower(trim(coalesce(b.bin_code, ''))) like '%unassigned%'
   or lower(trim(coalesce(b.label, ''))) like '%unassigned%'
order by b.display_order nulls last, b.id;

-- Pull Sheet 272 is still read-only here.
select
  job_id,
  job_item_id,
  blank_product_id,
  ordered_quantity,
  correct_active_reservation_quantity,
  quantity_on_hand,
  authoritative_available_quantity,
  unreserved_line_quantity,
  expected_missing_quantity,
  selected_bin_id,
  selected_bin_is_pending,
  issue_code,
  issue_detail
from public.sc_pullsheet_purchasing_integrity_v1(272)
order by job_item_id;
