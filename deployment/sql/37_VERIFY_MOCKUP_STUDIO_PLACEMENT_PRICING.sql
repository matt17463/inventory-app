-- Read-only verification for 36_MOCKUP_STUDIO_PLACEMENT_PRICING.sql

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mockup_pricing_items'
      and column_name = 'pricing_path'
      and is_nullable = 'NO'
      and column_default like '%direct_retail%'
  ) as pricing_path_ready,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mockup_pricing_items'
      and column_name = 'wholesale_price'
  ) as wholesale_price_ready,
  not exists (
    select 1
    from public.mockup_pricing_items
    where pricing_path not in ('direct_retail', 'wholesale')
       or pricing_path is null
       or (pricing_path = 'direct_retail' and wholesale_price is not null)
       or (pricing_path = 'wholesale' and wholesale_price is null)
  ) as existing_rows_valid;

select
  pricing_path,
  count(*) as pricing_item_count
from public.mockup_pricing_items
group by pricing_path
order by pricing_path;
