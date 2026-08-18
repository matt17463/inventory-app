-- Skilled Crafting Inventory App 0.6.26
-- Idempotent pull-sheet completion and pull sheet 165 reconciliation
--
-- Confirmed attribution:
--   movement 960 -> job item 215 -> job 165
--   movement 962 -> job item 213 -> job 163
--   movement 963 -> job item 214 -> job 164
--
-- This migration DOES NOT deduct another backpack for job 165.
-- It links the three proven legacy movements to their job items, marks job
-- item 215 completed, and replaces the completion path with an atomic,
-- idempotent function.

begin;

lock table public.job_items in share row exclusive mode;
lock table public.blank_inventory_movements in share row exclusive mode;

-- Add durable attribution fields for future pull-sheet deductions.
alter table public.blank_inventory_movements
  add column if not exists job_item_id bigint,
  add column if not exists job_id bigint,
  add column if not exists source_type text;

create index if not exists
  ix_blank_inventory_movements_job_item_id
on public.blank_inventory_movements(job_item_id)
where job_item_id is not null;

create unique index if not exists
  ux_blank_inventory_movements_pullsheet_completion_job_item
on public.blank_inventory_movements(job_item_id)
where job_item_id is not null
  and source_type = 'pullsheet_completion';


-- Safety checks for the exact production records supplied in the diagnostics.
do $guard$
declare
  v_backpack_on_hand numeric;
  v_movement_960 record;
  v_item_215 record;
  v_reservation_status text;
begin
  select
    m.id,
    m.blank_product_id,
    m.bin_id,
    m.quantity_change,
    m.created_at,
    m.notes
  into v_movement_960
  from public.blank_inventory_movements m
  where m.id = 960;

  if not found then
    raise exception 'Safety stop: movement 960 was not found.';
  end if;

  if v_movement_960.blank_product_id::text <>
       '67710660-0de2-4b39-b159-048eb26e3ed2'
     or v_movement_960.bin_id <> 1
     or v_movement_960.quantity_change <> -1
     or v_movement_960.created_at <>
        '2026-07-24T02:19:32.331051+00:00'::timestamptz then
    raise exception
      'Safety stop: movement 960 no longer matches the confirmed backpack deduction.';
  end if;

  select
    ji.id,
    ji.job_id,
    ji.blank_product_id,
    ji.selected_bin_id,
    ji.quantity,
    ji.status,
    ji.updated_at
  into v_item_215
  from public.job_items ji
  where ji.id = 215;

  if not found then
    raise exception 'Safety stop: job item 215 was not found.';
  end if;

  if v_item_215.job_id <> 165
     or v_item_215.blank_product_id::text <>
        '67710660-0de2-4b39-b159-048eb26e3ed2'
     or v_item_215.selected_bin_id <> 1
     or v_item_215.quantity <> 1
     or lower(coalesce(v_item_215.status, '')) <> 'pulled'
     or v_item_215.updated_at <>
        '2026-07-24T02:19:32.331051+00:00'::timestamptz then
    raise exception
      'Safety stop: job item 215 no longer matches the confirmed partial-completion state.';
  end if;

  select lower(coalesce(status, ''))
  into v_reservation_status
  from public.inventory_reservations
  where job_item_id::text = '215'
  order by created_at desc
  limit 1;

  if coalesce(v_reservation_status, '') <> 'released' then
    raise exception
      'Safety stop: job item 215 reservation is %, not released.',
      coalesce(v_reservation_status, '(missing)');
  end if;

  select coalesce(sum(quantity_change), 0)
  into v_backpack_on_hand
  from public.blank_inventory_movements
  where blank_product_id::text =
        '67710660-0de2-4b39-b159-048eb26e3ed2'
    and bin_id = 1;

  if v_backpack_on_hand <> 1 then
    raise exception
      'Safety stop: expected backpack on-hand quantity 1 before repair; found %.',
      v_backpack_on_hand;
  end if;
end
$guard$;


-- Back up the exact rows before reconciliation.
create table if not exists
  public.sc_backup_pull_sheet_165_job_item_215_20260731
as
select
  ji.*,
  now() as backup_created_at
from public.job_items ji
where false;

insert into public.sc_backup_pull_sheet_165_job_item_215_20260731
select
  ji.*,
  now()
from public.job_items ji
where ji.id = 215
  and not exists (
    select 1
    from public.sc_backup_pull_sheet_165_job_item_215_20260731 b
    where b.id = ji.id
  );

create table if not exists
  public.sc_backup_pull_sheet_backpack_movements_20260731
as
select
  m.*,
  now() as backup_created_at
from public.blank_inventory_movements m
where false;

insert into public.sc_backup_pull_sheet_backpack_movements_20260731
select
  m.*,
  now()
from public.blank_inventory_movements m
where m.id in (960, 962, 963)
  and not exists (
    select 1
    from public.sc_backup_pull_sheet_backpack_movements_20260731 b
    where b.id = m.id
  );


-- Link the three deductions to the exact matching job items.
update public.blank_inventory_movements
set
  job_item_id = case id
    when 960 then 215
    when 962 then 213
    when 963 then 214
  end,
  job_id = case id
    when 960 then 165
    when 962 then 163
    when 963 then 164
  end,
  source_type = 'pullsheet_completion'
where id in (960, 962, 963);


-- Repair line 215 WITHOUT creating another inventory movement.
update public.job_items
set
  status = 'completed',
  notes = concat_ws(
    E'\n',
    nullif(notes, ''),
    'Reconciled 2026-07-31: movement 960 already deducted this blank; line status repaired without another deduction.'
  ),
  updated_at = now()
where id = 215;


-- Install the durable idempotent completion function.
drop function if exists
  public.sc_complete_pull_sheet_item_deduct_blank_safe(
    text,
    text,
    text,
    numeric,
    text
  );

create function
  public.sc_complete_pull_sheet_item_deduct_blank_safe(
    p_job_item_id_text text,
    p_blank_product_id_text text default null,
    p_bin_id_text text default null,
    p_quantity numeric default null,
    p_notes text default null
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_item public.job_items%rowtype;
  v_job_item_id bigint;
  v_bin_id bigint;
  v_expected_quantity numeric;
  v_on_hand numeric;
  v_existing_movement_id bigint;
  v_released integer := 0;
begin
  begin
    v_job_item_id := nullif(btrim(p_job_item_id_text), '')::bigint;
  exception when others then
    return jsonb_build_object(
      'success', false,
      'message', 'Invalid pull-sheet line ID.'
    );
  end;

  begin
    v_bin_id := nullif(btrim(p_bin_id_text), '')::bigint;
  exception when others then
    return jsonb_build_object(
      'success', false,
      'message', 'Invalid source-bin ID.'
    );
  end;

  if v_job_item_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Missing pull-sheet line ID.'
    );
  end if;

  select *
  into v_item
  from public.job_items
  where id = v_job_item_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Pull-sheet line was not found.'
    );
  end if;

  if coalesce(v_item.inventory_required, true) = false then
    return jsonb_build_object(
      'success', false,
      'message', 'This is a non-inventory line and must not deduct a blank.'
    );
  end if;

  if v_item.blank_product_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Pair a blank product before completing this line.'
    );
  end if;

  if nullif(btrim(coalesce(p_blank_product_id_text, '')), '') is not null
     and v_item.blank_product_id::text <>
         btrim(p_blank_product_id_text) then
    return jsonb_build_object(
      'success', false,
      'message', 'The selected blank no longer matches the saved pull-sheet pairing.'
    );
  end if;

  v_bin_id := coalesce(v_bin_id, v_item.selected_bin_id);

  if v_bin_id is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Choose the blank source bin before completing this line.'
    );
  end if;

  v_expected_quantity := abs(coalesce(v_item.quantity, 0));

  if v_expected_quantity <= 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'The pull-sheet line quantity must be greater than zero.'
    );
  end if;

  if p_quantity is not null
     and abs(abs(p_quantity) - v_expected_quantity) > 0.000001 then
    return jsonb_build_object(
      'success', false,
      'message', 'The displayed quantity no longer matches the saved pull-sheet quantity. Refresh the pull sheet.'
    );
  end if;

  select id
  into v_existing_movement_id
  from public.blank_inventory_movements
  where job_item_id = v_job_item_id
    and source_type = 'pullsheet_completion'
  order by id
  limit 1;

  if v_existing_movement_id is not null then
    if lower(coalesce(v_item.status, '')) not in (
      'complete',
      'completed',
      'closed',
      'deducted',
      'ready_to_ship',
      'ready to ship',
      'shipped',
      'done',
      'fulfilled'
    ) then
      update public.job_items
      set
        status = 'completed',
        selected_bin_id = v_bin_id,
        updated_at = now()
      where id = v_job_item_id;
    end if;

    update public.inventory_reservations
    set
      status = 'released',
      released_at = coalesce(released_at, now()),
      updated_at = now(),
      notes = concat_ws(
        E'\n',
        nullif(notes, ''),
        'Released after idempotent Complete + Deduct Blank reconciliation.'
      )
    where job_item_id::text = v_job_item_id::text
      and lower(coalesce(status, '')) not in (
        'released',
        'completed',
        'fulfilled',
        'cancelled',
        'canceled',
        'voided'
      );

    get diagnostics v_released = row_count;

    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'inventory_deducted', false,
      'movement_id', v_existing_movement_id,
      'job_item_id', v_job_item_id,
      'released_reservations', v_released,
      'message', 'Completion was already recorded; no additional inventory was deducted.'
    );
  end if;

  select coalesce(sum(quantity_change), 0)
  into v_on_hand
  from public.blank_inventory_movements
  where blank_product_id = v_item.blank_product_id
    and bin_id = v_bin_id;

  if v_on_hand < v_expected_quantity then
    return jsonb_build_object(
      'success', false,
      'message',
        format(
          'Insufficient inventory in the selected bin. On hand: %s; required: %s.',
          v_on_hand,
          v_expected_quantity
        )
    );
  end if;

  insert into public.blank_inventory_movements (
    bin_id,
    blank_product_id,
    quantity_change,
    movement_type,
    notes,
    job_item_id,
    job_id,
    source_type
  ) values (
    v_bin_id,
    v_item.blank_product_id,
    -v_expected_quantity,
    'adjustment',
    coalesce(
      nullif(btrim(p_notes), ''),
      'Completed and deducted blank from pull sheet.'
    ),
    v_job_item_id,
    v_item.job_id,
    'pullsheet_completion'
  )
  returning id into v_existing_movement_id;

  update public.job_items
  set
    status = 'completed',
    selected_bin_id = v_bin_id,
    updated_at = now()
  where id = v_job_item_id;

  update public.inventory_reservations
  set
    status = 'released',
    released_at = coalesce(released_at, now()),
    updated_at = now(),
    notes = concat_ws(
      E'\n',
      nullif(notes, ''),
      'Released after Complete + Deduct Blank.'
    )
  where job_item_id::text = v_job_item_id::text
    and lower(coalesce(status, '')) not in (
      'released',
      'completed',
      'fulfilled',
      'cancelled',
      'canceled',
      'voided'
    );

  get diagnostics v_released = row_count;

  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'inventory_deducted', true,
    'movement_id', v_existing_movement_id,
    'job_item_id', v_job_item_id,
    'quantity_deducted', v_expected_quantity,
    'released_reservations', v_released,
    'message', 'Completed and deducted blank inventory.'
  );

exception
  when unique_violation then
    select id
    into v_existing_movement_id
    from public.blank_inventory_movements
    where job_item_id = v_job_item_id
      and source_type = 'pullsheet_completion'
    order by id
    limit 1;

    update public.job_items
    set
      status = 'completed',
      selected_bin_id = coalesce(v_bin_id, selected_bin_id),
      updated_at = now()
    where id = v_job_item_id;

    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'inventory_deducted', false,
      'movement_id', v_existing_movement_id,
      'job_item_id', v_job_item_id,
      'message', 'Completion was already recorded; no additional inventory was deducted.'
    );
end;
$function$;


-- Keep older application callers safe by routing the existing RPC through
-- the idempotent implementation.
create or replace function public.complete_job_item(
  p_job_item_id bigint,
  p_bin_id bigint,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_result jsonb;
begin
  v_result := public.sc_complete_pull_sheet_item_deduct_blank_safe(
    p_job_item_id::text,
    null,
    p_bin_id::text,
    null,
    p_notes
  );

  if coalesce((v_result->>'success')::boolean, false) = false then
    raise exception '%',
      coalesce(v_result->>'message', 'Could not complete pull-sheet line.');
  end if;
end;
$function$;

grant execute on function
  public.sc_complete_pull_sheet_item_deduct_blank_safe(
    text,
    text,
    text,
    numeric,
    text
  )
to authenticated, service_role;

grant execute on function
  public.complete_job_item(bigint, bigint, text)
to authenticated, service_role;

commit;


-- =========================================================
-- Verification
-- Expected:
--   job_item_215_status = completed
--   movement_960_job_item_id = 215
--   backpack_on_hand = 1
--   linked_completion_movements = 3
--   active_reservations_for_215 = 0
--   safe_function_installed = true
-- =========================================================

select
  ji.id as job_item_id,
  ji.job_id,
  ji.status as job_item_215_status,
  ji.blank_product_id,
  ji.selected_bin_id,
  ji.quantity
from public.job_items ji
where ji.id = 215;

select
  m.id,
  m.job_item_id as movement_960_job_item_id,
  m.job_id,
  m.source_type,
  m.quantity_change,
  m.created_at
from public.blank_inventory_movements m
where m.id in (960, 962, 963)
order by m.id;

select
  coalesce(sum(quantity_change), 0) as backpack_on_hand
from public.blank_inventory_movements
where blank_product_id::text =
      '67710660-0de2-4b39-b159-048eb26e3ed2'
  and bin_id = 1;

select
  count(*) as linked_completion_movements
from public.blank_inventory_movements
where id in (960, 962, 963)
  and job_item_id is not null
  and source_type = 'pullsheet_completion';

select
  count(*) as active_reservations_for_215
from public.inventory_reservations
where job_item_id::text = '215'
  and lower(coalesce(status, '')) not in (
    'released',
    'completed',
    'fulfilled',
    'cancelled',
    'canceled',
    'voided'
  );

select
  to_regprocedure(
    'public.sc_complete_pull_sheet_item_deduct_blank_safe(text,text,text,numeric,text)'
  ) is not null as safe_function_installed;
