-- Read-only verification for New Product Line Setup v1.3.0

select *
from (values
  ('setup_table', to_regclass('public.sc_product_line_setups') is not null, coalesce(to_regclass('public.sc_product_line_setups')::text, 'missing')),
  ('preview_rpc', to_regprocedure('public.sc_preview_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean)') is not null, coalesce(to_regprocedure('public.sc_preview_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean)')::text, 'missing')),
  ('apply_rpc', to_regprocedure('public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid)') is not null, coalesce(to_regprocedure('public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid)')::text, 'missing')),
  ('setup_link_column', exists(select 1 from information_schema.columns where table_schema='public' and table_name='blank_products' and column_name='sc_product_line_setup_id'), 'blank_products.sc_product_line_setup_id'),
  ('cost_review_column', exists(select 1 from information_schema.columns where table_schema='public' and table_name='blank_products' and column_name='sc_cost_review_required'), 'blank_products.sc_cost_review_required')
) checks(check_name, passed, detail)
order by check_name;

select
  has_function_privilege('anon', 'public.sc_preview_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean)', 'EXECUTE') is false as anon_preview_blocked,
  has_function_privilege('authenticated', 'public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid)', 'EXECUTE') is false as browser_apply_blocked,
  has_function_privilege('service_role', 'public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid)', 'EXECUTE') as server_apply_ready;

select
  count(*) as product_line_setups,
  coalesce(sum(created_count), 0) as blank_definitions_created,
  coalesce(sum(reused_count), 0) as existing_blanks_reused,
  coalesce(sum(woo_products_linked), 0) as woo_product_rows_linked
from public.sc_product_line_setups;
