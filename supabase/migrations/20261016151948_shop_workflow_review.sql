-- PO lifecycle uses the existing internal-user RLS policies.
create or replace function public.sc_delete_unreceived_purchase_order(p_purchase_order_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.purchase_orders%rowtype;
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager'), false) = false then raise exception 'Manager permission required'; end if;
  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found or access denied'; end if;
  perform 1 from public.purchase_order_items where purchase_order_id = p_purchase_order_id for update;
  if exists (select 1 from public.purchase_order_items where purchase_order_id = p_purchase_order_id and quantity_received <> 0)
    or v_order.received_at is not null then
    raise exception 'Received orders cannot be deleted. Cancel remaining quantities instead.';
  end if;
  delete from public.purchase_orders where id = p_purchase_order_id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.sc_delete_unreceived_purchase_order(uuid) from public, anon;
grant execute on function public.sc_delete_unreceived_purchase_order(uuid) to authenticated;

create or replace function public.sc_cancel_purchase_order(p_purchase_order_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.purchase_orders%rowtype;
begin
  if coalesce(public.sc_current_app_role() in ('admin','manager'), false) = false then raise exception 'Manager permission required'; end if;
  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found or access denied'; end if;
  if v_order.status = 'received' then raise exception 'Fully received orders cannot be cancelled'; end if;
  perform 1 from public.purchase_order_items where purchase_order_id = p_purchase_order_id for update;
  update public.purchase_orders set status = 'cancelled', updated_at = now() where id = p_purchase_order_id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.sc_cancel_purchase_order(uuid) from public, anon;
grant execute on function public.sc_cancel_purchase_order(uuid) to authenticated;

-- Reject receiving through old links after cancellation. Existing RPC otherwise stays intact.
do $patch$
declare definition text;
begin
  select pg_get_functiondef('public.phase1_receive_purchase_order_item(uuid,integer,bigint,text)'::regprocedure) into definition;
  if position('Purchase order is cancelled' in definition) = 0 then
    definition := replace(definition, '  IF NOT EXISTS (SELECT 1 FROM public.bins WHERE id = p_bin_id) THEN',
      E'  IF EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = v_item.purchase_order_id AND status = ''cancelled'') THEN\n    RAISE EXCEPTION ''Purchase order is cancelled'';\n  END IF;\n\n  IF NOT EXISTS (SELECT 1 FROM public.bins WHERE id = p_bin_id) THEN');
    if position('Purchase order is cancelled' in definition) = 0 then raise exception 'Receiving RPC changed: review patch'; end if;
    execute definition;
  end if;
end $patch$;

-- Filter before ranking/limit, honoring saved job status instead of stale cached status.
-- Keep the established task and station logic and original function privileges.
do $patch$
declare definition text; old_filter text; new_filter text;
begin
  select pg_get_functiondef('public.sc_shop_touch_mode_v2(text,text,integer)'::regprocedure) into definition;
  old_filter := E'e.status_bucket not in (''cancelled'')\n      and not (e.status_bucket = ''production_complete'' and e.due_date < current_date - 2)';
  new_filter := E'e.status_bucket not in (''cancelled'', ''production_complete'', ''completed'', ''closed'')\n      and lower(coalesce(e.pullsheet_status, '''')) not in (''closed'', ''completed'', ''production_complete'', ''cancelled'', ''canceled'', ''archived'')\n      and regexp_replace(lower(coalesce(e.woo_status, '''')), ''^wc-'', '''') not in (''completed'', ''cancelled'', ''canceled'', ''refunded'', ''failed'')\n      and not exists (select 1 from public.jobs j where j.id = e.job_id and (lower(j.status) in (''closed'', ''completed'', ''production_complete'', ''cancelled'', ''canceled'', ''archived'', ''voided'') or regexp_replace(lower(coalesce(j.woo_status, '''')), ''^wc-'', '''') in (''completed'', ''cancelled'', ''canceled'', ''refunded'', ''failed'')))';
  if position(old_filter in definition) > 0 then
    definition := replace(definition, old_filter, new_filter);
    execute definition;
  elsif position(new_filter in definition) = 0 then
    raise exception 'Shop RPC changed: review filter patch';
  end if;
end $patch$;
notify pgrst, 'reload schema';
