-- Skilled Crafting Inventory v1.1.3
-- Supplier receiving unit-cost safety
--
-- Fixes automatic blank-product creation when a supplier confirmation row
-- omitted unit_cost from the guarded JSON payload. It also preserves the
-- current cost during partial product edits and rejects negative costs.

begin;

update public.blank_products
set unit_cost = 0
where unit_cost is null;

alter table public.blank_products
  alter column unit_cost set default 0,
  alter column unit_cost set not null;

create or replace function public.sc_create_blank_product_safe_v1(
  p_payload jsonb,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_preview jsonb;
  v_row public.blank_products%rowtype;
  v_key text;
  v_unit_cost numeric := 0;
begin
  v_key := public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base',''));
  if v_key = '' or trim(coalesce(p_payload->>'name','')) = '' then
    raise exception 'SKU and product name are required.';
  end if;

  if p_payload ? 'unit_cost'
     and nullif(trim(coalesce(p_payload->>'unit_cost', '')), '') is not null then
    begin
      v_unit_cost := (p_payload->>'unit_cost')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Unit cost must be a number that is zero or greater.';
    end;
  end if;
  if v_unit_cost < 0 then
    raise exception 'Unit cost must be a number that is zero or greater.';
  end if;

  perform pg_advisory_xact_lock(hashtext('sc-blank:' || v_key));
  v_preview := public.sc_preview_blank_product_v1(p_payload);
  if v_preview->>'decision' <> 'create_allowed' then
    return jsonb_build_object('success', false, 'blocked', true, 'preview', v_preview);
  end if;

  insert into public.blank_products (
    sku_base, name, barcode, brand_id, product_type_id, color_id, size_id,
    image_url, unit_cost, low_stock_threshold
  ) values (
    upper(trim(p_payload->>'sku_base')),
    trim(p_payload->>'name'),
    nullif(trim(p_payload->>'barcode'), ''),
    nullif(p_payload->>'brand_id','')::bigint,
    nullif(p_payload->>'product_type_id','')::bigint,
    nullif(p_payload->>'color_id','')::bigint,
    nullif(p_payload->>'size_id','')::bigint,
    nullif(trim(p_payload->>'image_url'), ''),
    v_unit_cost,
    coalesce(nullif(p_payload->>'low_stock_threshold','')::integer, 0)
  )
  returning * into v_row;

  insert into public.sc_core_mutation_audit(
    action, entity_type, entity_id_text, actor_user_id,
    after_snapshot, reason
  ) values (
    'create', 'blank_product', v_row.id::text, p_actor,
    to_jsonb(v_row), 'Guarded product creation'
  );

  return jsonb_build_object(
    'success', true,
    'created', true,
    'blank', to_jsonb(v_row),
    'preview', v_preview
  );
end;
$$;

create or replace function public.sc_update_blank_product_safe_v1(
  p_blank_product_id uuid,
  p_payload jsonb,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.blank_products%rowtype;
  v_after public.blank_products%rowtype;
  v_conflict uuid;
  v_unit_cost numeric;
begin
  select * into v_before
  from public.blank_products
  where id = p_blank_product_id and sc_is_archived is false
  for update;
  if not found then
    raise exception 'Active blank product % was not found.', p_blank_product_id;
  end if;

  v_unit_cost := v_before.unit_cost;
  if p_payload ? 'unit_cost'
     and nullif(trim(coalesce(p_payload->>'unit_cost', '')), '') is not null then
    begin
      v_unit_cost := (p_payload->>'unit_cost')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Unit cost must be a number that is zero or greater.';
    end;
  end if;
  if v_unit_cost < 0 then
    raise exception 'Unit cost must be a number that is zero or greater.';
  end if;

  select bp.id into v_conflict
  from public.blank_products bp
  where bp.id <> p_blank_product_id
    and bp.sc_is_archived is false
    and (
      (public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base', v_before.sku_base::text)) <> '' and
       public.sc_identity_norm_v1(bp.sku_base::text) = public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base', v_before.sku_base::text)))
      or
      (public.sc_identity_norm_v1(coalesce(p_payload->>'barcode', v_before.barcode::text)) <> '' and
       public.sc_identity_norm_v1(bp.barcode::text) = public.sc_identity_norm_v1(coalesce(p_payload->>'barcode', v_before.barcode::text)))
      or
      (bp.brand_id = coalesce(nullif(p_payload->>'brand_id','')::bigint, v_before.brand_id)
       and bp.product_type_id = coalesce(nullif(p_payload->>'product_type_id','')::bigint, v_before.product_type_id)
       and bp.color_id = coalesce(nullif(p_payload->>'color_id','')::bigint, v_before.color_id)
       and bp.size_id = coalesce(nullif(p_payload->>'size_id','')::bigint, v_before.size_id))
    )
  limit 1;

  if v_conflict is not null then
    return jsonb_build_object(
      'success', false,
      'blocked', true,
      'conflicting_blank_product_id', v_conflict,
      'message', 'This edit would create a duplicate SKU, barcode, or complete product identity.'
    );
  end if;

  update public.blank_products set
    sku_base = upper(trim(coalesce(p_payload->>'sku_base', v_before.sku_base::text))),
    name = trim(coalesce(p_payload->>'name', v_before.name::text)),
    barcode = case when p_payload ? 'barcode' then nullif(trim(p_payload->>'barcode'),'') else v_before.barcode end,
    brand_id = case when p_payload ? 'brand_id' then nullif(p_payload->>'brand_id','')::bigint else v_before.brand_id end,
    product_type_id = case when p_payload ? 'product_type_id' then nullif(p_payload->>'product_type_id','')::bigint else v_before.product_type_id end,
    color_id = case when p_payload ? 'color_id' then nullif(p_payload->>'color_id','')::bigint else v_before.color_id end,
    size_id = case when p_payload ? 'size_id' then nullif(p_payload->>'size_id','')::bigint else v_before.size_id end,
    image_url = case when p_payload ? 'image_url' then nullif(trim(p_payload->>'image_url'),'') else v_before.image_url end,
    unit_cost = v_unit_cost,
    low_stock_threshold = case when p_payload ? 'low_stock_threshold' then nullif(p_payload->>'low_stock_threshold','')::integer else v_before.low_stock_threshold end
  where id = p_blank_product_id
  returning * into v_after;

  insert into public.sc_core_mutation_audit(
    action, entity_type, entity_id_text, actor_user_id,
    before_snapshot, after_snapshot, reason
  ) values (
    'update', 'blank_product', p_blank_product_id::text, p_actor,
    to_jsonb(v_before), to_jsonb(v_after), 'Guarded product update'
  );

  return jsonb_build_object('success', true, 'blank', to_jsonb(v_after));
end;
$$;

revoke all on function public.sc_create_blank_product_safe_v1(jsonb,uuid)
from public, anon, authenticated;
revoke all on function public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)
from public, anon, authenticated;

grant execute on function public.sc_create_blank_product_safe_v1(jsonb,uuid)
to service_role;
grant execute on function public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)
to service_role;

commit;

select
  to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is not null
    as guarded_create_ready,
  to_regprocedure('public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)') is not null
    as guarded_update_ready,
  (
    select is_nullable = 'NO'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'blank_products'
      and column_name = 'unit_cost'
  ) as unit_cost_required;
