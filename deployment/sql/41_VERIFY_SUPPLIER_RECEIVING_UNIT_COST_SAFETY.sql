-- Skilled Crafting Inventory v1.1.3
-- Read-only verification for migration 40.

with unit_cost_column as (
  select
    is_nullable,
    column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'blank_products'
    and column_name = 'unit_cost'
), function_checks as (
  select
    to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') as create_function,
    to_regprocedure('public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)') as update_function
)
select
  unit_cost_column.is_nullable = 'NO' as unit_cost_is_not_null,
  coalesce(unit_cost_column.column_default, '') ~ '0' as unit_cost_has_zero_default,
  function_checks.create_function is not null as guarded_create_ready,
  function_checks.update_function is not null as guarded_update_ready,
  case
    when function_checks.create_function is null then false
    else pg_get_functiondef(function_checks.create_function) like '%v_unit_cost numeric := 0%'
  end as guarded_create_defaults_missing_cost,
  case
    when function_checks.update_function is null then false
    else pg_get_functiondef(function_checks.update_function) like '%v_unit_cost := v_before.unit_cost%'
  end as guarded_update_preserves_existing_cost,
  not exists (
    select 1 from public.blank_products where unit_cost is null
  ) as no_null_product_costs
from unit_cost_column
cross join function_checks;
