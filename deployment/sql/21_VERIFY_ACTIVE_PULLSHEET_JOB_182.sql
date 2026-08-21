-- Read-only v0.8.3 verification for Job 182.
-- Expected from the August 20 diagnostic:
-- total_lines = 11
-- cancelled_history_lines = 32
-- unpaired_required_lines = 0
-- resolved_lines = 11

select *
from public.sc_active_job_item_summary_v1(array[182::bigint]);

select jsonb_pretty(to_jsonb(board_row)) as corrected_board_row
from public.sc_list_order_status_board_v2(
  p_status => null,
  p_search => '182',
  p_limit => 20
) board_row;

select jsonb_pretty(to_jsonb(pull_sheet_row)) as corrected_pull_sheet_list_row
from public.sc_existing_pull_sheets_v2() pull_sheet_row
where to_jsonb(pull_sheet_row)->>'id' = '182';

select count(*) as active_detail_rows
from public.sc_pull_sheet_items_active_v1(182);
