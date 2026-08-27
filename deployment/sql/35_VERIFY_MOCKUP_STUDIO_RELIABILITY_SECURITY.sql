-- Read-only verification for v1.0.9 Mockup Studio reliability/security.
select 'active_employee_function' as check_name, (to_regprocedure('public.sc_mockup_active_employee()') is not null)::text as result
union all select 'internal_review_function', (to_regprocedure('public.sc_mockup_internal_review(uuid,text,boolean)') is not null)::text
union all select 'customer_review_function', (to_regprocedure('public.sc_mockup_apply_customer_review(uuid,uuid,uuid,text,text,text,text,jsonb)') is not null)::text
union all select 'production_ready_function', (to_regprocedure('public.sc_mockup_mark_production_ready(uuid,jsonb)') is not null)::text
union all select 'cleanup_queue', (to_regclass('public.mockup_storage_cleanup_queue') is not null)::text
union all select 'legacy_open_policy_count', count(*)::text
from pg_policies where schemaname = 'public' and policyname = 'sc_mockup_authenticated_all'
union all select 'active_employee_policy_count', count(*)::text
from pg_policies where schemaname = 'public' and policyname = 'sc_mockup_active_employees';
