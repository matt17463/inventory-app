-- OPTIONAL ROLLBACK. Do not run during normal deployment.
-- This removes only objects introduced by Steps 3-5. It does not restore changed application files.

-- drop function if exists public.sc_customer_portal_data_v2(text);
-- drop table if exists public.sc_integration_security_registry;
-- drop table if exists public.sc_function_security_audit;
-- drop function if exists public.sc_current_app_role();
-- drop table if exists public.sc_app_user_roles;
