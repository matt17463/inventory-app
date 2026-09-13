-- Skilled Crafting Inventory App v1.4.10
-- Restore a pull-sheet line that was accidentally marked non-inventory.
--
-- Safety:
--   * Never changes physical on-hand inventory.
--   * Never creates an inventory movement.
--   * Restores only an exact/current/audited blank_product_id.
--   * Does not guess/fuzzy-match a blank.
--   * Re-enables Purchasing demand.
--   * Uses Pending Stock for shortages.
--   * Recreates a reservation only when enough inventory is available.
--   * Leaves any reusable non-inventory rule active and reports it to the UI.

begin;

create or replace function public.sc_restore_job_item_inventory_tracking(
  p_job_item_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.job_items%rowtype;
  v_blank_id uuid;
  v_audit_blank_id uuid;
  v_audit_finished_id uuid;
  v_manual_blank_id uuid;
  v_pending_bin_id bigint;
  v_required_qty integer := 0;
  v_available numeric := 0;
  v_rule_id bigint;
  v_reservation_attempted boolean := false;
  v_reservation_active boolean := false;
  v_reservation_warning text := null;
  v_pending_stock_assigned boolean := false;
  v_pairing_source text;
begin
  select *
  into v_item
  from public.job_items
  where id = p_job_item_id
  for update;

  if not found then
    raise exception 'Job item % was not found.', p_job_item_id;
  end if;

  if coalesce(v_item.inventory_required, true) = true then
    return jsonb_build_object(
      'success', true,
      'already_inventory_required', true,
      'job_item_id', v_item.id,
      'job_id', v_item.job_id,
      'blank_product_id', v_item.blank_product_id,
      'message', 'Inventory tracking is already enabled for this line.'
    );
  end if;

  v_rule_id := v_item.non_inventory_rule_id;
  v_blank_id := v_item.blank_product_id;
  v_required_qty := greatest(ceil(coalesce(v_item.quantity, 0))::integer, 0);

  -- Recover the most recent audited pairing when Mark Non-Inventory
  -- cleared blank_product_id.
  if v_blank_id is null
     and to_regclass('public.sc_non_inventory_actions_log') is not null then
    select
      l.previous_blank_product_id,
      l.previous_finished_product_id
    into
      v_audit_blank_id,
      v_audit_finished_id
    from public.sc_non_inventory_actions_log l
    where l.job_item_id = p_job_item_id
      and (
        l.previous_blank_product_id is not null
        or l.previous_finished_product_id is not null
      )
    order by l.created_at desc, l.id desc
    limit 1;

    v_blank_id := v_audit_blank_id;
  end if;

  -- Manual invoice lines have an additional exact source record that can
  -- safely restore the UUID without fuzzy product matching.
  if v_blank_id is null
     and v_item.manual_order_item_id is not null
     and to_regclass('public.sc_manual_invoice_order_items') is not null then
    begin
      execute
        'select blank_product_id
           from public.sc_manual_invoice_order_items
          where id = $1'
      into v_manual_blank_id
      using v_item.manual_order_item_id;

      v_blank_id := v_manual_blank_id;
    exception when undefined_column then
      v_manual_blank_id := null;
    end;
  end if;

  if v_blank_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'BLANK_PAIRING_REQUIRED',
      'job_item_id', v_item.id,
      'job_id', v_item.job_id,
      'rule_id', v_rule_id,
      'message',
        'Inventory tracking cannot be restored until this line has an exact blank pairing. Use Override Blank Pairing, then retry Restore Inventory Tracking.'
    );
  end if;

  perform 1
  from public.blank_products
  where id = v_blank_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'BLANK_PRODUCT_NOT_FOUND',
      'job_item_id', v_item.id,
      'job_id', v_item.job_id,
      'blank_product_id', v_blank_id,
      'rule_id', v_rule_id,
      'message',
        'The previously paired blank product no longer exists. Use Override Blank Pairing before restoring inventory tracking.'
    );
  end if;

  -- Available inventory determines whether the line belongs in Pending Stock.
  if to_regclass('public.app_blank_inventory_overview_v2') is not null then
    select coalesce(v.available_quantity, 0)
    into v_available
    from public.app_blank_inventory_overview_v2 v
    where v.blank_product_id = v_blank_id
    limit 1;
  end if;

  v_available := coalesce(v_available, 0);

  if v_required_qty > 0 and v_available < v_required_qty then
    select b.id
    into v_pending_bin_id
    from public.bins b
    where lower(trim(coalesce(b.label, ''))) = 'pending stock'
       or upper(trim(coalesce(b.bin_code, ''))) = 'PS'
    order by
      case
        when lower(trim(coalesce(b.label, ''))) = 'pending stock' then 0
        else 1
      end,
      b.id
    limit 1;

    v_pending_stock_assigned := v_pending_bin_id is not null;
  end if;

  v_pairing_source :=
    case
      when lower(coalesce(v_item.pairing_source, '')) like '%non_inventory%'
        then 'inventory_tracking_restored'
      else v_item.pairing_source
    end;

  update public.job_items
  set
    inventory_required = true,
    include_on_purchasing_report = true,
    non_inventory_reason = null,
    non_inventory_rule_id = null,
    non_inventory_marked_at = null,
    blank_product_id = v_blank_id,
    finished_product_id = coalesce(
      v_item.finished_product_id,
      v_audit_finished_id
    ),
    selected_bin_id = case
      when v_pending_stock_assigned then v_pending_bin_id
      else null
    end,
    pairing_source = v_pairing_source,
    pairing_warning = null,
    updated_at = now()
  where id = p_job_item_id;

  -- Only attempt a reservation if the entire line can currently be covered.
  -- This prevents creating a reservation against nonexistent/insufficient stock.
  if v_required_qty > 0
     and v_available >= v_required_qty
     and to_regprocedure(
       'public.sc_ensure_job_item_reservation_v1(bigint,bigint,uuid,integer)'
     ) is not null then

    v_reservation_attempted := true;

    begin
      perform public.sc_ensure_job_item_reservation_v1(
        v_item.job_id,
        v_item.id,
        v_blank_id,
        v_required_qty
      );
    exception when others then
      v_reservation_warning := SQLERRM;
    end;
  end if;

  if to_regclass('public.inventory_reservations') is not null then
    select exists (
      select 1
      from public.inventory_reservations r
      where r.job_item_id = p_job_item_id
        and lower(coalesce(r.status, '')) not in (
          'cancelled',
          'canceled',
          'released',
          'voided',
          'completed',
          'deleted'
        )
    )
    into v_reservation_active;
  end if;

  if to_regclass('public.sc_non_inventory_actions_log') is not null then
    insert into public.sc_non_inventory_actions_log(
      job_item_id,
      job_id,
      rule_id,
      action,
      previous_blank_product_id,
      previous_finished_product_id,
      previous_inventory_required,
      order_sku,
      reason,
      details
    )
    values (
      v_item.id,
      v_item.job_id,
      v_rule_id,
      'restore_inventory_tracking',
      v_item.blank_product_id,
      v_item.finished_product_id,
      v_item.inventory_required,
      v_item.order_sku,
      'Inventory tracking restored from pull sheet.',
      jsonb_build_object(
        'restored_blank_product_id', v_blank_id,
        'include_on_purchasing_report', true,
        'available_quantity_before_restore', v_available,
        'required_quantity', v_required_qty,
        'pending_stock_bin_id', v_pending_bin_id,
        'pending_stock_assigned', v_pending_stock_assigned,
        'reservation_attempted', v_reservation_attempted,
        'reservation_active', v_reservation_active,
        'reservation_warning', v_reservation_warning,
        'non_inventory_rule_left_active', v_rule_id is not null
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'job_item_id', v_item.id,
    'job_id', v_item.job_id,
    'blank_product_id', v_blank_id,
    'inventory_required', true,
    'include_on_purchasing_report', true,
    'available_quantity', v_available,
    'required_quantity', v_required_qty,
    'pending_stock_bin_id', v_pending_bin_id,
    'pending_stock_assigned', v_pending_stock_assigned,
    'reservation_attempted', v_reservation_attempted,
    'reservation_active', v_reservation_active,
    'reservation_warning', v_reservation_warning,
    'rule_id', v_rule_id,
    'rule_left_active', v_rule_id is not null,
    'message', case
      when v_pending_stock_assigned
        then 'Inventory tracking restored. The shortage was assigned to Pending Stock and included in Purchasing.'
      when v_reservation_active
        then 'Inventory tracking restored and inventory reservation is active.'
      else
        'Inventory tracking restored. Choose a physical source bin before completion.'
    end
  );
end;
$$;

grant execute
on function public.sc_restore_job_item_inventory_tracking(bigint)
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
