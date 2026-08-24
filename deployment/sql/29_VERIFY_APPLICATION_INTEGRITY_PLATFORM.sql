-- Skilled Crafting Inventory v1.0.0
-- READ-ONLY post-install verification. Safe to run repeatedly.

select 'version' as check_name, '1.0.0' as result;

select object_name, installed
from (values
  ('sc_product_identity_aliases', to_regclass('public.sc_product_identity_aliases') is not null),
  ('sc_product_review_cases', to_regclass('public.sc_product_review_cases') is not null),
  ('sc_product_change_previews', to_regclass('public.sc_product_change_previews') is not null),
  ('sc_integration_jobs', to_regclass('public.sc_integration_jobs') is not null),
  ('sc_team_store_workflows', to_regclass('public.sc_team_store_workflows') is not null),
  ('sc_core_mutation_audit', to_regclass('public.sc_core_mutation_audit') is not null),
  ('candidate resolver', to_regprocedure('public.sc_blank_product_candidates_v1(text,text,text,text,text,text,text,text,integer)') is not null),
  ('creation preview', to_regprocedure('public.sc_preview_blank_product_v1(jsonb)') is not null),
  ('guarded blank creation', to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is not null),
  ('guarded blank update', to_regprocedure('public.sc_update_blank_product_safe_v1(bigint,jsonb,uuid)') is not null),
  ('guarded job status', to_regprocedure('public.sc_set_job_status_safe_v1(bigint,text,uuid,text)') is not null),
  ('guarded line status', to_regprocedure('public.sc_set_job_item_status_safe_v1(bigint,text,uuid,text)') is not null)
) as checks(object_name, installed)
order by object_name;

-- Every employee who uses the application must appear here as active.
select user_id, role, is_active
from public.sc_app_user_roles
order by role, user_id;

-- Expected: public/anon/authenticated have no direct privileges on the new
-- mutation tables. service_role privileges are expected.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'sc_product_identity_aliases','sc_product_review_cases','sc_product_review_case_items',
    'sc_product_change_previews','sc_integration_jobs','sc_integration_job_events',
    'sc_team_store_workflows','sc_core_mutation_audit'
  )
order by table_name, grantee, privilege_type;

select public.sc_preview_blank_product_v1(jsonb_build_object(
  'sku_base', '__SC_V1_VERIFICATION_DO_NOT_CREATE__',
  'name', 'Read-only verification'
)) as read_only_creation_preview;
