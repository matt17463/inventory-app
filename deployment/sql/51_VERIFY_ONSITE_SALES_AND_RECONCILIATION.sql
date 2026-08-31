select to_regclass('public.sc_onsite_production_orders') onsite_orders,
       to_regclass('public.sc_purchasing_authoritative_inventory_v3') purchasing_inventory;
select routine_name from information_schema.routines where routine_schema='public' and routine_name in
('sc_onsite_inventory_search_v1','sc_complete_onsite_sale_v1','sc_catalog_reconciliation_v2','sc_save_color_drag_mappings_v1') order by routine_name;
select * from public.sc_onsite_inventory_search_v1('',5);
select * from public.sc_catalog_reconciliation_v2('',20);
