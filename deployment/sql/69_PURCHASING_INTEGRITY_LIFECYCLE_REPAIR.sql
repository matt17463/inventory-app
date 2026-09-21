-- Skilled Crafting Inventory App v1.4.17
-- SQL 69 - Purchasing integrity and reservation lifecycle hardening
--
-- PURPOSE
--   * Preserve the canonical reservation quantity logic introduced in SQL 65.
--   * Restore the real-row COUNT fix so a LEFT JOIN NULL does not look like a
--     mismatched reservation.
--   * Clear stale Pending Stock assignments when a line is already fully reserved.
--   * Release active reservations whose parent job or line is terminal.
--   * Make guarded terminal job/line status changes release reservations.
--   * Make sc_ensure_job_item_reservation_v1 compare reservation quantities through
--     sc_effective_reservation_quantity_v1().
--
-- SAFETY
--   * No blank inventory movement is inserted, deleted, or rewritten.
--   * Physical on-hand inventory is not changed.
--   * Stale reservation/status rows are backed up before cleanup.
--   * Safe to rerun.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $guard$
begin
  if to_regclass('public.jobs') is null then
    raise exception 'Required table public.jobs is missing.';
  end if;
  if to_regclass('public.job_items') is null then
    raise exception 'Required table public.job_items is missing.';
  end if;
  if to_regclass('public.inventory_reservations') is null then
    raise exception 'Required table public.inventory_reservations is missing.';
  end if;
  if to_regclass('public.blank_products') is null then
    raise exception 'Required table public.blank_products is missing.';
  end if;
  if to_regclass('public.blank_inventory_movements') is null then
    raise exception 'Required table public.blank_inventory_movements is missing.';
  end if;
  if to_regclass('public.sc_core_mutation_audit') is null then
    raise exception 'Required table public.sc_core_mutation_audit is missing.';
  end if;
  if to_regprocedure('public.sc_purchasing_status_is_active_v1(text)') is null then
    raise exception 'Required helper sc_purchasing_status_is_active_v1(text) is missing.';
  end if;
  if to_regprocedure('public.sc_purchasing_json_numeric_v1(jsonb,text[])') is null then
    raise exception 'Required helper sc_purchasing_json_numeric_v1(jsonb,text[]) is missing.';
  end if;
  if to_regprocedure('public.sc_purchasing_json_text_v1(jsonb,text[])') is null then
    raise exception 'Required helper sc_purchasing_json_text_v1(jsonb,text[]) is missing.';
  end if;
  if to_regprocedure('public.sc_ppi_pending_stock_bin_id_v1()') is null then
    raise exception 'Required helper sc_ppi_pending_stock_bin_id_v1() is missing.';
  end if;
end
$guard$;

-- ============================================================
-- 1. Canonical reservation quantity
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
--    Closed/voided/completed parent work cannot remain reserved.
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
      public.sc_purchasing_json_numeric_v1(to_jsonb(r), 'job_id')::bigint,
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
left join movement m on m.blank_product_id = bp.id
left join reservation r on r.blank_product_id = bp.id
where coalesce(bp.sc_is_archived, false) = false;

grant select on public.sc_purchasing_authoritative_inventory_v3
  to authenticated, service_role;

-- ============================================================
-- 3. Pull-sheet integrity audit
--    IMPORTANT: count(r.job_item_id), not count(*), so the synthetic NULL row
--    from the LEFT JOIN cannot become a false mismatch.
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
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(ji),
      'selected_bin_id'
    )::bigint as selected_bin_id
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
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint as job_item_id,
    r.blank_product_id,
    public.sc_effective_reservation_quantity_v1(to_jsonb(r))::integer
      as quantity
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
    (
      l.selected_bin_id is not null
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
-- 4. Ensure-reservation wrapper uses the same canonical quantity.
-- ============================================================

create or replace function public.sc_ensure_job_item_reservation_v1(
  p_job_id bigint,
  p_job_item_id bigint,
  p_blank_product_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_existing jsonb;
  v_existing_blank text;
  v_existing_quantity integer;
  v_has_status boolean;
  v_has_job_item boolean;
begin
  if p_job_id is null or p_job_item_id is null or p_blank_product_id is null then
    raise exception 'job_id, job_item_id, and blank_product_id are required';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'quantity must be greater than zero';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_reservations'
      and column_name = 'job_item_id'
  ) into v_has_job_item;

  if not v_has_job_item then
    raise exception 'inventory_reservations.job_item_id is missing';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inventory_reservations'
      and column_name = 'status'
  ) into v_has_status;

  if v_has_status then
    execute $sql$
      select to_jsonb(r)
      from public.inventory_reservations r
      where r.job_item_id = $1
        and coalesce(lower(r.status::text), 'active') not in (
          'released',
          'cancelled',
          'canceled',
          'void',
          'voided',
          'completed',
          'fulfilled'
        )
      order by r.id desc
      limit 1
    $sql$ into v_existing using p_job_item_id;
  else
    execute $sql$
      select to_jsonb(r)
      from public.inventory_reservations r
      where r.job_item_id = $1
      order by r.id desc
      limit 1
    $sql$ into v_existing using p_job_item_id;
  end if;

  if v_existing is not null then
    v_existing_blank := coalesce(v_existing ->> 'blank_product_id', '');
    v_existing_quantity :=
      public.sc_effective_reservation_quantity_v1(v_existing);

    if v_existing_blank <> p_blank_product_id::text
       or v_existing_quantity <> p_quantity then
      return jsonb_build_object(
        'success', false,
        'action', 'mismatch',
        'needs_review', true,
        'reservation', v_existing,
        'requested_blank_product_id', p_blank_product_id,
        'requested_quantity', p_quantity
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'action', 'existing',
      'needs_review', false,
      'reservation', v_existing
    );
  end if;

  if to_regprocedure('public.reserve_inventory(bigint,bigint,uuid,integer)') is not null then
    perform public.reserve_inventory(
      p_job_id := p_job_id,
      p_job_item_id := p_job_item_id,
      p_blank_product_id := p_blank_product_id,
      p_quantity := p_quantity
    );
  elsif exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'reserve_inventory'
  ) then
    execute $sql$
      select public.reserve_inventory(
        p_job_id := $1,
        p_job_item_id := $2,
        p_blank_product_id := $3,
        p_quantity := $4
      )
    $sql$ using p_job_id, p_job_item_id, p_blank_product_id, p_quantity;
  else
    raise exception 'public.reserve_inventory is missing';
  end if;

  return jsonb_build_object(
    'success', true,
    'action', 'created',
    'needs_review', false
  );
end
$function$;

revoke all on function public.sc_ensure_job_item_reservation_v1(
  bigint,
  bigint,
  uuid,
  integer
) from public, anon, authenticated;

grant execute on function public.sc_ensure_job_item_reservation_v1(
  bigint,
  bigint,
  uuid,
  integer
) to service_role;

-- ============================================================
-- 5. Reconcile function:
--    * cancels real mismatched reservations
--    * ensures a full reservation only when enough stock exists
--    * clears Pending Stock whenever the line is already fully reserved
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
  v_reserved_bin_id bigint;
  v_cancelled integer := 0;
  v_reservations_ensured integer := 0;
  v_pending_assignments integer := 0;
  v_pending_cleared integer := 0;
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
    set
      status = 'cancelled',
      updated_at = now(),
      notes = concat_ws(
        E'\n',
        nullif(r.notes, ''),
        'Cancelled by v1.4.17 Purchasing reconciliation because the reservation blank did not match the pull-sheet line.'
      )
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
      ), 0)::integer,
      case
        when count(distinct public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'bin_id',
          'selected_bin_id',
          'source_bin_id'
        )::bigint) filter (
          where public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'bin_id',
            'selected_bin_id',
            'source_bin_id'
          )::bigint is not null
            and public.sc_purchasing_json_numeric_v1(
              to_jsonb(r),
              'bin_id',
              'selected_bin_id',
              'source_bin_id'
            )::bigint <> v_pending_bin_id
        ) = 1
        then min(public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'bin_id',
          'selected_bin_id',
          'source_bin_id'
        )::bigint) filter (
          where public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'bin_id',
            'selected_bin_id',
            'source_bin_id'
          )::bigint is not null
            and public.sc_purchasing_json_numeric_v1(
              to_jsonb(r),
              'bin_id',
              'selected_bin_id',
              'source_bin_id'
            )::bigint <> v_pending_bin_id
        )
        else null
      end
    into v_correct_reserved, v_reserved_bin_id
    from public.inventory_reservations r
    where public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'job_item_id'
          )::bigint = v_line.job_item_id
      and r.blank_product_id = v_line.blank_product_id
      and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
      );

    v_unreserved := greatest(
      v_line.quantity - coalesce(v_correct_reserved, 0),
      0
    );

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

    if v_unreserved <= 0 then
      if v_line.selected_bin_id = v_pending_bin_id then
        update public.job_items
        set selected_bin_id = v_reserved_bin_id
        where id = v_line.job_item_id
          and selected_bin_id = v_pending_bin_id;

        get diagnostics v_changed = row_count;
        v_pending_cleared := v_pending_cleared + v_changed;
      end if;

    elsif v_line.quantity > 0
       and v_available >= v_unreserved then

      perform public.sc_ensure_job_item_reservation_v1(
        v_line.job_id,
        v_line.job_item_id,
        v_line.blank_product_id,
        v_line.quantity
      );
      v_reservations_ensured := v_reservations_ensured + 1;

      select
        case
          when count(distinct public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'bin_id',
            'selected_bin_id',
            'source_bin_id'
          )::bigint) filter (
            where public.sc_purchasing_json_numeric_v1(
              to_jsonb(r),
              'bin_id',
              'selected_bin_id',
              'source_bin_id'
            )::bigint is not null
              and public.sc_purchasing_json_numeric_v1(
                to_jsonb(r),
                'bin_id',
                'selected_bin_id',
                'source_bin_id'
              )::bigint <> v_pending_bin_id
          ) = 1
          then min(public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'bin_id',
            'selected_bin_id',
            'source_bin_id'
          )::bigint) filter (
            where public.sc_purchasing_json_numeric_v1(
              to_jsonb(r),
              'bin_id',
              'selected_bin_id',
              'source_bin_id'
            )::bigint is not null
              and public.sc_purchasing_json_numeric_v1(
                to_jsonb(r),
                'bin_id',
                'selected_bin_id',
                'source_bin_id'
              )::bigint <> v_pending_bin_id
          )
          else null
        end
      into v_reserved_bin_id
      from public.inventory_reservations r
      where public.sc_purchasing_json_numeric_v1(
              to_jsonb(r),
              'job_item_id'
            )::bigint = v_line.job_item_id
        and r.blank_product_id = v_line.blank_product_id
        and public.sc_purchasing_status_is_active_v1(
          public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
        );

      if v_line.selected_bin_id = v_pending_bin_id then
        update public.job_items
        set selected_bin_id = v_reserved_bin_id
        where id = v_line.job_item_id
          and selected_bin_id = v_pending_bin_id;

        get diagnostics v_changed = row_count;
        v_pending_cleared := v_pending_cleared + v_changed;
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
      'pending_stock_cleared', v_pending_cleared,
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
    'pending_stock_cleared', v_pending_cleared,
    'physical_inventory_changed', false,
    'message', format(
      'Reconciled %s active pull-sheet line(s); %s reservation(s) ensured; %s line(s) assigned to Pending Stock; %s stale Pending Stock assignment(s) cleared.',
      v_repaired,
      v_reservations_ensured,
      v_pending_assignments,
      v_pending_cleared
    )
  );
end;
$$;

revoke all on function public.sc_repair_pullsheet_purchasing_integrity_v1(
  bigint,
  uuid
) from public, anon, authenticated;

grant execute on function public.sc_repair_pullsheet_purchasing_integrity_v1(
  bigint,
  uuid
) to service_role;

-- ============================================================
-- 6. Back up and release stale active reservations.
-- ============================================================

create table if not exists
  public.sc_backup_stale_reservations_v1417_20260921 (
    reservation_id text primary key,
    snapshot jsonb not null,
    backup_created_at timestamptz not null default now()
  );

insert into public.sc_backup_stale_reservations_v1417_20260921(
  reservation_id,
  snapshot
)
select
  r.id::text,
  to_jsonb(r)
from public.inventory_reservations r
join public.job_items ji
  on ji.id = public.sc_purchasing_json_numeric_v1(
    to_jsonb(r),
    'job_item_id'
  )::bigint
join public.jobs j
  on j.id = ji.job_id
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
on conflict (reservation_id) do nothing;

update public.inventory_reservations r
set
  status = 'released',
  released_at = coalesce(r.released_at, now()),
  updated_at = now(),
  notes = concat_ws(
    E'\n',
    nullif(r.notes, ''),
    'Released by v1.4.17 lifecycle repair because the parent job or pull-sheet line was inactive.'
  )
from public.job_items ji
join public.jobs j on j.id = ji.job_id
where ji.id = public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'job_item_id'
      )::bigint
  and public.sc_purchasing_status_is_active_v1(
        public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
      )
  and (
    not public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
    )
    or not public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
    )
  );

revoke all on public.sc_backup_stale_reservations_v1417_20260921
  from public, anon, authenticated;
grant select on public.sc_backup_stale_reservations_v1417_20260921
  to service_role;

-- ============================================================
-- 7. Back up and clear fully-reserved lines still marked Pending Stock.
-- ============================================================

create table if not exists
  public.sc_backup_pending_stock_lines_v1417_20260921 (
    job_item_id bigint primary key,
    snapshot jsonb not null,
    backup_created_at timestamptz not null default now()
  );

with pending as (
  select public.sc_ppi_pending_stock_bin_id_v1()::bigint as bin_id
),
reservation_by_line as (
  select
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint as job_item_id,
    r.blank_product_id,
    sum(
      public.sc_effective_reservation_quantity_v1(to_jsonb(r))
    )::integer as reserved_quantity,
    array_agg(
      distinct public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'bin_id',
        'selected_bin_id',
        'source_bin_id'
      )::bigint
    ) filter (
      where public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'bin_id',
        'selected_bin_id',
        'source_bin_id'
      )::bigint is not null
        and public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'bin_id',
          'selected_bin_id',
          'source_bin_id'
        )::bigint <> (select bin_id from pending)
    ) as physical_bins
  from public.inventory_reservations r
  where public.sc_purchasing_status_is_active_v1(
    public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
  )
  group by
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint,
    r.blank_product_id
),
targets as (
  select
    ji.id as job_item_id
  from public.job_items ji
  join public.jobs j on j.id = ji.job_id
  join reservation_by_line rbl
    on rbl.job_item_id = ji.id
   and rbl.blank_product_id = ji.blank_product_id
  where ji.selected_bin_id = (select bin_id from pending)
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
    )
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
    )
    and rbl.reserved_quantity >= greatest(
      coalesce(
        public.sc_purchasing_json_numeric_v1(to_jsonb(ji), 'quantity', 'qty'),
        0
      ),
      0
    )
)
insert into public.sc_backup_pending_stock_lines_v1417_20260921(
  job_item_id,
  snapshot
)
select
  ji.id,
  to_jsonb(ji)
from public.job_items ji
join targets t on t.job_item_id = ji.id
on conflict (job_item_id) do nothing;

with pending as (
  select public.sc_ppi_pending_stock_bin_id_v1()::bigint as bin_id
),
reservation_by_line as (
  select
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint as job_item_id,
    r.blank_product_id,
    sum(
      public.sc_effective_reservation_quantity_v1(to_jsonb(r))
    )::integer as reserved_quantity,
    array_agg(
      distinct public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'bin_id',
        'selected_bin_id',
        'source_bin_id'
      )::bigint
    ) filter (
      where public.sc_purchasing_json_numeric_v1(
        to_jsonb(r),
        'bin_id',
        'selected_bin_id',
        'source_bin_id'
      )::bigint is not null
        and public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'bin_id',
          'selected_bin_id',
          'source_bin_id'
        )::bigint <> (select bin_id from pending)
    ) as physical_bins
  from public.inventory_reservations r
  where public.sc_purchasing_status_is_active_v1(
    public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
  )
  group by
    public.sc_purchasing_json_numeric_v1(
      to_jsonb(r),
      'job_item_id'
    )::bigint,
    r.blank_product_id
),
targets as (
  select
    ji.id as job_item_id,
    case
      when cardinality(coalesce(rbl.physical_bins, array[]::bigint[])) = 1
        then rbl.physical_bins[1]
      else null
    end as replacement_bin_id
  from public.job_items ji
  join public.jobs j on j.id = ji.job_id
  join reservation_by_line rbl
    on rbl.job_item_id = ji.id
   and rbl.blank_product_id = ji.blank_product_id
  where ji.selected_bin_id = (select bin_id from pending)
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(j), 'status')
    )
    and public.sc_purchasing_status_is_active_v1(
      public.sc_purchasing_json_text_v1(to_jsonb(ji), 'status')
    )
    and rbl.reserved_quantity >= greatest(
      coalesce(
        public.sc_purchasing_json_numeric_v1(to_jsonb(ji), 'quantity', 'qty'),
        0
      ),
      0
    )
)
update public.job_items ji
set
  selected_bin_id = t.replacement_bin_id,
  updated_at = now()
from targets t
where ji.id = t.job_item_id;

revoke all on public.sc_backup_pending_stock_lines_v1417_20260921
  from public, anon, authenticated;
grant select on public.sc_backup_pending_stock_lines_v1417_20260921
  to service_role;

-- ============================================================
-- 8. Guarded status changes now release reservations on terminal state.
-- ============================================================

create or replace function public.sc_set_job_status_safe_v1(
  p_job_id bigint,
  p_status text,
  p_actor uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.jobs%rowtype;
  v_after public.jobs%rowtype;
  v_next_status text;
begin
  v_next_status := trim(coalesce(p_status, ''));

  if v_next_status not in (
    'draft',
    'queued',
    'ready_to_pull',
    'reserved',
    'waiting_on_blanks',
    'ready_to_produce',
    'pulled',
    'in_production',
    'qc',
    'ready_to_ship',
    'production_complete',
    'completed',
    'on_hold',
    'needs_attention',
    'cancelled',
    'voided'
  ) then
    raise exception 'Unsupported job status: %', p_status;
  end if;

  select *
  into v_before
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Job % was not found.', p_job_id;
  end if;

  update public.jobs
  set status = v_next_status
  where id = p_job_id
  returning * into v_after;

  if v_next_status in ('completed', 'cancelled', 'voided') then
    update public.inventory_reservations r
    set
      status = 'released',
      released_at = coalesce(r.released_at, now()),
      updated_at = now(),
      notes = concat_ws(
        E'\n',
        nullif(r.notes, ''),
        format(
          'Released automatically because Pull Sheet %s changed to terminal status %s.',
          p_job_id,
          v_next_status
        )
      )
    where public.sc_purchasing_status_is_active_v1(
            public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
          )
      and (
        public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'job_id'
        )::bigint = p_job_id
        or public.sc_purchasing_json_numeric_v1(
          to_jsonb(r),
          'job_item_id'
        )::bigint in (
          select ji.id
          from public.job_items ji
          where ji.job_id = p_job_id
        )
      );
  end if;

  insert into public.sc_core_mutation_audit(
    action,
    entity_type,
    entity_id_text,
    actor_user_id,
    before_snapshot,
    after_snapshot,
    reason
  ) values (
    'status_change',
    'job',
    p_job_id::text,
    p_actor,
    to_jsonb(v_before),
    to_jsonb(v_after),
    coalesce(p_reason, 'Guarded job status update')
  );

  return to_jsonb(v_after);
end;
$$;

create or replace function public.sc_set_job_item_status_safe_v1(
  p_job_item_id bigint,
  p_status text,
  p_actor uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.job_items%rowtype;
  v_after public.job_items%rowtype;
  v_next_status text;
begin
  v_next_status := trim(coalesce(p_status, ''));

  if v_next_status not in (
    'draft',
    'queued',
    'ready_to_pull',
    'reserved',
    'waiting_on_blanks',
    'ready_to_produce',
    'pulled',
    'in_production',
    'qc',
    'ready_to_ship',
    'production_complete',
    'completed',
    'on_hold',
    'needs_attention',
    'cancelled',
    'voided'
  ) then
    raise exception 'Unsupported line status: %', p_status;
  end if;

  select *
  into v_before
  from public.job_items
  where id = p_job_item_id
  for update;

  if not found then
    raise exception 'Job item % was not found.', p_job_item_id;
  end if;

  update public.job_items
  set status = v_next_status
  where id = p_job_item_id
  returning * into v_after;

  if v_next_status in ('completed', 'cancelled', 'voided') then
    update public.inventory_reservations r
    set
      status = 'released',
      released_at = coalesce(r.released_at, now()),
      updated_at = now(),
      notes = concat_ws(
        E'\n',
        nullif(r.notes, ''),
        format(
          'Released automatically because pull-sheet line %s changed to terminal status %s.',
          p_job_item_id,
          v_next_status
        )
      )
    where public.sc_purchasing_status_is_active_v1(
            public.sc_purchasing_json_text_v1(to_jsonb(r), 'status')
          )
      and public.sc_purchasing_json_numeric_v1(
            to_jsonb(r),
            'job_item_id'
          )::bigint = p_job_item_id;
  end if;

  insert into public.sc_core_mutation_audit(
    action,
    entity_type,
    entity_id_text,
    actor_user_id,
    before_snapshot,
    after_snapshot,
    reason
  ) values (
    'status_change',
    'job_item',
    p_job_item_id::text,
    p_actor,
    to_jsonb(v_before),
    to_jsonb(v_after),
    coalesce(p_reason, 'Guarded job item status update')
  );

  return to_jsonb(v_after);
end;
$$;

revoke all on function public.sc_set_job_status_safe_v1(
  bigint,
  text,
  uuid,
  text
) from public, anon, authenticated;

revoke all on function public.sc_set_job_item_status_safe_v1(
  bigint,
  text,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.sc_set_job_status_safe_v1(
  bigint,
  text,
  uuid,
  text
) to service_role;

grant execute on function public.sc_set_job_item_status_safe_v1(
  bigint,
  text,
  uuid,
  text
) to service_role;

notify pgrst, 'reload schema';

commit;
