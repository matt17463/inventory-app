-- A board read must remain available to viewers; only working employees refresh the cache.
CREATE OR REPLACE FUNCTION sc_internal.sc_list_order_status_board(p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 250)
 RETURNS TABLE(id bigint, job_id bigint, woocommerce_order_id bigint, woo_order_number text, woo_status text, woo_payment_status text, customer_name text, order_total numeric, source_type text, pullsheet_status text, production_status text, production_status_label text, board_column text, board_column_label text, production_status_reason text, blocking_issues jsonb, total_lines integer, inventory_required_lines integer, non_inventory_lines integer, paired_required_lines integer, unpaired_required_lines integer, reserved_required_lines integer, resolved_lines integer, unresolved_lines integer, open_lines integer, job_created_at timestamp with time zone, due_date date, last_woo_sync_at timestamp with time zone, last_production_update_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text := lower(nullif(trim(coalesce(p_status, '')), ''));
  v_search text := lower(nullif(trim(coalesce(p_search, '')), ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 250), 1000));
begin
  if public.sc_internal_access_allowed(array['admin','manager','operator']) then
    perform public.sc_refresh_order_status_board(v_limit);
  end if;

  return query
  select
    b.id,
    b.job_id,
    b.woocommerce_order_id,
    b.woo_order_number,
    b.woo_status,
    b.woo_payment_status,
    b.customer_name,
    b.order_total,
    b.source_type,
    b.pullsheet_status,
    b.production_status,
    public.sc_status_pretty_label(b.production_status) as production_status_label,
    b.board_column,
    public.sc_status_pretty_label(b.board_column) as board_column_label,
    b.production_status_reason,
    b.blocking_issues,
    b.total_lines,
    b.inventory_required_lines,
    b.non_inventory_lines,
    b.paired_required_lines,
    b.unpaired_required_lines,
    b.reserved_required_lines,
    b.resolved_lines,
    b.unresolved_lines,
    b.open_lines,
    b.job_created_at,
    b.due_date,
    b.last_woo_sync_at,
    b.last_production_update_at,
    b.updated_at
  from public.sc_order_status_board b
  where (v_status is null or b.board_column = v_status or b.production_status = v_status or b.woo_status = v_status)
    and (
      v_search is null
      or lower(coalesce(b.customer_name, '')) like '%' || v_search || '%'
      or lower(coalesce(b.woo_order_number, '')) like '%' || v_search || '%'
      or coalesce(b.woocommerce_order_id::text, '') like '%' || v_search || '%'
      or coalesce(b.job_id::text, '') like '%' || v_search || '%'
    )
  order by
    case b.board_column
      when 'needs_attention' then 1
      when 'on_hold' then 2
      when 'new_order' then 3
      when 'ready_to_produce' then 4
      when 'in_production' then 5
      when 'qc' then 6
      when 'ready_to_ship' then 7
      when 'completed' then 8
      when 'cancelled' then 9
      else 10
    end,
    coalesce(b.due_date, current_date + 3650) asc,
    coalesce(b.job_created_at, b.updated_at) desc
  limit v_limit;
end;
$function$
;
notify pgrst, 'reload schema';
