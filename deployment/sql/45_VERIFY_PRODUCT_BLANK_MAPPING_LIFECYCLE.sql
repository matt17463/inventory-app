-- Read-only verification for 44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql
-- Expected: every row reports PASS. This file does not mutate business data.

with checks(check_name, passed, detail) as (
  values
    ('mapping_table', to_regclass('public.sc_product_blank_mappings') is not null, coalesce(to_regclass('public.sc_product_blank_mappings')::text, 'missing')),
    ('mapping_events', to_regclass('public.sc_product_blank_mapping_events') is not null, coalesce(to_regclass('public.sc_product_blank_mapping_events')::text, 'missing')),
    ('single_mapping_rpc', to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)') is not null, coalesce(to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)')::text, 'missing')),
    ('bulk_mapping_rpc', to_regprocedure('public.sc_set_product_blank_mappings_bulk_v1(jsonb,text,text,boolean,uuid)') is not null, coalesce(to_regprocedure('public.sc_set_product_blank_mappings_bulk_v1(jsonb,text,text,boolean,uuid)')::text, 'missing')),
    ('matrix_resolver', to_regprocedure('public.sc_resolve_blank_matrix_v1(text,text,text[],text[])') is not null, coalesce(to_regprocedure('public.sc_resolve_blank_matrix_v1(text,text,text[],text[])')::text, 'missing')),
    ('issues_rpc', to_regprocedure('public.sc_product_blank_mapping_issues_v1(text,integer)') is not null, coalesce(to_regprocedure('public.sc_product_blank_mapping_issues_v1(text,integer)')::text, 'missing')),
    ('substitution_preview', to_regprocedure('public.sc_preview_blank_substitution_v1(uuid,uuid)') is not null, coalesce(to_regprocedure('public.sc_preview_blank_substitution_v1(uuid,uuid)')::text, 'missing')),
    ('substitution_apply', to_regprocedure('public.sc_apply_blank_substitution_v1(uuid,uuid,text,uuid)') is not null, coalesce(to_regprocedure('public.sc_apply_blank_substitution_v1(uuid,uuid,text,uuid)')::text, 'missing')),
    ('product_pair_trigger', exists(select 1 from pg_trigger where tgname = 'sc_products_assign_deterministic_blank_v1' and not tgisinternal), 'products deterministic pairing trigger'),
    ('product_remember_trigger', exists(select 1 from pg_trigger where tgname = 'sc_products_remember_blank_mapping_v1' and not tgisinternal), 'products mapping memory trigger')
)
select check_name, case when passed then 'PASS' else 'FAIL' end status, detail
from checks
order by check_name;

-- Read-only operational summary.
select
  count(*) filter (where is_active) as active_mapping_count,
  count(*) filter (where not is_active) as historical_mapping_count,
  count(distinct blank_product_id) filter (where is_active) as mapped_blank_count
from public.sc_product_blank_mappings;

-- Safe preview of the existing review queue. No mappings are changed.
select *
from public.sc_product_blank_mapping_issues_v1('', 25);
