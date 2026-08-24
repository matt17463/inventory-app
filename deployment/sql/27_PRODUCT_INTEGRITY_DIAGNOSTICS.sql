-- Skilled Crafting Inventory v0.9.0
-- Read-only product integrity diagnostics.
-- Additive and idempotent: creates a helper, view, and two reporting RPCs.
-- This migration does not update, merge, archive, or delete production data.

begin;

create or replace function public.sc_identity_norm_v1(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(upper(trim(coalesce(p_value, ''))), '[^A-Z0-9]+', '', 'g');
$$;

create or replace view public.sc_product_integrity_issue_rows_v1
with (security_invoker = true)
as
with blank_base as (
  select
    bp.id::text as entity_id,
    bp.sku_base::text as sku,
    bp.name::text as product_name,
    bp.brand_id::text as brand_id,
    bp.product_type_id::text as product_type_id,
    bp.color_id::text as color_id,
    bp.size_id::text as size_id,
    public.sc_identity_norm_v1(bp.sku_base::text) as sku_norm,
    public.sc_identity_norm_v1(bp.barcode::text) as barcode_norm
  from public.blank_products bp
),
duplicate_identity_groups as (
  select brand_id, product_type_id, color_id, size_id, count(*)::bigint as duplicate_count,
         string_agg(sku, ', ' order by sku) as matching_skus
  from blank_base
  where brand_id <> '' and product_type_id <> '' and color_id <> '' and size_id <> ''
  group by brand_id, product_type_id, color_id, size_id
  having count(*) > 1
),
duplicate_sku_groups as (
  select sku_norm, count(*)::bigint as duplicate_count,
         string_agg(entity_id, ', ' order by entity_id) as matching_ids
  from blank_base
  where sku_norm <> ''
  group by sku_norm
  having count(*) > 1
),
duplicate_barcode_groups as (
  select barcode_norm, count(*)::bigint as duplicate_count,
         string_agg(sku, ', ' order by sku) as matching_skus
  from blank_base
  where barcode_norm <> ''
  group by barcode_norm
  having count(*) > 1
),
lookup_rows as (
  select 'brand'::text as lookup_type, id::text as entity_id, name::text as lookup_name,
         public.sc_identity_norm_v1(name::text) as lookup_norm from public.brands
  union all
  select 'style', id::text, name::text, public.sc_identity_norm_v1(name::text) from public.product_types
  union all
  select 'color', id::text, name::text, public.sc_identity_norm_v1(name::text) from public.colors
  union all
  select 'size', id::text, name::text, public.sc_identity_norm_v1(name::text) from public.sizes
),
duplicate_lookup_groups as (
  select lookup_type, lookup_norm, count(*)::bigint as duplicate_count,
         string_agg(lookup_name, ', ' order by lookup_name) as matching_names,
         string_agg(entity_id, ', ' order by entity_id) as matching_ids
  from lookup_rows
  where lookup_norm <> ''
  group by lookup_type, lookup_norm
  having count(*) > 1
)
select
  'duplicate_identity:' || b.entity_id as issue_id,
  'duplicate_identity'::text as issue_type,
  'high'::text as severity,
  'blank_product'::text as entity_type,
  b.entity_id,
  b.sku,
  b.product_name,
  concat_ws('|', b.brand_id, b.product_type_id, b.color_id, b.size_id) as candidate_group,
  jsonb_build_object('duplicate_count', g.duplicate_count, 'matching_skus', g.matching_skus) as details
from blank_base b
join duplicate_identity_groups g using (brand_id, product_type_id, color_id, size_id)

union all

select
  'duplicate_sku:' || b.entity_id,
  'duplicate_sku',
  'high',
  'blank_product',
  b.entity_id,
  b.sku,
  b.product_name,
  b.sku_norm,
  jsonb_build_object('duplicate_count', g.duplicate_count, 'matching_ids', g.matching_ids)
from blank_base b
join duplicate_sku_groups g using (sku_norm)

union all

select
  'duplicate_barcode:' || b.entity_id,
  'duplicate_barcode',
  'high',
  'blank_product',
  b.entity_id,
  b.sku,
  b.product_name,
  b.barcode_norm,
  jsonb_build_object('duplicate_count', g.duplicate_count, 'matching_skus', g.matching_skus)
from blank_base b
join duplicate_barcode_groups g using (barcode_norm)

union all

select
  'incomplete_identity:' || b.entity_id,
  'incomplete_identity',
  'medium',
  'blank_product',
  b.entity_id,
  b.sku,
  b.product_name,
  concat_ws('|', b.brand_id, b.product_type_id, b.color_id, b.size_id),
  jsonb_build_object(
    'missing', array_remove(array[
      case when b.brand_id = '' then 'brand' end,
      case when b.product_type_id = '' then 'style' end,
      case when b.color_id = '' then 'color' end,
      case when b.size_id = '' then 'size' end,
      case when b.sku_norm = '' then 'sku' end
    ], null)
  )
from blank_base b
where b.brand_id = '' or b.product_type_id = '' or b.color_id = '' or b.size_id = '' or b.sku_norm = ''

union all

select
  'duplicate_lookup_' || l.lookup_type || ':' || l.entity_id,
  'duplicate_lookup_' || l.lookup_type,
  'medium',
  l.lookup_type || '_lookup',
  l.entity_id,
  null,
  l.lookup_name,
  l.lookup_type || '|' || l.lookup_norm,
  jsonb_build_object('duplicate_count', g.duplicate_count, 'matching_names', g.matching_names, 'matching_ids', g.matching_ids)
from lookup_rows l
join duplicate_lookup_groups g using (lookup_type, lookup_norm)

union all

select
  'archived_color_in_use:' || b.entity_id,
  'archived_color_in_use',
  'high',
  'blank_product',
  b.entity_id,
  b.sku,
  b.product_name,
  b.color_id,
  jsonb_build_object('color_name', c.name, 'color_id', c.id)
from blank_base b
join public.colors c on c.id::text = b.color_id
where c.is_active is false;

revoke all on public.sc_product_integrity_issue_rows_v1 from anon;
grant select on public.sc_product_integrity_issue_rows_v1 to authenticated, service_role;

create or replace function public.sc_product_integrity_summary_v1()
returns table (
  issue_type text,
  severity text,
  issue_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select v.issue_type, v.severity, count(*)::bigint
  from public.sc_product_integrity_issue_rows_v1 v
  group by v.issue_type, v.severity
  order by case when v.severity = 'high' then 0 else 1 end, v.issue_type;
$$;

create or replace function public.sc_product_integrity_issues_v1(
  p_issue_type text default 'all',
  p_search text default '',
  p_limit integer default 500
)
returns table (
  issue_id text,
  issue_type text,
  severity text,
  entity_type text,
  entity_id text,
  sku text,
  product_name text,
  candidate_group text,
  details jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    v.issue_id, v.issue_type, v.severity, v.entity_type, v.entity_id,
    v.sku, v.product_name, v.candidate_group, v.details
  from public.sc_product_integrity_issue_rows_v1 v
  where (coalesce(trim(p_issue_type), '') in ('', 'all') or v.issue_type = trim(p_issue_type))
    and (
      coalesce(trim(p_search), '') = ''
      or concat_ws(' ', v.issue_type, v.entity_type, v.entity_id, v.sku, v.product_name, v.candidate_group, v.details::text)
         ilike '%' || trim(p_search) || '%'
    )
  order by case when v.severity = 'high' then 0 else 1 end, v.issue_type, v.candidate_group, v.sku
  limit least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

revoke all on function public.sc_product_integrity_summary_v1() from public, anon;
revoke all on function public.sc_product_integrity_issues_v1(text, text, integer) from public, anon;
grant execute on function public.sc_product_integrity_summary_v1() to authenticated, service_role;
grant execute on function public.sc_product_integrity_issues_v1(text, text, integer) to authenticated, service_role;

commit;

select issue_type, severity, issue_count
from public.sc_product_integrity_summary_v1();
