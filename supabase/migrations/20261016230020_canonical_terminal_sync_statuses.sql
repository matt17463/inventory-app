-- One canonical terminal-state predicate protects imports, reservations and mapping repair.
create or replace function public.sc_purchasing_status_is_active_v1(p_status text)
returns boolean language sql immutable set search_path='' as $$
 select regexp_replace(lower(coalesce(nullif(btrim(p_status),''),'active')),'^wc-','') not in (
 'cancelled','canceled','void','voided','deleted','archived','closed','complete','completed',
 'production_complete','fulfilled','filled','shipped','delivered','refunded','failed',
 'released','consumed','inactive','removed');
$$;
CREATE OR REPLACE FUNCTION public.sc_ensure_job_item_reservation_v1(p_job_id bigint, p_job_item_id bigint, p_blank_product_id uuid, p_quantity integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_job_status text; v_item_status text;
begin
  perform public.sc_require_internal_access(array['admin','manager','operator']);
  perform pg_advisory_xact_lock(hashtextextended('order-line-reservation:'||p_job_item_id::text,0));
  select lower(coalesce(j.status,'')),lower(coalesce(ji.status,''))
    into v_job_status,v_item_status from public.job_items ji join public.jobs j on j.id=ji.job_id
    where ji.id=p_job_item_id and ji.job_id=p_job_id for update of ji;
  if not found then raise exception 'The order line does not belong to this job.'; end if;
  if not public.sc_purchasing_status_is_active_v1(v_job_status)
    or not public.sc_purchasing_status_is_active_v1(v_item_status) then
    return jsonb_build_object('success',true,'action','skipped_terminal','needs_review',false);
  end if;
  return sc_internal.sc_ensure_job_item_reservation_v1(p_job_id,p_job_item_id,p_blank_product_id,p_quantity);
end;
$function$
;
notify pgrst,'reload schema';
