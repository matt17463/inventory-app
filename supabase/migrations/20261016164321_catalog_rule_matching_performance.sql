-- Evaluate the approved rule set once for the whole catalog. Calling the
-- compatibility RPC separately for every candidate caused slow bulk checks.
create function public.sc_non_inventory_catalog_ids_v1() returns table(product_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.sc_require_internal_access(array['admin','manager','operator','viewer']);
  return query select p.id from public.products p where exists(
    select 1 from public.non_inventory_product_rules r where r.is_active and
      case lower(r.rule_type)
        when 'exact_sku' then lower(btrim(coalesce(p.sku,'')))=lower(btrim(r.match_value))
        when 'sku_contains' then lower(coalesce(p.sku,'')) like '%'||lower(r.match_value)||'%'
        when 'sku_prefix' then lower(coalesce(p.sku,'')) like lower(r.match_value)||'%'
        when 'sku_regex' then coalesce(p.sku,'') ~* r.match_value
        when 'woo_product_id' then case when r.match_value ~ '^[0-9]+$' then p.woocommerce_product_id=r.match_value::bigint else false end
        when 'woo_variation_id' then case when r.match_value ~ '^[0-9]+$' then p.woocommerce_variation_id=r.match_value::bigint else false end
        when 'product_name_contains' then lower(coalesce(p.name,'')) like '%'||lower(r.match_value)||'%'
        else false end
  );
end;
$$;
revoke all on function public.sc_non_inventory_catalog_ids_v1() from public,anon;
grant execute on function public.sc_non_inventory_catalog_ids_v1() to authenticated,service_role;

-- Account for links filled by the existing lookup-update triggers as well as
-- the subsequent explicit repair batches.
update sc_maintenance.catalog_cleanup_result_20261016 set result=result || jsonb_build_object(
  'exact_links_repaired',(select count(*) from sc_maintenance.catalog_rows_before_20261016 old
    join public.products p on p.id::text=old.row_key where old.table_name='products'
      and nullif(old.row_data->>'blank_product_id','') is null and p.blank_product_id is not null));

create or replace function public.sc_repair_exact_catalog_links_v1(p_limit integer default 50) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer; v_before numeric; v_after numeric;
begin
  perform public.sc_require_internal_access(array['admin','manager']);
  perform pg_advisory_xact_lock(hashtextextended('exact-catalog-link-repair',0));
  select coalesce(sum(quantity_change),0) into v_before from public.blank_inventory_movements;
  with non_inventory as materialized (select * from public.sc_non_inventory_catalog_ids_v1()), unique_blanks as materialized (
    select brand_id,product_type_id,color_id,size_id,min(id::text)::uuid blank_id
    from public.blank_products where not coalesce(sc_is_archived,false)
      and brand_id is not null and product_type_id is not null and color_id is not null and size_id is not null
    group by 1,2,3,4 having count(*)=1
  ), candidates as materialized (
    select p.id,b.blank_id from public.products p join unique_blanks b
      on p.brand_id=b.brand_id and p.product_type_id=b.product_type_id and p.color_id=b.color_id and p.size_id=b.size_id
    where p.blank_product_id is null and coalesce(p.woo_link_status,'') not like 'excluded%'
      and not exists(select 1 from non_inventory n where n.product_id=p.id)
    order by p.id limit least(greatest(coalesce(p_limit,50),1),100) for update of p skip locked
  ) update public.products p set blank_product_id=c.blank_id,woo_link_status='linked_exact_catalog_cleanup',woo_linked_at=now()
  from candidates c where p.id=c.id and p.blank_product_id is null;
  get diagnostics v_count=row_count;
  select coalesce(sum(quantity_change),0) into v_after from public.blank_inventory_movements;
  if v_before<>v_after then raise exception 'A link repair changed physical stock; rolled back.'; end if;
  update sc_maintenance.catalog_cleanup_result_20261016 set result=result || jsonb_build_object(
    'exact_links_repaired',coalesce((result->>'exact_links_repaired')::integer,0)+v_count,'last_link_repair_at',now());
  return v_count;
end;
$$;
revoke all on function public.sc_repair_exact_catalog_links_v1(integer) from public,anon;
grant execute on function public.sc_repair_exact_catalog_links_v1(integer) to authenticated,service_role;

create or replace view public.sc_product_data_health_issues_v2 with(security_invoker=true) as
with non_inventory as materialized (select * from public.sc_non_inventory_catalog_ids_v1()), physical as (
  select bp.id::text product_id,bp.sku_base sku,bp.name product_name,
    b.name brand_name,pt.name style_name,c.name color_name,s.name size_name,
    bp.brand_id,bp.product_type_id,bp.color_id,bp.size_id,bp.unit_cost,
    coalesce(nullif(btrim(bp.barcode),''),nullif(btrim(bp.upc),'')) barcode
  from public.blank_products bp left join public.brands b on b.id=bp.brand_id
    left join public.product_types pt on pt.id=bp.product_type_id
    left join public.colors c on c.id=bp.color_id left join public.sizes s on s.id=bp.size_id
  where not coalesce(bp.sc_is_archived,false)
), storefront as (
  select p.id::text product_id,p.sku,p.name product_name,b.name brand_name,pt.name style_name,
    c.name color_name,s.name size_name,p.brand_id,p.product_type_id,p.color_id,p.size_id,p.blank_product_id
  from public.products p left join public.brands b on b.id=p.brand_id
    left join public.product_types pt on pt.id=p.product_type_id left join public.colors c on c.id=p.color_id
    left join public.sizes s on s.id=p.size_id
  where p.blank_product_id is null and coalesce(p.woo_link_status,'') not like 'excluded%'
    and (p.woocommerce_variation_id is not null or p.woo_row_type='simple')
    and coalesce(p.woocommerce_status,'publish') not in ('trash','draft','private','pending')
    and not exists(select 1 from non_inventory n where n.product_id=p.id)
)
select i.issue_type,'blank_products'::text product_table,p.product_id,p.sku,p.product_name,
  p.brand_name,p.style_name,p.color_name,p.size_name,i.detail,i.severity
from physical p cross join lateral (values
  ('missing_sku',nullif(btrim(p.sku),'') is null,'Blank item is missing its SKU.','warning'),
  ('missing_barcode',p.barcode is null,'Optional scanning information: this blank has no barcode or UPC.','info'),
  ('missing_unit_cost',coalesce(p.unit_cost,0)<=0,'Blank item has no positive unit cost; review costing before valuing stock.','warning'),
  ('missing_brand',p.brand_id is null,'Blank item is missing its brand.','warning'),
  ('missing_style',p.product_type_id is null,'Blank item is missing its style.','warning'),
  ('missing_color',p.color_id is null,'Blank item is missing its color.','warning'),
  ('missing_size',p.size_id is null,'Blank item is missing its size.','warning')
) i(issue_type,applies,detail,severity) where i.applies
union all
select i.issue_type,'products',p.product_id,p.sku,p.product_name,p.brand_name,p.style_name,p.color_name,p.size_name,i.detail,'warning'
from storefront p cross join lateral (values
  ('missing_blank_link',true,'Inventory-requiring WooCommerce item needs an approved blank mapping.'),
  ('missing_sku',nullif(btrim(p.sku),'') is null,'WooCommerce item is missing the SKU required by order import.'),
  ('missing_brand',p.brand_id is null,'WooCommerce item is missing its brand mapping.'),
  ('missing_style',p.product_type_id is null,'WooCommerce item is missing its style mapping.'),
  ('missing_color',p.color_id is null,'WooCommerce item is missing its color mapping.'),
  ('missing_size',p.size_id is null,'WooCommerce item is missing its size mapping.')
) i(issue_type,applies,detail) where i.applies;
revoke all on public.sc_product_data_health_issues_v2 from public,anon;
grant select on public.sc_product_data_health_issues_v2 to authenticated,service_role;

notify pgrst,'reload schema';
