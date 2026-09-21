-- Skilled Crafting Inventory App v1.4.16
-- SQL 65 - Pull Sheet / Purchasing Integrity NULL-reservation hotfix
--
-- Why:
-- SQL 63's reservation_summary used COUNT(*) on a LEFT JOIN.
-- When a job item had no active reservation, the synthetic LEFT JOIN row
-- contained r.blank_product_id = NULL. PostgreSQL considered NULL DISTINCT FROM
-- the expected non-null blank ID, so the audit incorrectly reported one
-- "reservation_blank_mismatch".
--
-- This hotfix counts only real joined reservation rows.
--
-- No physical inventory, reservations, bins, or movement history are changed.
-- This only replaces the read-only integrity audit function.
-- Safe to rerun.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.sc_pullsheet_purchasing_integrity_v1(
  p_job_id bigint default null
)
returns table (
  job_id bigint,
  job_item_id bigint,
  blank_product_id uuid,
  ordered_quantity integer,
  inventory_required boolean,
  include_on_purchasing_report boolean,
  job_status text,
  job_item_status text,
  selected_bin_id bigint,
  selected_bin_is_pending boolean,
  correct_active_reservation_quantity integer,
  mismatched_active_reservation_count integer,
  quantity_on_hand integer,
  authoritative_reserved_quantity integer,
  authoritative_available_quantity integer,
  unreserved_line_quantity integer,
  expected_missing_quantity integer,
  issue_code text,
  issue_detail text
)
language sql
stable
security definer
set search_path = public
as $$
with active_lines as (
  select
    j.id as job_id,
    ji.id as job_item_id,
    ji.blank_product_id,
    greatest(
      coalesce(
        public.sc_purchasing_json_numeric_v1(to_jsonb(ji), 'quantity', 'qty'),
        0
      ),
      0
    )::integer as ordered_quantity,
    coalesce(
      nullif(to_jsonb(ji)->>'inventory_required', '')::boolean,
      true
    ) as inventory_required,
    coalesce(
      nullif(to_jsonb(ji)->>'include_on_purchasing_report', '')::boolean,
      true
    ) as include_on_purchasing_report,
    coalesce(
      public.sc_purchasing_json_text_v1(to_jsonb(j), 'status'),
      'queued'
    ) as job_status,
    coalesce(
      public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status'),
      'queued'
    ) as job_item_status,
    public.sc_purchasing_json_numeric_v1(to_jsonb(ji), 'selected_bin_id')::bigint
      as selected_bin_id
  from public.job_items ji
  join public.jobs j on j.id = ji.job_id
  where (p_job_id is null or j.id = p_job_id)
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
    )
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
    )
),
reservation_rows as (
  select
    public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'job_item_id')::bigint
      as job_item_id,
    r.blank_product_id,
    greatest(
      coalesce(
        public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'quantity',
          'reserved_quantity'
        ),
        0
      ),
      0
    )::integer as quantity
  from public.inventory_reservations r
  where public.sc_purchasing_status_is_active_v1(
    public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
  )
),
reservation_summary as (
  select
    l.job_item_id,
    coalesce(sum(r.quantity) filter (
      where r.blank_product_id = l.blank_product_id
    ), 0)::integer as correct_active_reservation_quantity,
    count(r.job_item_id) filter (
      where r.blank_product_id is distinct from l.blank_product_id
    )::integer as mismatched_active_reservation_count
  from active_lines l
  left join reservation_rows r on r.job_item_id = l.job_item_id
  group by l.job_item_id
),
joined as (
  select
    l.*,
    (l.selected_bin_id is not null
      and l.selected_bin_id = public.sc_ppi_pending_stock_bin_id_v1()
    ) as selected_bin_is_pending,
    coalesce(rs.correct_active_reservation_quantity, 0)
      as correct_active_reservation_quantity,
    coalesce(rs.mismatched_active_reservation_count, 0)
      as mismatched_active_reservation_count,
    coalesce(
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(ai),
        'quantity_on_hand',
        'on_hand_quantity',
        'on_hand',
        'total_quantity'
      ),
      0
    )::integer as quantity_on_hand,
    coalesce(
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(ai),
        'reserved_quantity',
        'reserved_units',
        'reserved'
      ),
      0
    )::integer as authoritative_reserved_quantity,
    coalesce(
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(ai),
        'available_quantity',
        'available_units',
        'available'
      ),
      coalesce(
        public.sc_purchasing_json_numeric_v1(
          to_jsonb(ai),
          'quantity_on_hand',
          'on_hand_quantity',
          'on_hand',
          'total_quantity'
        ),
        0
      )
      -
      coalesce(
        public.sc_purchasing_json_numeric_v1(
          to_jsonb(ai),
          'reserved_quantity',
          'reserved_units',
          'reserved'
        ),
        0
      )
    )::integer as authoritative_available_quantity
  from active_lines l
  left join reservation_summary rs on rs.job_item_id = l.job_item_id
  left join public.sc_purchasing_authoritative_inventory_v3 ai
    on ai.blank_product_id = l.blank_product_id
),
calculated as (
  select
    j.*,
    greatest(
      j.ordered_quantity - j.correct_active_reservation_quantity,
      0
    )::integer as unreserved_line_quantity
  from joined j
),
finalized as (
  select
    c.*,
    case
      when not c.inventory_required
        or not c.include_on_purchasing_report
        or c.blank_product_id is null
      then 0
      else greatest(
        c.unreserved_line_quantity
        - greatest(c.authoritative_available_quantity, 0),
        0
      )::integer
    end as expected_missing_quantity
  from calculated c
)
select
  f.job_id,
  f.job_item_id,
  f.blank_product_id,
  f.ordered_quantity,
  f.inventory_required,
  f.include_on_purchasing_report,
  f.job_status,
  f.job_item_status,
  f.selected_bin_id,
  f.selected_bin_is_pending,
  f.correct_active_reservation_quantity,
  f.mismatched_active_reservation_count,
  f.quantity_on_hand,
  f.authoritative_reserved_quantity,
  f.authoritative_available_quantity,
  f.unreserved_line_quantity,
  f.expected_missing_quantity,
  case
    when not f.inventory_required then 'non_inventory'
    when not f.include_on_purchasing_report then 'purchasing_excluded'
    when f.blank_product_id is null then 'missing_blank_pairing'
    when f.mismatched_active_reservation_count > 0 then 'reservation_blank_mismatch'
    when f.unreserved_line_quantity <= 0 then 'ok'
    when f.authoritative_available_quantity >= f.unreserved_line_quantity
      then 'reservation_repair_available'
    when f.expected_missing_quantity > 0
      then 'missing_purchasing_demand'
    else 'ok'
  end as issue_code,
  case
    when not f.inventory_required
      then 'This line intentionally does not use blank inventory.'
    when not f.include_on_purchasing_report
      then 'This line is intentionally excluded from Purchasing.'
    when f.blank_product_id is null
      then 'This active pull-sheet line has no paired blank product.'
    when f.mismatched_active_reservation_count > 0
      then 'An active reservation for this line points to a different blank product.'
    when f.unreserved_line_quantity <= 0
      then 'The pull-sheet quantity is represented by an active reservation.'
    when f.authoritative_available_quantity >= f.unreserved_line_quantity
      then 'Stock is available, but part of this pull-sheet quantity is not represented by an active reservation.'
    when f.expected_missing_quantity > 0
      then 'This pull-sheet line needs stock, but part of its demand is not represented by the reservation-backed Purchasing calculation.'
    else 'Pull-sheet and Purchasing state are aligned.'
  end as issue_detail
from finalized f
order by f.job_id desc, f.job_item_id;
$$;

revoke all on function public.sc_pullsheet_purchasing_integrity_v1(bigint)
  from public, anon;
grant execute on function public.sc_pullsheet_purchasing_integrity_v1(bigint)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
