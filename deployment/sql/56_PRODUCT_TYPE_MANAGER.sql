-- Skilled Crafting Inventory v1.4.6
-- Product Type Manager: brand + style item-type assignments used by On-site Sales.
-- Additive and safe to rerun. Does not change inventory quantities.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create table if not exists public.sc_brand_style_item_types (
  brand_id bigint not null references public.brands(id) on delete cascade,
  product_type_id bigint not null references public.product_types(id) on delete cascade,
  item_type_id bigint not null references public.sc_blank_item_types(id) on delete restrict,
  actor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, product_type_id)
);

create index if not exists ix_sc_brand_style_item_types_item_type
  on public.sc_brand_style_item_types(item_type_id, brand_id, product_type_id);

-- Preserve every classification created by Mockup Studio / SQL 52 as a
-- brand-specific mapping. This keeps current Gildan/etc. classifications intact
-- while allowing the same style label to be classified differently by brand.
insert into public.sc_brand_style_item_types(brand_id, product_type_id, item_type_id)
select distinct bp.brand_id, bp.product_type_id, pt.sc_item_type_id
from public.blank_products bp
join public.product_types pt on pt.id = bp.product_type_id
where bp.brand_id is not null
  and bp.product_type_id is not null
  and pt.sc_item_type_id is not null
on conflict (brand_id, product_type_id) do nothing;

-- v2 remains the On-site Sales read contract. Brand+style assignments are now
-- authoritative, with the old style-level value retained as a compatibility fallback.
drop function if exists public.sc_onsite_inventory_search_v2(text,integer);
create function public.sc_onsite_inventory_search_v2(
  p_search text default '',
  p_limit integer default 5000
)
returns table(
  blank_product_id uuid,
  sku_base text,
  blank_name text,
  item_type_id bigint,
  item_type text,
  brand_id bigint,
  brand text,
  style_id bigint,
  style text,
  color_id bigint,
  color text,
  size_id bigint,
  size text,
  on_hand_quantity numeric,
  reserved_quantity numeric,
  available_quantity numeric
)
language sql stable security definer set search_path=public
as $fn$
  with movement as (
    select m.blank_product_id, sum(m.quantity_change)::numeric on_hand
    from public.blank_inventory_movements m
    group by m.blank_product_id
  ), reserved as (
    select r.blank_product_id,
      sum(greatest(coalesce(r.quantity_reserved,r.quantity,0),0))::numeric reserved
    from public.inventory_reservations r
    where coalesce(lower(r.status::text),'active') not in ('released','cancelled','canceled','void','completed')
    group by r.blank_product_id
  )
  select
    bp.id,
    bp.sku_base::text,
    bp.name::text,
    it.id,
    coalesce(it.name,'Unclassified')::text,
    b.id,
    b.name::text,
    pt.id,
    pt.name::text,
    c.id,
    c.name::text,
    s.id,
    s.name::text,
    coalesce(m.on_hand,0),
    coalesce(r.reserved,0),
    greatest(coalesce(m.on_hand,0)-coalesce(r.reserved,0),0)
  from public.blank_products bp
  left join public.brands b on b.id=bp.brand_id
  left join public.product_types pt on pt.id=bp.product_type_id
  left join public.sc_brand_style_item_types bst
    on bst.brand_id=bp.brand_id and bst.product_type_id=bp.product_type_id
  left join public.sc_blank_item_types it
    on it.id=coalesce(bst.item_type_id,pt.sc_item_type_id) and it.is_active
  left join public.colors c on c.id=bp.color_id
  left join public.sizes s on s.id=bp.size_id
  left join movement m on m.blank_product_id=bp.id
  left join reserved r on r.blank_product_id=bp.id
  where coalesce(bp.sc_is_archived,false)=false
    and coalesce(m.on_hand,0)-coalesce(r.reserved,0)>0
    and (
      coalesce(trim(p_search),'')='' or
      concat_ws(' ',bp.sku_base,bp.name,it.name,b.name,pt.name,c.name,s.name) ilike '%'||trim(p_search)||'%'
    )
  order by coalesce(it.sort_order,999),coalesce(it.name,'Unclassified'),b.name,pt.name,c.name,s.name
  limit least(greatest(coalesce(p_limit,5000),1),10000)
$fn$;

grant select on public.sc_brand_style_item_types to authenticated,service_role;
grant execute on function public.sc_onsite_inventory_search_v2(text,integer) to authenticated,service_role;

commit;
