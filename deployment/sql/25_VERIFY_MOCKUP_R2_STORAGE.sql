-- Mockup Studio R2 migration verification (read only).
-- Expected: every check returns PASS after deployment.

with checks as (
  select
    'mockup_projects.storage_provider'::text as check_name,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'mockup_projects'
        and column_name = 'storage_provider'
    ) as passed
  union all
  select
    'mockup_blank_assets.storage_provider',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'mockup_blank_assets'
        and column_name = 'storage_provider'
    )
  union all
  select
    'mockup_artwork_assets.preview_storage_path',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'mockup_artwork_assets'
        and column_name = 'preview_storage_path'
    )
  union all
  select
    'mockup_outputs.preview_storage_path',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'mockup_outputs'
        and column_name = 'preview_storage_path'
    )
  union all
  select
    'mockup_storage_inventory view',
    to_regclass('public.mockup_storage_inventory') is not null
)
select check_name, case when passed then 'PASS' else 'FAIL' end as result
from checks
order by check_name;

select
  p.project_name,
  p.status,
  p.storage_provider as project_storage,
  i.storage_provider as file_storage,
  i.original_file_count,
  i.preview_file_count,
  pg_size_pretty(i.original_bytes) as original_size,
  pg_size_pretty(i.preview_bytes) as preview_size,
  pg_size_pretty(i.total_known_bytes) as total_known_size
from public.mockup_projects p
left join public.mockup_storage_inventory i on i.project_id = p.id
order by p.updated_at desc, i.storage_provider;

