-- Read-only verification for Mockup Studio local archive support.
-- Expected: every boolean column returns true.

select
  to_regclass('public.mockup_project_archives') is not null as archive_table_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mockup_project_archives'
      and column_name = 'manifest'
      and data_type = 'jsonb'
  ) as manifest_column_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mockup_project_archives'
      and column_name = 'deleted_file_keys'
      and data_type = 'jsonb'
  ) as resumable_cleanup_column_exists,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mockup_project_archives'
      and policyname = 'sc_mockup_project_archives_authenticated_select'
  ) as authenticated_policy_exists;
