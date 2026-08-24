-- Skilled Crafting Inventory v1.0.2
-- READ-ONLY verification for guarded duplicate-product case resolution.

select object_name, installed
from (values
  ('blank product archive flag', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'blank_products'
      and column_name = 'sc_is_archived'
  )),
  ('UUID canonical product link', exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'blank_products'
      and column_name = 'sc_canonical_blank_product_id'
      and data_type = 'uuid'
  )),
  ('UUID guarded blank update', to_regprocedure('public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)') is not null),
  ('legacy bigint guarded update removed', to_regprocedure('public.sc_update_blank_product_safe_v1(bigint,jsonb,uuid)') is null),
  ('resolution runs', to_regclass('public.sc_product_resolution_runs') is not null),
  ('reference discovery', to_regprocedure('public.sc_blank_product_reference_targets_v1()') is not null),
  ('resolution evidence', to_regprocedure('public.sc_product_resolution_evidence_v1(uuid)') is not null),
  ('resolution preview', to_regprocedure('public.sc_preview_product_resolution_v1(uuid,uuid)') is not null),
  ('resolution apply', to_regprocedure('public.sc_apply_product_resolution_v1(uuid,text,uuid)') is not null),
  ('case status update', to_regprocedure('public.sc_update_product_review_case_status_v1(uuid,text,text,uuid)') is not null)
) checks(object_name, installed)
order by object_name;

-- Expected: service_role only for the resolution table.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'sc_product_resolution_runs'
order by grantee, privilege_type;

-- Expected: all current targets that would be repointed during a resolution.
select *
from public.sc_blank_product_reference_targets_v1()
order by target_schema, target_table, target_column;

-- Expected: zero. A completed resolution must never leave an active product
-- pointing to an archived canonical product.
select count(*) as invalid_archive_links
from public.blank_products archived_product
left join public.blank_products survivor
  on survivor.id = archived_product.sc_canonical_blank_product_id
where archived_product.sc_is_archived is true
  and (survivor.id is null or survivor.sc_is_archived is true);

-- Read-only recent resolution history.
select id, case_id, status, survivor_id_text, duplicate_ids_text,
       created_at, expires_at, applied_at
from public.sc_product_resolution_runs
order by created_at desc
limit 25;
