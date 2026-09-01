-- Skilled Crafting Inventory v1.4.6
-- Verification for SQL 56 Product Type Manager.

select 'brand/style mapping table' as check_name,
  case when to_regclass('public.sc_brand_style_item_types') is not null then 'PASS' else 'FAIL' end as result;

select 'item type catalog' as check_name,
  case when to_regclass('public.sc_blank_item_types') is not null then 'PASS' else 'FAIL' end as result;

select 'onsite v2 function' as check_name,
  case when to_regprocedure('public.sc_onsite_inventory_search_v2(text,integer)') is not null then 'PASS' else 'FAIL' end as result;

select 'mapped brand/style pairs' as metric, count(*)::bigint as value
from public.sc_brand_style_item_types;

select 'unclassified active brand/style pairs' as metric, count(*)::bigint as value
from (
  select distinct bp.brand_id,bp.product_type_id
  from public.blank_products bp
  left join public.sc_brand_style_item_types bst
    on bst.brand_id=bp.brand_id and bst.product_type_id=bp.product_type_id
  left join public.product_types pt on pt.id=bp.product_type_id
  where coalesce(bp.sc_is_archived,false)=false
    and bp.brand_id is not null and bp.product_type_id is not null
    and coalesce(bst.item_type_id,pt.sc_item_type_id) is null
) x;
