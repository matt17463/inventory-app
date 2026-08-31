-- Skilled Crafting Inventory v1.4.2 verification -- READ ONLY
select to_regclass('public.sc_blank_item_types') item_type_table;

select column_name,data_type,udt_name
from information_schema.columns
where table_schema='public' and table_name='product_types' and column_name='sc_item_type_id';

select name,code,sort_order,is_active
from public.sc_blank_item_types
order by sort_order,name;

select * from public.sc_onsite_inventory_search_v2('',10);

-- Styles with AVAILABLE stock that still need classification.
with available as (
  select blank_product_id
  from public.sc_onsite_inventory_search_v2('',10000)
)
select pt.id,pt.name,pt.code,count(distinct bp.id) available_blank_variants
from public.product_types pt
join public.blank_products bp on bp.product_type_id=pt.id
join available a on a.blank_product_id=bp.id
where pt.sc_item_type_id is null
  and coalesce(bp.sc_is_archived,false)=false
group by pt.id,pt.name,pt.code
order by pt.name;
