-- Restore previous read/receive functions; this does not restore deleted purchase orders.
CREATE OR REPLACE FUNCTION public.phase1_receive_purchase_order_item(p_purchase_order_item_id uuid, p_quantity integer, p_bin_id bigint, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_po_id uuid;
  v_open integer;
  v_new_status text;
BEGIN
  IF p_purchase_order_item_id IS NULL THEN
    RAISE EXCEPTION 'Purchase order item ID is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Receive quantity must be greater than zero';
  END IF;

  IF p_bin_id IS NULL THEN
    RAISE EXCEPTION 'Destination bin is required';
  END IF;

  SELECT poi.*, po.po_number
  INTO v_item
  FROM public.purchase_order_items poi
  JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
  WHERE poi.id = p_purchase_order_item_id
  FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Purchase order item not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bins WHERE id = p_bin_id) THEN
    RAISE EXCEPTION 'Destination bin not found';
  END IF;

  v_open := GREATEST(v_item.quantity_ordered - v_item.quantity_received, 0);

  IF v_open <= 0 THEN
    RAISE EXCEPTION 'This line is already fully received';
  END IF;

  IF p_quantity > v_open THEN
    RAISE EXCEPTION 'Receive quantity % is greater than open quantity %', p_quantity, v_open;
  END IF;

  UPDATE public.purchase_order_items
  SET quantity_received = quantity_received + p_quantity
  WHERE id = p_purchase_order_item_id;

  INSERT INTO public.blank_inventory_movements (
    bin_id,
    blank_product_id,
    quantity_change,
    notes
  ) VALUES (
    p_bin_id,
    v_item.blank_product_id,
    p_quantity,
    COALESCE(NULLIF(trim(p_notes), ''), 'Received against ' || v_item.po_number)
  );

  v_po_id := v_item.purchase_order_id;

  SELECT CASE
    WHEN COUNT(*) FILTER (WHERE quantity_received < quantity_ordered) = 0 THEN 'received'
    WHEN COUNT(*) FILTER (WHERE quantity_received > 0) > 0 THEN 'partial'
    ELSE 'ordered'
  END INTO v_new_status
  FROM public.purchase_order_items
  WHERE purchase_order_id = v_po_id;

  UPDATE public.purchase_orders
  SET status = v_new_status,
      received_at = CASE WHEN v_new_status = 'received' THEN now() ELSE received_at END
  WHERE id = v_po_id;

  RETURN jsonb_build_object(
    'ok', true,
    'purchase_order_id', v_po_id,
    'purchase_order_item_id', p_purchase_order_item_id,
    'quantity_received', p_quantity,
    'status', v_new_status
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sc_shop_touch_mode_v2(p_station text DEFAULT 'all'::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 80)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_station text := lower(coalesce(nullif(p_station, ''), 'all'));
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_limit int := least(greatest(coalesce(p_limit, 80), 1), 250);
  v_has_board boolean;
  v_has_tasks boolean;
  v_jobs jsonb := '[]'::jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_metrics jsonb := '{}'::jsonb;
begin
  select to_regclass('public.sc_order_status_board') is not null into v_has_board;

  if not v_has_board then
    return jsonb_build_object(
      'generated_at', now(),
      'data_source', 'missing_sc_order_status_board',
      'metrics', jsonb_build_object(),
      'jobs', jsonb_build_array(),
      'tasks', jsonb_build_array(),
      'message', 'sc_order_status_board was not found. Run the Production Status Board sync SQL before using Shop Touch Mode.'
    );
  end if;

  with source_rows as (
    select
      b.*,
      to_jsonb(b) as row_json
    from public.sc_order_status_board b
  ), normalized as (
    select
      public.sc_shop_tv_safe_bigint(row_json->>'job_id') as job_id,
      public.sc_shop_tv_safe_bigint(row_json->>'woocommerce_order_id') as woocommerce_order_id,
      coalesce(nullif(row_json->>'woo_order_number', ''), nullif(row_json->>'order_number', '')) as woo_order_number,
      coalesce(
        nullif(row_json->>'customer_name', ''),
        nullif(row_json->>'woo_customer_name', ''),
        nullif(row_json->>'billing_name', ''),
        nullif(row_json->>'customer_display_name', ''),
        nullif(row_json->>'customer', ''),
        'No customer name'
      ) as customer_name,
      coalesce(nullif(row_json->>'job_name', ''), nullif(row_json->>'name', ''), nullif(row_json->>'title', '')) as job_name,
      coalesce(nullif(row_json->>'production_status', ''), nullif(row_json->>'status', ''), 'new_order') as production_status,
      coalesce(nullif(row_json->>'board_column', ''), nullif(row_json->>'production_status', ''), 'new_order') as board_column,
      coalesce(nullif(row_json->>'pullsheet_status', ''), nullif(row_json->>'job_status', ''), nullif(row_json->>'status', '')) as pullsheet_status,
      coalesce(nullif(row_json->>'woo_status', ''), nullif(row_json->>'woocommerce_status', ''), '') as woo_status,
      public.sc_shop_tv_safe_date(coalesce(nullif(row_json->>'due_date', ''), nullif(row_json->>'production_due_date', ''))) as due_date,
      public.sc_shop_tv_safe_int(coalesce(nullif(row_json->>'total_lines', ''), nullif(row_json->>'line_count', ''), '0')) as total_lines,
      public.sc_shop_tv_safe_int(coalesce(nullif(row_json->>'resolved_lines', ''), '0')) as resolved_lines,
      public.sc_shop_tv_safe_int(coalesce(nullif(row_json->>'unresolved_lines', ''), '0')) as unresolved_lines,
      public.sc_shop_tv_safe_int(coalesce(nullif(row_json->>'unpaired_required_lines', ''), '0')) as unpaired_required_lines,
      public.sc_shop_tv_safe_int(coalesce(nullif(row_json->>'reserved_lines', ''), '0')) as reserved_lines,
      coalesce(nullif(row_json->>'production_status_reason', ''), nullif(row_json->>'status_reason', ''), '') as production_status_reason,
      case
        when jsonb_typeof(row_json->'blocking_issues') = 'array' then row_json->'blocking_issues'
        else '[]'::jsonb
      end as blocking_issues,
      row_json
    from source_rows
  ), enriched as (
    select
      n.*,
      public.sc_shop_tv_due_bucket(n.due_date) as due_date_bucket,
      public.sc_shop_tv_status_bucket(n.production_status, n.board_column) as status_bucket,
      public.sc_shop_tv_next_action(
        n.production_status,
        n.board_column,
        n.unpaired_required_lines,
        n.unresolved_lines,
        public.sc_shop_tv_due_bucket(n.due_date)
      ) as next_action
    from normalized n
  ), filtered as (
    select *
    from enriched e
    where
      e.status_bucket not in ('cancelled')
      and not (e.status_bucket = 'production_complete' and e.due_date < current_date - 2)
      and (
        v_search is null
        or lower(coalesce(e.woo_order_number, '')) like '%' || v_search || '%'
        or lower(coalesce(e.woocommerce_order_id::text, '')) like '%' || v_search || '%'
        or lower(coalesce(e.job_id::text, '')) like '%' || v_search || '%'
        or lower(coalesce(e.customer_name, '')) like '%' || v_search || '%'
        or lower(coalesce(e.job_name, '')) like '%' || v_search || '%'
        or lower(coalesce(e.production_status, '')) like '%' || v_search || '%'
        or lower(coalesce(e.pullsheet_status, '')) like '%' || v_search || '%'
      )
      and (
        v_station = 'all'
        or (v_station = 'press' and e.status_bucket in ('ready_to_produce', 'in_production', 'needs_attention', 'partially_reserved'))
        or (v_station = 'receiving' and (e.status_bucket in ('needs_attention', 'partially_reserved') or e.unpaired_required_lines > 0))
        or (v_station = 'qc' and e.status_bucket in ('qc', 'ready_to_ship', 'production_complete'))
        or (v_station = 'packing' and e.status_bucket in ('ready_to_ship', 'production_complete', 'qc'))
        or (v_station = 'admin' and (e.due_date is null or e.status_bucket in ('needs_attention', 'on_hold') or lower(e.woo_status) = 'completed' and e.status_bucket <> 'production_complete'))
      )
  ), ranked as (
    select
      f.*,
      case
        when f.status_bucket = 'needs_attention' then 0
        when f.due_date_bucket = 'overdue' then 1
        when f.due_date_bucket = 'due_today' then 2
        when f.status_bucket = 'ready_to_produce' then 3
        when f.status_bucket = 'in_production' then 4
        when f.status_bucket in ('qc', 'ready_to_ship') then 5
        when f.due_date is null then 8
        else 6
      end as sort_rank
    from filtered f
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'job_id', job_id,
          'woocommerce_order_id', woocommerce_order_id,
          'woo_order_number', woo_order_number,
          'customer_name', customer_name,
          'job_name', job_name,
          'production_status', production_status,
          'board_column', board_column,
          'pullsheet_status', pullsheet_status,
          'woo_status', woo_status,
          'due_date', due_date,
          'due_date_bucket', due_date_bucket,
          'status_bucket', status_bucket,
          'total_lines', total_lines,
          'resolved_lines', resolved_lines,
          'unresolved_lines', unresolved_lines,
          'unpaired_required_lines', unpaired_required_lines,
          'reserved_lines', reserved_lines,
          'production_status_reason', production_status_reason,
          'blocking_issues', blocking_issues,
          'next_action', next_action
        )
        order by sort_rank, due_date nulls last, woocommerce_order_id desc nulls last, job_id desc nulls last
      ),
      '[]'::jsonb
    )
  into v_jobs
  from (
    select * from ranked
    order by sort_rank, due_date nulls last, woocommerce_order_id desc nulls last, job_id desc nulls last
    limit v_limit
  ) x;

  with source_rows as (
    select b.*, to_jsonb(b) as row_json from public.sc_order_status_board b
  ), normalized as (
    select
      public.sc_shop_tv_safe_bigint(row_json->>'job_id') as job_id,
      public.sc_shop_tv_safe_bigint(row_json->>'woocommerce_order_id') as woocommerce_order_id,
      coalesce(nullif(row_json->>'woo_status', ''), nullif(row_json->>'woocommerce_status', ''), '') as woo_status,
      coalesce(nullif(row_json->>'production_status', ''), nullif(row_json->>'status', ''), 'new_order') as production_status,
      coalesce(nullif(row_json->>'board_column', ''), nullif(row_json->>'production_status', ''), 'new_order') as board_column,
      public.sc_shop_tv_safe_date(coalesce(nullif(row_json->>'due_date', ''), nullif(row_json->>'production_due_date', ''))) as due_date,
      public.sc_shop_tv_safe_int(coalesce(nullif(row_json->>'unpaired_required_lines', ''), '0')) as unpaired_required_lines
    from source_rows
  ), enriched as (
    select
      n.*,
      public.sc_shop_tv_due_bucket(n.due_date) as due_bucket,
      public.sc_shop_tv_status_bucket(n.production_status, n.board_column) as status_bucket
    from normalized n
  )
  select jsonb_build_object(
    'total_open', count(*) filter (where status_bucket not in ('production_complete', 'cancelled')),
    'overdue', count(*) filter (where due_bucket = 'overdue' and status_bucket not in ('production_complete', 'cancelled')),
    'due_today', count(*) filter (where due_bucket = 'due_today' and status_bucket not in ('production_complete', 'cancelled')),
    'due_tomorrow', count(*) filter (where due_bucket = 'due_tomorrow' and status_bucket not in ('production_complete', 'cancelled')),
    'due_this_week', count(*) filter (where due_bucket = 'due_this_week' and status_bucket not in ('production_complete', 'cancelled')),
    'no_due_date', count(*) filter (where due_bucket = 'no_due_date' and status_bucket not in ('production_complete', 'cancelled')),
    'needs_attention', count(*) filter (where status_bucket = 'needs_attention'),
    'ready_to_produce', count(*) filter (where status_bucket = 'ready_to_produce'),
    'in_production', count(*) filter (where status_bucket = 'in_production'),
    'qc', count(*) filter (where status_bucket in ('qc', 'ready_to_ship')),
    'production_complete', count(*) filter (where status_bucket = 'production_complete'),
    'unpaired_required_lines', coalesce(sum(unpaired_required_lines) filter (where status_bucket not in ('production_complete', 'cancelled')), 0),
    'woo_completed_not_production', count(*) filter (where lower(woo_status) = 'completed' and status_bucket <> 'production_complete')
  )
  into v_metrics
  from enriched;

  select to_regclass('public.phase5_tasks_detail') is not null into v_has_tasks;

  if v_has_tasks then
    execute $sql$
      with task_rows as (
        select to_jsonb(t) as row_json
        from public.phase5_tasks_detail t
      ), open_tasks as (
        select row_json
        from task_rows
        where lower(coalesce(row_json->>'status', '')) not in ('done', 'completed', 'cancelled', 'archived')
        order by coalesce(row_json->>'due_at', '') asc, coalesce(row_json->>'created_at', '') desc
        limit 20
      )
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', coalesce(row_json->>'id', row_json->>'task_id'),
            'title', coalesce(nullif(row_json->>'title', ''), nullif(row_json->>'task_title', ''), 'Task'),
            'status', coalesce(row_json->>'status', 'open'),
            'assigned_to_name', coalesce(nullif(row_json->>'assigned_to_name', ''), nullif(row_json->>'assigned_to', '')),
            'due_at', nullif(row_json->>'due_at', '')
          )
        ),
        '[]'::jsonb
      )
      from open_tasks
    $sql$ into v_tasks;
  else
    v_tasks := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'data_source', 'sc_order_status_board',
    'station', v_station,
    'search', p_search,
    'metrics', coalesce(v_metrics, '{}'::jsonb),
    'jobs', coalesce(v_jobs, '[]'::jsonb),
    'tasks', coalesce(v_tasks, '[]'::jsonb)
  );
end;
$function$
;
drop function if exists public.sc_delete_unreceived_purchase_order(uuid);
drop function if exists public.sc_cancel_purchase_order(uuid);
notify pgrst, 'reload schema';

-- After reverting the frontend to its prior RPC contract:
drop function if exists public.sc_receive_finished_product_v2(uuid,uuid,bigint,integer,text,text,bigint,bigint,text,text,text,text,text,boolean,bigint,bigint,bigint);
