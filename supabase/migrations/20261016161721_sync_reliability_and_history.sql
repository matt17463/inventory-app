set local lock_timeout='2s';
-- The legacy callback calls a removed /sc/v1/update-stock route and performs
-- network I/O inside an inventory transaction. Bin movements are app-only;
-- storefront inventory policy is owned by WooCommerce.
drop trigger if exists trg_notify_wc_stock_update on public.products;
drop function if exists public.notify_wc_stock_update();
create table sc_maintenance.sync_queue_before_20261016 as
select * from public.woo_sync_queue where status='pending'
  and entity_type in ('blank_product','reservation');
alter table sc_maintenance.sync_queue_before_20261016 enable row level security;
update public.woo_sync_queue set status='ignored', processed_at=now(),
  last_error=null, payload=payload || jsonb_build_object('disposition','Internal bin/hold event; no WooCommerce stock publication is required.')
where status='pending' and entity_type in ('blank_product','reservation');
create or replace function public.sc_classify_internal_sync_event_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.entity_type in ('blank_product','reservation') and new.status='pending' then
    new.status := 'ignored'; new.processed_at := now();
    new.payload := coalesce(new.payload,'{}') || jsonb_build_object('disposition','Internal bin/hold event; no WooCommerce stock publication is required.');
  end if;
  return new;
end;
$$;
revoke all on function public.sc_classify_internal_sync_event_v1() from public,anon,authenticated;
create trigger sc_classify_internal_sync_event before insert on public.woo_sync_queue
for each row execute function public.sc_classify_internal_sync_event_v1();

create table sc_maintenance.order_sync_leases (
  order_id bigint primary key, token uuid not null, expires_at timestamptz not null
);
alter table sc_maintenance.order_sync_leases enable row level security;
create function public.sc_acquire_order_sync_lease_v1(p_order_id bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_token uuid := gen_random_uuid(); v_result uuid;
begin
  if p_order_id is null or p_order_id <= 0 then raise exception 'A valid WooCommerce order ID is required'; end if;
  insert into sc_maintenance.order_sync_leases(order_id,token,expires_at)
  values(p_order_id,v_token,now()+interval '5 minutes')
  on conflict(order_id) do update set token=excluded.token,expires_at=excluded.expires_at
  where sc_maintenance.order_sync_leases.expires_at < now()
  returning token into v_result;
  return v_result;
end;
$$;
create function public.sc_release_order_sync_lease_v1(p_order_id bigint,p_token uuid)
returns void language sql security definer set search_path='' as $$
  delete from sc_maintenance.order_sync_leases where order_id=p_order_id and token=p_token
$$;
revoke all on function public.sc_acquire_order_sync_lease_v1(bigint) from public,anon,authenticated;
revoke all on function public.sc_release_order_sync_lease_v1(bigint,uuid) from public,anon,authenticated;
grant execute on function public.sc_acquire_order_sync_lease_v1(bigint) to service_role;
grant execute on function public.sc_release_order_sync_lease_v1(bigint,uuid) to service_role;

-- Serialize reservation retries per line. A delayed webhook must never reserve
-- a completed/cancelled line again, even if its old hold was released.
create or replace function public.sc_ensure_job_item_reservation_v1(
  p_job_id bigint,p_job_item_id bigint,p_blank_product_id uuid,p_quantity integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job_status text; v_item_status text;
begin
  perform public.sc_require_internal_access(array['admin','manager','operator']);
  perform pg_advisory_xact_lock(hashtextextended('order-line-reservation:'||p_job_item_id::text,0));
  select lower(coalesce(j.status,'')),lower(coalesce(ji.status,''))
    into v_job_status,v_item_status from public.job_items ji join public.jobs j on j.id=ji.job_id
    where ji.id=p_job_item_id and ji.job_id=p_job_id for update of ji;
  if not found then raise exception 'The order line does not belong to this job.'; end if;
  if v_job_status in ('complete','completed','closed','cancelled','canceled','refunded','failed','void','voided','deleted','shipped','delivered')
    or v_item_status in ('complete','completed','closed','cancelled','canceled','refunded','failed','void','voided','deleted','shipped','delivered') then
    return jsonb_build_object('success',true,'action','skipped_terminal','needs_review',false);
  end if;
  return sc_internal.sc_ensure_job_item_reservation_v1(p_job_id,p_job_item_id,p_blank_product_id,p_quantity);
end;
$$;
revoke all on function public.sc_ensure_job_item_reservation_v1(bigint,bigint,uuid,integer) from public,anon;
grant execute on function public.sc_ensure_job_item_reservation_v1(bigint,bigint,uuid,integer) to authenticated,service_role;

create function public.sc_woocommerce_sync_health_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.sc_require_internal_access(array['admin','manager']);
  return jsonb_build_object(
    'stock_publication','app_only',
    'last_attribute_update',(select max(updated_at) from (
      select updated_at from public.colors union all select updated_at from public.sizes
      union all select updated_at from public.product_types union all select updated_at from public.brands
    ) a),
    'latest_product_created',(select max(created_at) from public.products),
    'last_successful_order_sync',(select max(completed_at) from public.sc_pullsheet_sync_runs where outcome='completed'),
    'order_syncs_needing_attention',(select count(*) from public.sc_pullsheet_sync_runs where
      created_at > now()-interval '7 days' and (outcome in ('failed','completed_with_warnings') or completed_at is null)),
    'queue_counts',(select coalesce(jsonb_object_agg(status,n),'{}') from (
      select status,count(*) n from public.woo_sync_queue group by status) q),
    'recent_order_syncs',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (
      select id,created_at,completed_at,source,woocommerce_order_id,job_id,outcome,
        items_created,items_updated,items_existing,reservations_failed,items_needing_pairing,error_message
      from public.sc_pullsheet_sync_runs order by created_at desc limit 30) r)
  );
end;
$$;
revoke all on function public.sc_woocommerce_sync_health_v1() from public,anon;
grant execute on function public.sc_woocommerce_sync_health_v1() to authenticated,service_role;
notify pgrst,'reload schema';
