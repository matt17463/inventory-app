-- Steps 3-5 post-install verification. READ ONLY.

select
  case when to_regprocedure('public.sc_customer_portal_data_v2(text)') is not null then 'PASS' else 'STOP' end as status,
  'public.sc_customer_portal_data_v2(text)' as object_name;

select
  case when to_regclass('public.sc_app_user_roles') is not null then 'PASS' else 'STOP' end as status,
  'public.sc_app_user_roles' as object_name,
  (select count(*) from public.sc_app_user_roles) as role_rows,
  (select count(*) from auth.users) as auth_users;

select
  case
    when (select count(*) from public.sc_app_user_roles where is_active) >= (select count(*) from auth.users)
      then 'PASS'
    else 'REVIEW'
  end as status,
  'Current Auth users have active role rows' as check_name;

select
  case when to_regclass('public.sc_function_security_audit') is not null then 'PASS' else 'STOP' end as status,
  'public.sc_function_security_audit' as object_name;

select
  case when count(*) = 8 then 'PASS' else 'STOP' end as status,
  count(*) as registered_endpoints,
  'Expected eight secured endpoint records.' as message
from public.sc_integration_security_registry;

select endpoint_name, authentication_mode, required_roles, required_environment_variables, compatibility_endpoint_of
from public.sc_integration_security_registry
order by endpoint_name;

select
  p.proname as function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'sc_customer_portal_data_v2';
