-- STEP 1 LIMITED ROLLBACK
-- This removes only the new registry/health metadata created by migration 202607250001.
-- It intentionally does not drop or alter sample tables, views, inventory tables, orders, or legacy tables.

begin;

drop function if exists public.sc_inventory_model_health_v1();
drop table if exists public.sc_inventory_model_registry;

commit;
