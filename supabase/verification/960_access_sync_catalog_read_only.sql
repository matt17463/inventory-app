-- Read-only follow-up checks. Run as a database administrator.
select c.oid::regclass as anonymously_readable_relation
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m')
  and has_table_privilege('anon',c.oid,'select'); -- expected: no rows

select p.oid::regprocedure as anonymous_rpc
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and has_function_privilege('anon',p.oid,'execute');
-- Expected: sc_customer_portal_data_v2(text), phase6_customer_portal_data(text).

select p.oid::regprocedure as mutable_search_path
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','sc_internal') and p.prokind='f'
and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%');
-- Expected: no rows.

select public.sc_catalog_cleanup_summary_v1();
select sum(m.quantity_change) physical_units,count(*) movement_rows,
  sum(m.quantity_change*coalesce(bp.unit_cost,0)) estimated_value
from public.blank_inventory_movements m
join public.blank_products bp on bp.id=m.blank_product_id;
-- Cleanup baseline: 1447 / 2284 / 10807.36. Later genuine operations can change these.

select m.bin_id,sum(m.quantity_change) physical_units
from public.blank_inventory_movements m group by m.bin_id order by m.bin_id;
select * from public.sc_product_integrity_summary_v1();
select public.sc_product_data_health_page_v2('missing_blank_link',0,1);
select public.sc_woocommerce_sync_health_v1();

select count(*) reactivated_color_aliases
from public.sc_catalog_lookup_aliases a join public.colors c on c.id=a.alias_id
where a.lookup_table='colors' and c.is_active; -- expected: 0

select b.id,b.name,b.code,b.woo_term_id from public.brands b
where b.name in ('Port&Co','Port&amp;Co'); -- one existing ID/code, synced Woo term
