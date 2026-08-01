-- Skilled Crafting Inventory App 0.6.25
-- Pull sheet 170 / manual order 14 safe duplicate repair
--
-- CONFIRMED DIAGNOSTIC:
--   Manual-order source lines: 53
--   Current mapped job-item IDs: 570 through 622
--   Saved rows on pull sheet 170: 265
--   Orphaned historical rows: 212
--   Pattern: five batches of 53 rows
--
-- This script does NOT delete job_items.
-- It:
--   1. Validates the exact confirmed counts.
--   2. Backs up all 212 orphaned rows.
--   3. Backs up and releases their active reservations.
--   4. Marks the orphaned rows cancelled.
--   5. Preserves the 53 current mapped lines.
--   6. Adds a partial unique index preventing two active pull-sheet rows
--      for the same manual-order source line.
--
-- Run only against the database represented by the supplied diagnostics.

begin;

lock table public.job_items in share row exclusive mode;
lock table public.sc_manual_invoice_order_items in share row exclusive mode;

do $guard$
declare
  v_manual_line_count integer;
  v_mapped_count integer;
  v_unique_mapped_count integer;
  v_job_item_count integer;
  v_orphan_count integer;
  v_missing_mapped_count integer;
  v_processed_orphan_count integer;
  v_generated_job_id bigint;
begin
  select generated_job_id
  into v_generated_job_id
  from public.sc_manual_invoice_orders
  where id = 14;

  if v_generated_job_id is distinct from 170 then
    raise exception
      'Safety stop: manual order 14 is linked to job %, not job 170.',
      v_generated_job_id;
  end if;

  select count(*)
  into v_manual_line_count
  from public.sc_manual_invoice_order_items
  where manual_order_id = 14
    and lower(coalesce(status, '')) not in
        ('cancelled', 'canceled', 'voided', 'deleted');

  select
    count(*) filter (where generated_job_item_id is not null),
    count(distinct generated_job_item_id)
  into
    v_mapped_count,
    v_unique_mapped_count
  from public.sc_manual_invoice_order_items
  where manual_order_id = 14
    and lower(coalesce(status, '')) not in
        ('cancelled', 'canceled', 'voided', 'deleted');

  select count(*)
  into v_job_item_count
  from public.job_items
  where job_id = 170;

  select count(*)
  into v_orphan_count
  from public.job_items ji
  where ji.job_id = 170
    and not exists (
      select 1
      from public.sc_manual_invoice_order_items mi
      where mi.manual_order_id = 14
        and mi.generated_job_item_id = ji.id
        and lower(coalesce(mi.status, '')) not in
            ('cancelled', 'canceled', 'voided', 'deleted')
    );

  select count(*)
  into v_missing_mapped_count
  from public.sc_manual_invoice_order_items mi
  where mi.manual_order_id = 14
    and lower(coalesce(mi.status, '')) not in
        ('cancelled', 'canceled', 'voided', 'deleted')
    and (
      mi.generated_job_item_id is null
      or not exists (
        select 1
        from public.job_items ji
        where ji.id = mi.generated_job_item_id
          and ji.job_id = 170
      )
    );

  select count(*)
  into v_processed_orphan_count
  from public.job_items ji
  where ji.job_id = 170
    and not exists (
      select 1
      from public.sc_manual_invoice_order_items mi
      where mi.manual_order_id = 14
        and mi.generated_job_item_id = ji.id
        and lower(coalesce(mi.status, '')) not in
            ('cancelled', 'canceled', 'voided', 'deleted')
    )
    and lower(coalesce(ji.status, '')) ~
        '(complete|deduct|fulfilled|produced|shipped)';

  if v_manual_line_count <> 53 then
    raise exception
      'Safety stop: expected 53 active manual lines; found %.',
      v_manual_line_count;
  end if;

  if v_mapped_count <> 53 or v_unique_mapped_count <> 53 then
    raise exception
      'Safety stop: expected 53 unique mapped job items; found % mapped and % unique.',
      v_mapped_count,
      v_unique_mapped_count;
  end if;

  if v_job_item_count <> 265 then
    raise exception
      'Safety stop: expected 265 saved job items on pull sheet 170; found %.',
      v_job_item_count;
  end if;

  if v_orphan_count <> 212 then
    raise exception
      'Safety stop: expected 212 orphaned copies; found %.',
      v_orphan_count;
  end if;

  if v_missing_mapped_count <> 0 then
    raise exception
      'Safety stop: % current manual lines are missing their mapped job item.',
      v_missing_mapped_count;
  end if;

  if v_processed_orphan_count <> 0 then
    raise exception
      'Safety stop: % orphaned rows appear completed/deducted/fulfilled. They require individual review.',
      v_processed_orphan_count;
  end if;
end
$guard$;


-- Permanent audit backup of the 212 orphaned job-item rows.
create table if not exists
  public.sc_backup_job170_orphan_job_items_20260729
as
select
  ji.*,
  now() as backup_created_at
from public.job_items ji
where false;

insert into public.sc_backup_job170_orphan_job_items_20260729
select
  ji.*,
  now()
from public.job_items ji
where ji.job_id = 170
  and not exists (
    select 1
    from public.sc_manual_invoice_order_items mi
    where mi.manual_order_id = 14
      and mi.generated_job_item_id = ji.id
      and lower(coalesce(mi.status, '')) not in
          ('cancelled', 'canceled', 'voided', 'deleted')
  )
  and not exists (
    select 1
    from public.sc_backup_job170_orphan_job_items_20260729 b
    where b.id = ji.id
  );


-- Back up reservations when the standard table is present.
do $reservations_backup$
begin
  if to_regclass('public.inventory_reservations') is not null then
    execute '
      create table if not exists
        public.sc_backup_job170_orphan_reservations_20260729
      as
      select
        r.*,
        now() as backup_created_at
      from public.inventory_reservations r
      where false
    ';

    execute '
      insert into public.sc_backup_job170_orphan_reservations_20260729
      select
        r.*,
        now()
      from public.inventory_reservations r
      join public.job_items ji
        on ji.id::text = r.job_item_id::text
      where ji.job_id = 170
        and not exists (
          select 1
          from public.sc_manual_invoice_order_items mi
          where mi.manual_order_id = 14
            and mi.generated_job_item_id = ji.id
            and lower(coalesce(mi.status, '''')) not in
                (''cancelled'', ''canceled'', ''voided'', ''deleted'')
        )
        and not exists (
          select 1
          from public.sc_backup_job170_orphan_reservations_20260729 b
          where b.id = r.id
        )
    ';
  end if;
end
$reservations_backup$;


-- Release active reservations belonging to orphaned rows.
do $release_reservations$
begin
  if to_regclass('public.inventory_reservations') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'inventory_reservations'
         and column_name = 'job_item_id'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'inventory_reservations'
         and column_name = 'status'
     ) then
    execute '
      update public.inventory_reservations r
      set status = ''released''
      from public.job_items ji
      where ji.id::text = r.job_item_id::text
        and ji.job_id = 170
        and not exists (
          select 1
          from public.sc_manual_invoice_order_items mi
          where mi.manual_order_id = 14
            and mi.generated_job_item_id = ji.id
            and lower(coalesce(mi.status, '''')) not in
                (''cancelled'', ''canceled'', ''voided'', ''deleted'')
        )
        and lower(coalesce(r.status, '''')) not in
            (''released'', ''completed'', ''cancelled'', ''canceled'', ''voided'')
    ';
  end if;
end
$release_reservations$;


-- Preserve the rows for audit, but remove them from active pull-sheet,
-- purchasing, reservation, and production workflows.
update public.job_items ji
set
  status = 'cancelled',
  pairing_warning = 'duplicate_manual_order_sync_orphan',
  notes = concat_ws(
    E'\n',
    nullif(ji.notes, ''),
    'Cancelled 2026-07-29: orphaned duplicate from repeated manual-order synchronization. Current source line is mapped to another job_item.'
  ),
  updated_at = now()
where ji.job_id = 170
  and not exists (
    select 1
    from public.sc_manual_invoice_order_items mi
    where mi.manual_order_id = 14
      and mi.generated_job_item_id = ji.id
      and lower(coalesce(mi.status, '')) not in
          ('cancelled', 'canceled', 'voided', 'deleted')
  );


-- Prevent more than one ACTIVE pull-sheet row for a manual source line.
create unique index if not exists
  ux_job_items_active_manual_order_line
on public.job_items (
  job_id,
  manual_order_item_id
)
where manual_order_item_id is not null
  and lower(coalesce(status, '')) not in
      ('cancelled', 'canceled', 'voided', 'deleted');


commit;


-- =========================================================
-- Verification
-- Expected:
--   active_job_items = 53
--   cancelled_duplicate_rows = 212
--   current_manual_mappings = 53
--   duplicate_active_manual_mappings = 0
-- =========================================================

select
  count(*) filter (
    where lower(coalesce(status, '')) not in
      ('cancelled', 'canceled', 'voided', 'deleted')
  ) as active_job_items,
  count(*) filter (
    where pairing_warning = 'duplicate_manual_order_sync_orphan'
  ) as cancelled_duplicate_rows,
  count(*) as all_preserved_job_item_rows
from public.job_items
where job_id = 170;

select
  count(*) as current_manual_mappings,
  count(distinct generated_job_item_id) as unique_current_mappings
from public.sc_manual_invoice_order_items
where manual_order_id = 14
  and lower(coalesce(status, '')) not in
      ('cancelled', 'canceled', 'voided', 'deleted');

select
  job_id,
  manual_order_item_id,
  count(*) as active_row_count,
  array_agg(id order by id) as active_job_item_ids
from public.job_items
where job_id = 170
  and manual_order_item_id is not null
  and lower(coalesce(status, '')) not in
      ('cancelled', 'canceled', 'voided', 'deleted')
group by job_id, manual_order_item_id
having count(*) > 1;
