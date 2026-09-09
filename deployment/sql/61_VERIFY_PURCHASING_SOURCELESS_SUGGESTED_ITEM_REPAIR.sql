-- Skilled Crafting Inventory App v1.4.8
-- READ-ONLY verification for 60_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql

with checks(check_name, passed, detail) as (
  values
    (
      'replacement_rules_table',
      to_regclass('public.sc_purchasing_blank_replacement_rules') is not null,
      coalesce(to_regclass('public.sc_purchasing_blank_replacement_rules')::text, 'missing')
    ),
    (
      'row_repair_audit_table',
      to_regclass('public.sc_purchasing_row_repair_log') is not null,
      coalesce(to_regclass('public.sc_purchasing_row_repair_log')::text, 'missing')
    ),
    (
      'suggested_item_preview_rpc',
      to_regprocedure('public.sc_purchasing_suggested_item_preview_v1(uuid)') is not null,
      coalesce(to_regprocedure('public.sc_purchasing_suggested_item_preview_v1(uuid)')::text, 'missing')
    ),
    (
      'suggested_item_fix_rpc',
      to_regprocedure('public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)') is not null,
      coalesce(to_regprocedure('public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)')::text, 'missing')
    ),
    (
      'v147_line_pairing_rpc_still_present',
      to_regprocedure('public.sc_purchasing_fix_pairing_v1(bigint,uuid,text,boolean)') is not null,
      coalesce(to_regprocedure('public.sc_purchasing_fix_pairing_v1(bigint,uuid,text,boolean)')::text, 'missing')
    ),
    (
      'replacement_rule_one_active_source_index',
      to_regclass('public.sc_purchasing_blank_replacement_rules_one_active_source_idx') is not null,
      coalesce(to_regclass('public.sc_purchasing_blank_replacement_rules_one_active_source_idx')::text, 'missing')
    ),
    (
      'fix_rpc_does_not_mutate_inventory_movements',
      position(
        'insert into public.inventory_movements'
        in lower(pg_get_functiondef(to_regprocedure('public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)')))
      ) = 0
      and position(
        'update public.inventory_movements'
        in lower(pg_get_functiondef(to_regprocedure('public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)')))
      ) = 0
      and position(
        'delete from public.inventory_movements'
        in lower(pg_get_functiondef(to_regprocedure('public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)')))
      ) = 0,
      'function does not insert/update/delete inventory_movements'
    ),
    (
      'fix_rpc_does_not_cast_blank_uuid_to_bigint',
      position(
        'p_new_blank_product_id::bigint'
        in lower(pg_get_functiondef(to_regprocedure('public.sc_purchasing_fix_suggested_item_v1(uuid,uuid,text,boolean,boolean,boolean)')))
      ) = 0,
      'replacement blank remains UUID-safe'
    )
)
select
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from checks
order by check_name;

-- Optional read-only sample of saved Purchasing replacement preferences.
select
  rule.id,
  rule.source_blank_product_id,
  source.sku_base as source_sku,
  rule.replacement_blank_product_id,
  replacement.sku_base as replacement_sku,
  rule.active,
  rule.reason,
  rule.created_at
from public.sc_purchasing_blank_replacement_rules rule
join public.blank_products source on source.id = rule.source_blank_product_id
join public.blank_products replacement on replacement.id = rule.replacement_blank_product_id
order by rule.id desc
limit 10;

-- Optional read-only audit sample. Zero rows is valid until the first repair.
select
  id,
  source_blank_product_id,
  replacement_blank_product_id,
  unlinked_reservations_moved,
  unlinked_reserved_quantity_moved,
  threshold_moved,
  replacement_rule_id,
  reason,
  created_at
from public.sc_purchasing_row_repair_log
order by id desc
limit 10;
