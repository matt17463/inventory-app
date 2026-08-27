-- Skilled Crafting Mockup Studio v1.1.0
-- Adds separate direct-retail and wholesale pricing paths.
-- Placement-rendering and WooCommerce-description changes are application-only.

begin;

alter table public.mockup_pricing_items
  add column if not exists pricing_path text;

alter table public.mockup_pricing_items
  add column if not exists wholesale_price numeric(12,4);

update public.mockup_pricing_items
set pricing_path = 'direct_retail'
where pricing_path is null
   or pricing_path not in ('direct_retail', 'wholesale');

-- Existing pricing rows were retail-only. Keep them in the direct-retail path
-- and reserve wholesale_price for explicitly created wholesale rows.
update public.mockup_pricing_items
set wholesale_price = null
where pricing_path = 'direct_retail';

alter table public.mockup_pricing_items
  alter column pricing_path set default 'direct_retail',
  alter column pricing_path set not null;

alter table public.mockup_pricing_items
  drop constraint if exists mockup_pricing_items_pricing_path_check;

alter table public.mockup_pricing_items
  add constraint mockup_pricing_items_pricing_path_check
  check (pricing_path in ('direct_retail', 'wholesale'));

alter table public.mockup_pricing_items
  drop constraint if exists mockup_pricing_items_wholesale_price_check;

alter table public.mockup_pricing_items
  add constraint mockup_pricing_items_wholesale_price_check
  check (
    (pricing_path = 'direct_retail' and wholesale_price is null)
    or (pricing_path = 'wholesale' and wholesale_price is not null and wholesale_price >= 0)
  );

comment on column public.mockup_pricing_items.pricing_path is
  'Pricing workflow: direct_retail or wholesale.';

comment on column public.mockup_pricing_items.wholesale_price is
  'Per-unit wholesale selling price; required only for wholesale pricing rows.';

notify pgrst, 'reload schema';

commit;
