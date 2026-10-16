set local lock_timeout='2s';
-- The current schema has typed WooCommerce IDs and status columns. Avoid
-- repeatedly serializing entire jobs (including their Woo payloads) to JSON.
create index if not exists sc_job_items_order_sku_lower_idx on public.job_items
  (lower(btrim(coalesce(order_sku,sku,'')))) where coalesce(inventory_required,true);
create or replace function public.sc_reconcile_product_mapping_to_open_pullsheet_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_wp_id bigint; v_sku text; v_job record;
begin
  if new.blank_product_id is null or new.blank_product_id is not distinct from old.blank_product_id then return new; end if;
  v_wp_id:=coalesce(new.woocommerce_variation_id,new.woocommerce_product_id);
  v_sku:=nullif(btrim(new.sku),'');
  for v_job in
    with matching as materialized (
      select ji.id,ji.job_id,ji.blank_product_id from public.job_items ji join public.jobs j on j.id=ji.job_id
      where coalesce(ji.inventory_required,true)
        and public.sc_purchasing_status_is_active_v1(j.status)
        and public.sc_purchasing_status_is_active_v1(ji.status)
        and (
          (v_wp_id is not null and (ji.woocommerce_variation_id=v_wp_id
            or (ji.woocommerce_variation_id is null and ji.woocommerce_product_id=v_wp_id)))
          or (v_sku is not null and v_sku !~* '^MANUAL-[0-9]+-LINE-[0-9]+$'
            and lower(btrim(coalesce(ji.order_sku,ji.sku,'')))=lower(v_sku))
        )
    ), paired as (
      update public.job_items ji set blank_product_id=new.blank_product_id from matching m
      where ji.id=m.id and ji.blank_product_id is null returning ji.job_id
    )
    select distinct job_id from matching where blank_product_id is null or blank_product_id=new.blank_product_id
    union select job_id from paired
  loop
    perform public.sc_repair_pullsheet_purchasing_integrity_v1(v_job.job_id,null);
  end loop;
  return new;
end;
$$;
revoke all on function public.sc_reconcile_product_mapping_to_open_pullsheet_v1() from public,anon,authenticated;
notify pgrst,'reload schema';

create index if not exists sc_products_sku_mapping_norm_idx on public.products(public.sc_mapping_norm_v1(sku));
-- The compatibility entry point keeps its role guard. Restrict the privileged
-- implementation's propagation to active inventory lines, preserving history.
create or replace function sc_internal.sc_set_product_blank_mapping_v1(p_source_kind text, p_source_key text, p_blank_product_id uuid, p_mapping_source text DEFAULT 'manual'::text, p_notes text DEFAULT NULL::text, p_propagate_unpaired boolean DEFAULT true, p_actor_id uuid DEFAULT NULL::uuid)
returns jsonb language plpgsql security definer set search_path='' as $mapping$

declare
  v_kind text := lower(trim(coalesce(p_source_kind, '')));
  v_key text := trim(coalesce(p_source_key, ''));
  v_norm text;
  v_old uuid;
  v_products integer := 0;
  v_lines integer := 0;
begin
  if v_kind not in ('woocommerce_variation', 'woocommerce_sku', 'woocommerce_product') then
    raise exception 'Unsupported mapping source kind: %', p_source_kind;
  end if;
  if v_key = '' then raise exception 'Mapping source key is required'; end if;
  if not exists (
    select 1 from public.blank_products
    where id = p_blank_product_id and coalesce(sc_is_archived, false) = false
  ) then
    raise exception 'The selected replacement blank does not exist or is archived';
  end if;

  v_norm := public.sc_mapping_norm_v1(v_key);
  perform pg_advisory_xact_lock(hashtext(v_kind || ':' || v_norm));

  select blank_product_id into v_old
  from public.sc_product_blank_mappings
  where source_kind = v_kind and source_key_norm = v_norm and is_active
  limit 1;

  update public.sc_product_blank_mappings
     set is_active = false, superseded_at = now(), updated_at = now()
   where source_kind = v_kind and source_key_norm = v_norm and is_active;

  insert into public.sc_product_blank_mappings(
    source_kind, source_key, source_key_norm, blank_product_id,
    mapping_source, notes, created_by
  ) values (
    v_kind, v_key, v_norm, p_blank_product_id,
    coalesce(nullif(trim(p_mapping_source), ''), 'manual'), nullif(trim(p_notes), ''), p_actor_id
  );

  if v_kind = 'woocommerce_variation' and v_key ~ '^[0-9]+$' then
    update public.products set blank_product_id = p_blank_product_id
     where woocommerce_variation_id = v_key::bigint
       and blank_product_id is distinct from p_blank_product_id;
    get diagnostics v_products = row_count;
    if p_propagate_unpaired then
      update public.job_items ji set
        blank_product_id = p_blank_product_id,
        pairing_source = 'remembered_variation_mapping',
        pairing_warning = null
      where ji.blank_product_id is null and coalesce(ji.inventory_required,true)
        and public.sc_purchasing_status_is_active_v1(ji.status)
        and exists(select 1 from public.jobs active_job where active_job.id=ji.job_id
          and public.sc_purchasing_status_is_active_v1(active_job.status)) and woocommerce_variation_id = v_key::bigint;
      get diagnostics v_lines = row_count;
    end if;
  elsif v_kind = 'woocommerce_sku' then
    update public.products set blank_product_id = p_blank_product_id
     where public.sc_mapping_norm_v1(sku) = v_norm
       and blank_product_id is distinct from p_blank_product_id;
    get diagnostics v_products = row_count;
    if p_propagate_unpaired then
      update public.job_items ji set
        blank_product_id = p_blank_product_id,
        pairing_source = 'remembered_sku_mapping',
        pairing_warning = null
      where ji.blank_product_id is null and coalesce(ji.inventory_required,true)
        and public.sc_purchasing_status_is_active_v1(ji.status)
        and exists(select 1 from public.jobs active_job where active_job.id=ji.job_id
          and public.sc_purchasing_status_is_active_v1(active_job.status))
        and public.sc_mapping_norm_v1(coalesce(order_sku, sku)) = v_norm;
      get diagnostics v_lines = row_count;
    end if;
  elsif v_kind = 'woocommerce_product' and v_key ~ '^[0-9]+$' then
    update public.products set blank_product_id = p_blank_product_id
     where woocommerce_product_id = v_key::bigint
       and woocommerce_variation_id is null
       and blank_product_id is distinct from p_blank_product_id;
    get diagnostics v_products = row_count;
  end if;

  insert into public.sc_product_blank_mapping_events(
    event_type, source_kind, source_key, old_blank_product_id, new_blank_product_id,
    mapping_source, notes, affected, actor_id
  ) values (
    case when v_old is null then 'mapping_created' else 'mapping_replaced' end,
    v_kind, v_key, v_old, p_blank_product_id, p_mapping_source, p_notes,
    jsonb_build_object('products_updated', v_products, 'unpaired_lines_repaired', v_lines), p_actor_id
  );

  return jsonb_build_object(
    'source_kind', v_kind, 'source_key', v_key,
    'old_blank_product_id', v_old, 'blank_product_id', p_blank_product_id,
    'products_updated', v_products, 'unpaired_lines_repaired', v_lines
  );
end;

$mapping$;
revoke all on function sc_internal.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid) from public,anon,authenticated;
