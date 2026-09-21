-- Skilled Crafting Inventory App v1.4.16
-- SQL 64 - Verify Pull Sheet / Purchasing Integrity
-- Read-only.

select *
from (values
  (
    'integrity_rpc',
    to_regprocedure(
      'public.sc_pullsheet_purchasing_integrity_v1(bigint)'
    ) is not null,
    coalesce(
      to_regprocedure(
        'public.sc_pullsheet_purchasing_integrity_v1(bigint)'
      )::text,
      'missing'
    )
  ),
  (
    'fallback_rpc',
    to_regprocedure(
      'public.sc_missing_pullsheet_purchasing_demand_v1()'
    ) is not null,
    coalesce(
      to_regprocedure(
        'public.sc_missing_pullsheet_purchasing_demand_v1()'
      )::text,
      'missing'
    )
  ),
  (
    'repair_rpc',
    to_regprocedure(
      'public.sc_repair_pullsheet_purchasing_integrity_v1(bigint,uuid)'
    ) is not null,
    coalesce(
      to_regprocedure(
        'public.sc_repair_pullsheet_purchasing_integrity_v1(bigint,uuid)'
      )::text,
      'missing'
    )
  ),
  (
    'mapping_reconciliation',
    to_regprocedure(
      'public.sc_reconcile_product_mapping_to_open_pullsheet_v1()'
    ) is not null,
    coalesce(
      to_regprocedure(
        'public.sc_reconcile_product_mapping_to_open_pullsheet_v1()'
      )::text,
      'missing'
    )
  ),
  (
    'repair_log',
    to_regclass(
      'public.sc_pullsheet_purchasing_repair_log'
    ) is not null,
    coalesce(
      to_regclass(
        'public.sc_pullsheet_purchasing_repair_log'
      )::text,
      'missing'
    )
  )
) checks(check_name, passed, detail)
order by check_name;

select
  has_function_privilege(
    'authenticated',
    'public.sc_pullsheet_purchasing_integrity_v1(bigint)',
    'EXECUTE'
  ) as authenticated_can_audit,
  has_function_privilege(
    'authenticated',
    'public.sc_missing_pullsheet_purchasing_demand_v1()',
    'EXECUTE'
  ) as authenticated_can_read_fallback,
  has_function_privilege(
    'authenticated',
    'public.sc_repair_pullsheet_purchasing_integrity_v1(bigint,uuid)',
    'EXECUTE'
  ) is false as browser_repair_blocked,
  has_function_privilege(
    'service_role',
    'public.sc_repair_pullsheet_purchasing_integrity_v1(bigint,uuid)',
    'EXECUTE'
  ) as server_repair_ready;

select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'products'
  and trigger_name = 'trg_sc_reconcile_product_mapping_to_open_pullsheet_v1';

select
  issue_code,
  count(*) as line_count,
  coalesce(sum(expected_missing_quantity), 0) as expected_missing_units
from public.sc_pullsheet_purchasing_integrity_v1(null)
where issue_code <> 'ok'
group by issue_code
order by line_count desc, issue_code;

select *
from public.sc_missing_pullsheet_purchasing_demand_v1()
order by greatest(
  need_to_order,
  recommended_order_quantity
) desc,
sku_base
limit 50;

-- Specific reported case.
select *
from public.sc_pullsheet_purchasing_integrity_v1(272)
order by job_item_id;
