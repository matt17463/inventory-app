-- Skilled Crafting Inventory App v1.4.17 source-aligned hotfix
-- SQL 65 - Purchasing Reservation Quantity Consistency (source-aligned)
--
-- PURPOSE
--   Fix false Purchasing "Integrity fallback" demand caused by reservation rows
--   that store the real reserved quantity in quantity_reserved while quantity = 0.
--
--   Also prevents reservations belonging to inactive/closed jobs or job items
--   from inflating the authoritative Purchasing reserved quantity.
--
-- SAFETY
--   * DOES NOT change physical inventory.
--   * DOES NOT insert/delete/update inventory movements.
--   * DOES NOT rewrite reservation quantities or statuses.
--   * Replaces calculation logic only.
--
-- Safe to rerun.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ============================================================
-- 1. Canonical reservation quantity helper
--    Do not trust only one legacy quantity column.
-- ============================================================

create or replace function public.sc_effective_reservation_quantity_v1(
  p_row jsonb
)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(
    coalesce(public.sc_purchasing_json_numeric_v1(p_row, 'quantity_reserved'), 0),
    coalesce(public.sc_purchasing_json_numeric_v1(p_row, 'quantity'), 0),
    coalesce(public.sc_purchasing_json_numeric_v1(p_row, 'reserved_quantity'), 0),
    0
  )::integer;
$$;

revoke all on function public.sc_effective_reservation_quantity_v1(jsonb)
  from public, anon;
grant execute on function public.sc_effective_reservation_quantity_v1(jsonb)
  to authenticated, service_role;

-- ============================================================
-- 2. Authoritative Purchasing inventory
--    Count only active reservations whose parent work is active.
--    Null job_item_id reservations are retained for compatibility.
-- ============================================================

create or replace view public.sc_purchasing_authoritative_inventory_v3
with (security_invoker=true) as
with movement as (
  select
    blank_product_id::uuid as blank_product_id,
    sum(quantity_change)::numeric as quantity_on_hand
  from public.blank_inventory_movements
  group by blank_product_id
),
reservation_rows as (
  select
    r.blank_product_id::uuid as blank_product_id,
    public.sc_effective_reservation_quantity_v1(to_jsonb(r))::numeric
      as reserved_quantity
  from public.inventory_reservations r
  left join public.job_items ji
    on ji.id = public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint
  left join public.jobs j
    on j.id = coalesce(
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'job_id'
      )::bigint,
      ji.job_id
    )
  where public.sc_purchasing_status_is_active_v1(
          public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
        )
    and (
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'job_item_id'
      ) is null
      or (
        ji.id is not null
        and j.id is not null
        and public.sc_purchasing_status_is_active_v1(
              public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
            )
        and public.sc_purchasing_status_is_active_v1(
              public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
            )
      )
    )
),
reservation as (
  select
    blank_product_id,
    sum(greatest(reserved_quantity, 0))::numeric as reserved_quantity
  from reservation_rows
  group by blank_product_id
)
select
  bp.id::uuid as blank_product_id,
  coalesce(m.quantity_on_hand, 0) as quantity_on_hand,
  coalesce(r.reserved_quantity, 0) as reserved_quantity,
  coalesce(m.quantity_on_hand, 0) - coalesce(r.reserved_quantity, 0)
    as available_quantity,
  greatest(
    coalesce(r.reserved_quantity, 0) - coalesce(m.quantity_on_hand, 0),
    0
  ) as shortage_quantity,
  greatest(
    coalesce(r.reserved_quantity, 0)
      + coalesce(bp.low_stock_threshold, 0)
      - coalesce(m.quantity_on_hand, 0),
    0
  ) as recommended_order_quantity
from public.blank_products bp
left join movement m
  on m.blank_product_id = bp.id
left join reservation r
  on r.blank_product_id = bp.id
where coalesce(bp.sc_is_archived, false) = false;

grant select on public.sc_purchasing_authoritative_inventory_v3
  to authenticated, service_role;

-- ============================================================
-- 3. Pull-sheet integrity audit
--    Same function as SQL 63, but reservation quantity is now
--    read through sc_effective_reservation_quantity_v1().
-- ============================================================

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
    public.sc_effective_reservation_quantity_v1(to_jsonb(r))::integer as quantity
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

-- ============================================================
-- 4. Repair function
--    Uses the same canonical reservation quantity.
-- ============================================================

create or replace function public.sc_repair_pullsheet_purchasing_integrity_v1(
  p_job_id bigint,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
  v_pending_bin_id bigint;
  v_available integer;
  v_correct_reserved integer;
  v_unreserved integer;
  v_cancelled integer := 0;
  v_reservations_ensured integer := 0;
  v_pending_assignments integer := 0;
  v_repaired integer := 0;
  v_changed integer;
begin
  if p_job_id is null then
    raise exception 'A pull sheet/job ID is required.';
  end if;

  perform 1
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Pull sheet/job % was not found.', p_job_id;
  end if;

  v_pending_bin_id := public.sc_ppi_pending_stock_bin_id_v1();
  if v_pending_bin_id is null then
    raise exception 'Pending Stock bin was not found.';
  end if;

  for v_line in
    select
      ji.id as job_item_id,
      ji.job_id,
      ji.blank_product_id,
      greatest(
        coalesce(
          public.sc_purchasing_json_numeric_v1(to_jsonb(ji), 'quantity', 'qty'),
          0
        ),
        0
      )::integer as quantity,
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(ji),
        'selected_bin_id'
      )::bigint as selected_bin_id
    from public.job_items ji
    join public.jobs j on j.id = ji.job_id
    where ji.job_id = p_job_id
      and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
      )
      and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
      )
      and coalesce(
        nullif(to_jsonb(ji)->>'inventory_required', '')::boolean,
        true
      )
      and coalesce(
        nullif(to_jsonb(ji)->>'include_on_purchasing_report', '')::boolean,
        true
      )
      and ji.blank_product_id is not null
    order by ji.id
    for update of ji
  loop
    update public.inventory_reservations r
    set status = 'cancelled'
    where public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'job_item_id'
          )::bigint = v_line.job_item_id
      and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
      )
      and r.blank_product_id is distinct from v_line.blank_product_id;

    get diagnostics v_changed = row_count;
    v_cancelled := v_cancelled + v_changed;

    select
      coalesce(sum(
        public.sc_effective_reservation_quantity_v1(to_jsonb(r))
      ), 0)::integer
    into v_correct_reserved
    from public.inventory_reservations r
    where public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'job_item_id'
          )::bigint = v_line.job_item_id
      and r.blank_product_id = v_line.blank_product_id
      and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
      );

    v_unreserved := greatest(v_line.quantity - coalesce(v_correct_reserved, 0), 0);

    select coalesce(
      public.sc_purchasing_json_numeric_v1(
        to_jsonb(ai),
        'available_quantity',
        'available_units',
        'available'
      ),
      0
    )::integer
    into v_available
    from public.sc_purchasing_authoritative_inventory_v3 ai
    where ai.blank_product_id = v_line.blank_product_id;

    v_available := coalesce(v_available, 0);

    if v_line.quantity > 0
       and v_unreserved > 0
       and v_available >= v_unreserved then
      perform public.sc_ensure_job_item_reservation_v1(
        v_line.job_id,
        v_line.job_item_id,
        v_line.blank_product_id,
        v_line.quantity
      );
      v_reservations_ensured := v_reservations_ensured + 1;

      if v_line.selected_bin_id = v_pending_bin_id then
        update public.job_items
        set selected_bin_id = null
        where id = v_line.job_item_id;
      end if;
    elsif v_unreserved > v_available then
      if v_line.selected_bin_id is null
         or v_line.selected_bin_id = v_pending_bin_id then
        update public.job_items
        set selected_bin_id = v_pending_bin_id
        where id = v_line.job_item_id
          and selected_bin_id is distinct from v_pending_bin_id;

        get diagnostics v_changed = row_count;
        v_pending_assignments := v_pending_assignments + v_changed;
      end if;
    end if;

    v_repaired := v_repaired + 1;
  end loop;

  insert into public.sc_pullsheet_purchasing_repair_log(
    job_id,
    actor_user_id,
    repaired_job_items,
    cancelled_mismatched_reservations,
    reservations_ensured,
    pending_stock_assignments,
    physical_inventory_changed,
    result
  ) values (
    p_job_id,
    p_actor,
    v_repaired,
    v_cancelled,
    v_reservations_ensured,
    v_pending_assignments,
    false,
    jsonb_build_object(
      'success', true,
      'job_id', p_job_id,
      'repaired_job_items', v_repaired,
      'cancelled_mismatched_reservations', v_cancelled,
      'reservations_ensured', v_reservations_ensured,
      'pending_stock_assignments', v_pending_assignments,
      'physical_inventory_changed', false
    )
  );

  return jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'repaired_job_items', v_repaired,
    'cancelled_mismatched_reservations', v_cancelled,
    'reservations_ensured', v_reservations_ensured,
    'pending_stock_assignments', v_pending_assignments,
    'physical_inventory_changed', false,
    'message', format(
      'Reconciled %s active pull-sheet line(s); %s reservation(s) ensured; %s line(s) assigned to Pending Stock.',
      v_repaired,
      v_reservations_ensured,
      v_pending_assignments
    )
  );
end;
$$;

revoke all on function public.sc_repair_pullsheet_purchasing_integrity_v1(bigint,uuid)
  from public, anon, authenticated;
grant execute on function public.sc_repair_pullsheet_purchasing_integrity_v1(bigint,uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- VERIFICATION - READ ONLY
-- ============================================================

-- A. The previously affected current-line reservations should no longer
--    read as zero when quantity_reserved carries the reservation.
select
  r.id as reservation_id,
  public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'job_id')::bigint as job_id,
  public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'job_item_id')::bigint as job_item_id,
  r.blank_product_id,
  public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'quantity_reserved') as quantity_reserved,
  public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'quantity') as quantity,
  public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'reserved_quantity') as reserved_quantity,
  public.sc_effective_reservation_quantity_v1(to_jsonb(r)) as effective_reservation_quantity,
  public.sc_purchasing_json_text_v1(to_jsonb(r), 'status') as reservation_status
from public.inventory_reservations r
where public.sc_purchasing_status_is_active_v1(
  public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
)
order by job_id desc nulls last, job_item_id desc nulls last
limit 100;

-- B. Current integrity issues after the hotfix.
select
  issue_code,
  count(*) as line_count,
  coalesce(sum(unreserved_line_quantity), 0) as unreserved_units,
  coalesce(sum(expected_missing_quantity), 0) as expected_missing_units
from public.sc_pullsheet_purchasing_integrity_v1(null)
where issue_code <> 'ok'
group by issue_code
order by line_count desc, issue_code;

-- C. Pull Sheets 223 and 271 were the clearest false-fallback examples.
select *
from public.sc_pullsheet_purchasing_integrity_v1(null)
where job_id in (223, 271)
order by job_id, job_item_id;

-- D. What Purchasing fallback would still add after correction.
select *
from public.sc_missing_pullsheet_purchasing_demand_v1()
order by recommended_order_quantity desc, sku_base
limit 100;
