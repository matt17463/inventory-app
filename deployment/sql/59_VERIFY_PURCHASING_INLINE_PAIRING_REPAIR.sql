-- Skilled Crafting Inventory App v1.4.7
-- READ-ONLY verification for 58_PURCHASING_INLINE_PAIRING_REPAIR.sql

with checks(check_name, passed, detail) as (
  values
    (
      'purchasing_demand_sources_view',
      to_regclass('public.purchasing_demand_sources_v1') is not null,
      coalesce(to_regclass('public.purchasing_demand_sources_v1')::text, 'missing')
    ),
    (
      'purchasing_fix_pairing_rpc',
      to_regprocedure('public.sc_purchasing_fix_pairing_v1(bigint,uuid,text,boolean)') is not null,
      coalesce(to_regprocedure('public.sc_purchasing_fix_pairing_v1(bigint,uuid,text,boolean)')::text, 'missing')
    ),
    (
      'pullsheet_override_rpc',
      to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text)') is not null
        or to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text,text)') is not null,
      coalesce(
        to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text)')::text,
        to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text,text)')::text,
        'missing'
      )
    ),
    (
      'mapping_lifecycle_rpc',
      to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)') is not null,
      coalesce(to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)')::text, 'missing')
    ),
    (
      'source_view_has_job_item_id',
      position('job_item_id' in lower(pg_get_viewdef('public.purchasing_demand_sources_v1'::regclass, true))) > 0,
      'job_item_id included in demand source JSON'
    ),
    (
      'source_view_has_variation_id',
      position('woocommerce_variation_id' in lower(pg_get_viewdef('public.purchasing_demand_sources_v1'::regclass, true))) > 0,
      'woocommerce_variation_id included in demand source JSON'
    ),
    (
      'source_view_has_current_blank',
      position('current_blank_product_id' in lower(pg_get_viewdef('public.purchasing_demand_sources_v1'::regclass, true))) > 0,
      'current_blank_product_id included in demand source JSON'
    )
)
select
  check_name,
  case when passed then 'PASS' else 'FAIL' end as status,
  detail
from checks
order by check_name;

-- Optional read-only sample. Zero rows is valid if there is currently no open
-- purchasing demand tied to pull-sheet lines.
select
  blank_product_id,
  demand_source_count,
  demand_total_quantity,
  demand_sources
from public.purchasing_demand_sources_v1
order by demand_total_quantity desc nulls last
limit 5;
