-- Read-only readiness report for Marketing & Client Growth 1.5.
-- Run before migrations and again after migrations, never as a substitute for functional role tests.
with required_tables(table_name) as (
 values ('sc_growth_accounts'),('sc_growth_tasks'),('sc_growth_samples'),
        ('sc_growth_documents'),('sc_growth_document_reviews')
), table_status as (
 select r.table_name, c.oid is not null as exists_in_public,
        coalesce((select relrowsecurity from pg_class where oid=c.oid),false) as rls_enabled
 from required_tables r
 left join pg_namespace n on n.nspname='public'
 left join pg_class c on c.relnamespace=n.oid and c.relname=r.table_name and c.relkind in ('r','p')
)
select table_name, exists_in_public, rls_enabled from table_status order by table_name;
-- Verify the expected security-definer routines exist before allowing external link creation.
select routine_schema,routine_name
from information_schema.routines
where routine_schema in ('public','sc_internal')
and routine_name in ('sc_growth_approve_document_v1','sc_growth_review_sample_v1',
 'sc_growth_document_guard_v1','sc_growth_review_response_guard_v1')
order by routine_schema,routine_name;
