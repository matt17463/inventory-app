-- Read-only verification for Mockup Studio automatic blank creation.

select * from (values
  ('guarded blank creation', to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is not null),
  ('bulk variation mapping', to_regprocedure('public.sc_set_product_blank_mappings_bulk_v1(jsonb,text,text,boolean,uuid)') is not null),
  ('new product line foundation', to_regprocedure('public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid)') is not null),
  ('mockup blank audit', to_regclass('public.sc_mockup_blank_catalog_events') is not null)
) checks(requirement, ready)
order by requirement;

select
  count(*) filter (where coalesce(sc_is_archived, false) = false) as active_blank_products,
  count(*) filter (where sc_creation_source = 'mockup_studio_woocommerce_export') as mockup_created_blanks,
  count(*) filter (where sc_cost_review_required) as blanks_requiring_cost_review
from public.blank_products;
