set local lock_timeout='2s';
create table sc_maintenance.catalog_cost_corrections_20261016(
  blank_product_id uuid primary key,previous_cost numeric,preserved_cost numeric,
  units numeric,source_value numeric,created_at timestamptz default now()
);
alter table sc_maintenance.catalog_cost_corrections_20261016 enable row level security;
do $cleanup$
declare r record; v_before_units jsonb; v_after_units jsonb; v_expected_value numeric;
  v_actual_value numeric; v_case uuid; v_actor uuid; v_survivor uuid; v_preview jsonb;
  v_aliases int:=0; v_resolved int:=0; v_review int:=0;
begin
  select jsonb_object_agg(bin_id::text,n) into v_before_units from
    (select bin_id,sum(quantity_change) n from public.blank_inventory_movements group by bin_id)b;
  select coalesce(sum((m.row_data->>'quantity_change')::numeric*coalesce((bp.row_data->>'unit_cost')::numeric,0)),0)
    into v_expected_value from sc_maintenance.catalog_rows_before_20261016 m
    join sc_maintenance.catalog_rows_before_20261016 bp on bp.table_name='blank_products' and bp.row_key=m.row_data->>'blank_product_id'
    where m.table_name='blank_inventory_movements';
  -- Restore the pre-cleanup value for each merged physical item, using the
  -- saved quantities and costs. No new price or stock quantity is invented.
  for r in
    with stock as(select row_data->>'blank_product_id' id,sum((row_data->>'quantity_change')::numeric) qty
      from sc_maintenance.catalog_rows_before_20261016 where table_name='blank_inventory_movements' group by 1),
    amounts as(select coalesce(bp.sc_canonical_blank_product_id,bp.id) canonical_id,
      sum(coalesce(s.qty,0)) units,sum(coalesce(s.qty,0)*coalesce((old.row_data->>'unit_cost')::numeric,0)) original_value
      from sc_maintenance.catalog_rows_before_20261016 old join public.blank_products bp on bp.id::text=old.row_key
      left join stock s on s.id=old.row_key where old.table_name='blank_products'
        and not coalesce((old.row_data->>'sc_is_archived')::boolean,false)
      group by 1 having count(*)>1)
    select a.*,bp.unit_cost from amounts a join public.blank_products bp on bp.id=a.canonical_id
    where a.units>0 and coalesce(bp.unit_cost,0)*a.units<>a.original_value
  loop
    if round(r.original_value/r.units,2)*r.units<>r.original_value then
      raise exception 'Cost cannot be preserved at the stored precision; review required.';
    end if;
    insert into sc_maintenance.catalog_cost_corrections_20261016 values(r.canonical_id,r.unit_cost,round(r.original_value/r.units,2),r.units,r.original_value,now());
    update public.blank_products set unit_cost=round(r.original_value/r.units,2),sc_cost_review_required=true where id=r.canonical_id;
  end loop;
  -- A slug-to-term match is source evidence, not a fuzzy color-name guess.
  -- Each alias must identify exactly one active WooCommerce global color term.
  for r in select a.id alias_id,min(c.id) canonical_id from public.colors a join public.colors c
    on lower(btrim(a.name))=lower(btrim(c.woo_term_slug))
    where a.woo_term_id is null and c.woo_term_id is not null and a.is_active and c.is_active and a.id<>c.id
    group by a.id having count(*)=1
  loop
    insert into public.sc_catalog_lookup_aliases(lookup_table,alias_id,canonical_id,original_row)
    select 'colors',r.alias_id,r.canonical_id,to_jsonb(c) from public.colors c where c.id=r.alias_id;
    update public.colors set is_active=false,sc_canonical_lookup_id=r.canonical_id,code='ARCHIVED-'||id::text where id=r.alias_id;
    update public.blank_products set color_id=r.canonical_id where color_id=r.alias_id;
    update public.products set color_id=r.canonical_id where color_id=r.alias_id;
    update public.sample_inventory_items set color_id=r.canonical_id where color_id=r.alias_id;
    update public.sc_color_pairing_rules set canonical_color_id=r.canonical_id where canonical_color_id=r.alias_id;
    v_aliases:=v_aliases+1;
  end loop;
  select user_id into v_actor from public.sc_app_user_roles where role='admin' and is_active order by user_id limit 1;
  for r in select brand_id,product_type_id,color_id,size_id,array_agg(id) ids,
      count(distinct unit_cost) cost_count,count(distinct nullif(barcode,'')) barcodes,
      count(distinct nullif(upc,'')) upcs,count(distinct case_pack_qty) packs,
      count(distinct nullif(supplier_sku,'')) supplier_skus
    from public.blank_products where not sc_is_archived
      and brand_id is not null and product_type_id is not null and color_id is not null and size_id is not null
    group by 1,2,3,4 having count(*)>1
  loop
    select bp.id into v_survivor from public.blank_products bp where bp.id=any(r.ids)
    order by (select count(*) from public.products p where p.blank_product_id=bp.id) desc,bp.id limit 1;
    insert into public.sc_product_review_cases(case_type,title,reason,candidate_group,proposed_survivor_id_text,created_by,evidence)
    values('duplicate_product','Matching physical identity: '||concat_ws('/',r.brand_id,r.product_type_id,r.color_id,r.size_id),
      'Full brand/style/color/size match. Conflicting costs or supplier details require review.',
      'identity:'||concat_ws('|',r.brand_id,r.product_type_id,r.color_id,r.size_id),v_survivor::text,v_actor,to_jsonb(r)) returning id into v_case;
    insert into public.sc_product_review_case_items(case_id,entity_type,entity_id_text,proposed_role,snapshot)
    select v_case,'blank_product',bp.id::text,case when bp.id=v_survivor then 'survivor' else 'duplicate' end,to_jsonb(bp)
    from public.blank_products bp where bp.id=any(r.ids);
    if greatest(r.cost_count,r.barcodes,r.upcs,r.packs,r.supplier_skus)>1 then
      update public.sc_product_review_cases set resolution_notes='Review the conflicting costs/supplier information before selecting a survivor.' where id=v_case;
      v_review:=v_review+1; continue;
    end if;
    begin
      v_preview:=public.sc_preview_product_resolution_v1(v_case,v_actor);
      perform public.sc_apply_product_resolution_v1((v_preview->>'resolution_id')::uuid,v_preview->>'confirmation_phrase',v_actor);
      v_resolved:=v_resolved+1;
    exception when unique_violation or foreign_key_violation then
      update public.sc_product_review_cases set resolution_notes='Reference collision requires review; no merge applied. '||sqlerrm where id=v_case;
      v_review:=v_review+1;
    end;
  end loop;
  select jsonb_object_agg(bin_id::text,n) into v_after_units from
    (select bin_id,sum(quantity_change) n from public.blank_inventory_movements group by bin_id)b;
  select coalesce(sum(m.quantity_change*coalesce(bp.unit_cost,0)),0) into v_actual_value
    from public.blank_inventory_movements m join public.blank_products bp on bp.id=m.blank_product_id;
  if v_before_units<>v_after_units or v_expected_value<>v_actual_value then
    raise exception 'Inventory quantities or estimated value changed; follow-up rolled back.';
  end if;
  update sc_maintenance.catalog_cleanup_result_20261016 set result=result || jsonb_build_object(
    'lookup_aliases_archived',(result->>'lookup_aliases_archived')::int+v_aliases,
    'duplicate_blank_groups_resolved',(result->>'duplicate_blank_groups_resolved')::int+v_resolved,
    'duplicate_groups_requiring_review',(result->>'duplicate_groups_requiring_review')::int+v_review,
    'cost_records_preserved',(select count(*) from sc_maintenance.catalog_cost_corrections_20261016),
    'estimated_inventory_value_before',v_expected_value,'estimated_inventory_value_after',v_actual_value,
    'exact_links_repaired',(select count(*) from sc_maintenance.catalog_rows_before_20261016 old
      join public.products p on p.id::text=old.row_key where old.table_name='products'
        and nullif(old.row_data->>'blank_product_id','') is null and p.blank_product_id is not null));
end
$cleanup$;
notify pgrst,'reload schema';
