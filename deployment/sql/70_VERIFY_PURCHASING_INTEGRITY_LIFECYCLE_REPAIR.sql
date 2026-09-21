-- Skilled Crafting Inventory App v1.4.17
-- SQL 70 - Verify Purchasing integrity and reservation lifecycle repair
-- READ ONLY

with
black_am as (
  select
    i.job_id,
    i.job_item_id,
    i.blank_product_id,
    i.ordered_quantity,
    i.correct_active_reservation_quantity,
    i.mismatched_active_reservation_count,
    i.quantity_on_hand,
    i.authoritative_reserved_quantity,
    i.authoritative_available_quantity,
    i.unreserved_line_quantity,
    i.expected_missing_quantity,
    i.issue_code,
    i.selected_bin_is_pending
  from public.sc_pullsheet_purchasing_integrity_v1(270) i
  where i.job_item_id = 1150
),
black_am_fallback as (
  select *
  from public.sc_missing_pullsheet_purchasing_demand_v1()
  where blank_product_id = '8c12a37b-6afe-4d21-bd31-0bc645b942e2'::uuid
),
stale_reservations as (
  select
    count(*)::integer as row_count,
    coalesce(sum(public.sc_effective_reservation_quantity_v1(to_jsonb(r))), 0)::integer
      as unit_count
  from public.inventory_reservations r
  join public.job_items ji
    on ji.id = public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint
  join public.jobs j on j.id = ji.job_id
  where public.sc_purchasing_status_is_active_v1(
          public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
        )
    and (
      not public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
      )
      or not public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
      )
    )
),
fully_reserved_pending as (
  select count(*)::integer as row_count
  from public.sc_pullsheet_purchasing_integrity_v1(null) i
  where i.inventory_required
    and i.selected_bin_is_pending
    and i.ordered_quantity > 0
    and i.correct_active_reservation_quantity >= i.ordered_quantity
),
real_mismatches as (
  select count(*)::integer as row_count
  from public.inventory_reservations r
  join public.job_items ji
    on ji.id = public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint
  join public.jobs j on j.id = ji.job_id
  where public.sc_purchasing_status_is_active_v1(
          public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
        )
    and public.sc_purchasing_status_is_active_v1(
          public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
        )
    and public.sc_purchasing_status_is_active_v1(
          public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
        )
    and r.blank_product_id is distinct from ji.blank_product_id
),
missing_pairings as (
  select count(*)::integer as row_count
  from public.job_items ji
  join public.jobs j on j.id = ji.job_id
  where ji.blank_product_id is null
    and coalesce(
      nullif(to_jsonb(ji)->>'inventory_required', '')::boolean,
      true
    )
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
    )
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
    )
),
backup_counts as (
  select
    (select count(*) from public.sc_backup_stale_reservations_v1417_20260921)
      as stale_reservation_backup_rows,
    (select count(*) from public.sc_backup_pending_stock_lines_v1417_20260921)
      as pending_line_backup_rows
),
checks as (
  select
    1 as sort_order,
    'BLACK_AM_CORRECT_SHORTAGE'::text as check_name,
    case
      when (select count(*) from black_am) = 1
       and (select mismatched_active_reservation_count from black_am) = 0
       and (select quantity_on_hand from black_am) = 2
       and (select ordered_quantity from black_am) = 10
       and (select expected_missing_quantity from black_am) = 8
       and (select issue_code from black_am) = 'missing_purchasing_demand'
       and coalesce((select need_to_order from black_am_fallback limit 1), 0) = 8
      then 'PASS'
      else 'REVIEW'
    end as status,
    jsonb_build_object(
      'integrity', (select to_jsonb(b) from black_am b),
      'fallback', (select to_jsonb(f) from black_am_fallback f limit 1)
    ) as details

  union all

  select
    2,
    'NO_FALSE_NULL_RESERVATION_MISMATCH',
    case
      when coalesce((select mismatched_active_reservation_count from black_am), -1) = 0
      then 'PASS'
      else 'FAIL'
    end,
    jsonb_build_object(
      'black_am_mismatch_count',
      (select mismatched_active_reservation_count from black_am)
    )

  union all

  select
    3,
    'STALE_ACTIVE_RESERVATIONS_RELEASED',
    case when (select row_count from stale_reservations) = 0 then 'PASS' else 'FAIL' end,
    jsonb_build_object(
      'remaining_rows', (select row_count from stale_reservations),
      'remaining_units', (select unit_count from stale_reservations),
      'backup_rows', (select stale_reservation_backup_rows from backup_counts)
    )

  union all

  select
    4,
    'FULLY_RESERVED_PENDING_STOCK_CLEARED',
    case when (select row_count from fully_reserved_pending) = 0 then 'PASS' else 'FAIL' end,
    jsonb_build_object(
      'remaining_lines', (select row_count from fully_reserved_pending),
      'backup_rows', (select pending_line_backup_rows from backup_counts)
    )

  union all

  select
    5,
    'REAL_ACTIVE_RESERVATION_MISMATCHES',
    case when (select row_count from real_mismatches) = 0 then 'PASS' else 'REVIEW' end,
    jsonb_build_object(
      'remaining_real_mismatch_rows', (select row_count from real_mismatches)
    )

  union all

  select
    6,
    'ACTIVE_LINES_MISSING_BLANK_PAIRING',
    case when (select row_count from missing_pairings) = 0 then 'PASS' else 'REVIEW' end,
    jsonb_build_object(
      'remaining_unpaired_lines', (select row_count from missing_pairings),
      'note', 'These require product mapping or non-inventory decisions; SQL 69 does not guess.'
    )

  union all

  select
    7,
    'GUARDED_STATUS_FUNCTIONS_INSTALLED',
    case
      when to_regprocedure(
        'public.sc_set_job_status_safe_v1(bigint,text,uuid,text)'
      ) is not null
       and to_regprocedure(
        'public.sc_set_job_item_status_safe_v1(bigint,text,uuid,text)'
      ) is not null
      then 'PASS'
      else 'FAIL'
    end,
    jsonb_build_object(
      'job_status_rpc',
      to_regprocedure(
        'public.sc_set_job_status_safe_v1(bigint,text,uuid,text)'
      )::text,
      'line_status_rpc',
      to_regprocedure(
        'public.sc_set_job_item_status_safe_v1(bigint,text,uuid,text)'
      )::text
    )
)
select
  check_name,
  status,
  details
from checks
order by sort_order;
