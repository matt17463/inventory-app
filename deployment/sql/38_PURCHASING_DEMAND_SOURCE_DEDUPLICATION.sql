-- Skilled Crafting Inventory v1.1.2
-- Purchasing demand-source compatibility and Pending Stock deduplication.
-- Additive, non-destructive, and safe to rerun.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $guard$
begin
  if to_regclass('public.purchasing_demand_sources_v1') is null then
    raise exception
      'Required view public.purchasing_demand_sources_v1 is missing.';
  end if;

  if to_regclass('public.inventory_reservations') is null then
    raise exception
      'Required table public.inventory_reservations is missing.';
  end if;
end
$guard$;

create or replace view public.sc_purchasing_demand_sources_v2
with (security_invoker = true)
as
select
  source_row.blank_product_id,
  greatest(
    coalesce(source_row.demand_source_count, 0),
    jsonb_array_length(coalesce(repaired.repaired_sources, '[]'::jsonb))
  )::bigint as demand_source_count,
  greatest(
    coalesce(source_row.demand_total_quantity, 0),
    coalesce(repaired.repaired_total_quantity, 0)
  )::numeric as demand_total_quantity,
  coalesce(source_row.demand_order_numbers, '')::text
    as demand_order_numbers,
  coalesce(source_row.demand_pullsheet_numbers, '')::text
    as demand_pullsheet_numbers,
  coalesce(repaired.repaired_sources, '[]'::jsonb)
    as demand_sources
from public.purchasing_demand_sources_v1 source_row
left join lateral (
  select
    jsonb_agg(
      source_item || jsonb_build_object(
        'quantity', greatest(
          coalesce(reservation.quantity_reserved, 0),
          coalesce(reservation.quantity, 0),
          case
            when coalesce(source_item->>'quantity', '') ~ '^[-+]?[0-9]+([.][0-9]+)?$'
              then (source_item->>'quantity')::numeric
            else 0
          end
        ),
        'quantity_reserved', greatest(
          coalesce(reservation.quantity_reserved, 0),
          coalesce(reservation.quantity, 0),
          case
            when coalesce(source_item->>'quantity', '') ~ '^[-+]?[0-9]+([.][0-9]+)?$'
              then (source_item->>'quantity')::numeric
            else 0
          end
        )
      )
      order by
        coalesce(source_item->>'job_id', ''),
        coalesce(source_item->>'job_item_id', ''),
        coalesce(source_item->>'reservation_id', '')
    ) as repaired_sources,
    sum(
      greatest(
        coalesce(reservation.quantity_reserved, 0),
        coalesce(reservation.quantity, 0),
        case
          when coalesce(source_item->>'quantity', '') ~ '^[-+]?[0-9]+([.][0-9]+)?$'
            then (source_item->>'quantity')::numeric
          else 0
        end
      )
    )::numeric as repaired_total_quantity
  from jsonb_array_elements(
    coalesce(source_row.demand_sources::jsonb, '[]'::jsonb)
  ) source_item
  left join public.inventory_reservations reservation
    on reservation.id::text = source_item->>'reservation_id'
) repaired on true;

grant select on public.sc_purchasing_demand_sources_v2
  to authenticated, service_role;

comment on view public.sc_purchasing_demand_sources_v2 is
  'Canonical purchasing demand sources with reservation quantities and job_item_id values used to prevent Pending Stock from being counted twice.';

commit;
