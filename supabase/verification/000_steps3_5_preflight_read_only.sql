-- Steps 3-5 preflight. READ ONLY: no permanent objects or operational rows are changed.
-- Review all STOP rows before applying the migrations.

with required_columns(relation_name, column_name) as (
  values
    ('sc_customer_portal_tokens', 'id'),
    ('sc_customer_portal_tokens', 'token'),
    ('sc_customer_portal_tokens', 'customer_name'),
    ('sc_customer_portal_tokens', 'organization'),
    ('sc_customer_portal_tokens', 'is_active'),
    ('sc_customer_portal_tokens', 'expires_at'),
    ('sc_customer_portal_tokens', 'created_at'),
    ('sc_customer_portal_events', 'id'),
    ('sc_customer_portal_events', 'portal_token_id'),
    ('sc_customer_portal_events', 'event_type'),
    ('sc_customer_portal_events', 'title'),
    ('sc_customer_portal_events', 'status'),
    ('sc_customer_portal_events', 'due_date'),
    ('sc_customer_portal_events', 'message'),
    ('sc_customer_portal_events', 'public_note'),
    ('sc_customer_portal_events', 'is_customer_visible'),
    ('sc_customer_portal_events', 'created_at')
), checks as (
  select
    rc.relation_name,
    rc.column_name,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = rc.relation_name
        and c.column_name = rc.column_name
    ) as present
  from required_columns rc
)
select
  case when present then 'PASS' else 'STOP' end as status,
  relation_name,
  column_name,
  case when present then 'Required column exists.' else 'Required customer portal column is missing; do not run Step 3.' end as message
from checks
order by status desc, relation_name, column_name;

select
  case when to_regclass('auth.users') is not null then 'PASS' else 'STOP' end as status,
  'auth.users' as object_name,
  'Step 4 role seeding requires Supabase Auth.' as message;

select
  case when to_regclass('public.sc_app_user_roles') is null then 'PASS' else 'REVIEW' end as status,
  'public.sc_app_user_roles' as object_name,
  case when to_regclass('public.sc_app_user_roles') is null
    then 'The additive role table will be created.'
    else 'The role table already exists; review its columns and current role assignments before rerunning.'
  end as message;

select
  'INFO' as status,
  count(*) as existing_auth_users,
  'Each existing Supabase Auth user will receive admin access only when no role row already exists.' as message
from auth.users;

select
  'INFO' as status,
  count(*) as active_portal_tokens,
  'Existing portal tokens are not modified or rotated by these migrations.' as message
from public.sc_customer_portal_tokens
where coalesce(is_active, false) = true;
