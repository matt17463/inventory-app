set local lock_timeout='2s';
alter table public.sizes add column if not exists is_active boolean not null default true;
alter table public.product_types add column if not exists is_active boolean not null default true;
alter table public.colors add column sc_canonical_lookup_id bigint references public.colors(id);
alter table public.sizes add column sc_canonical_lookup_id bigint references public.sizes(id);
alter table public.product_types add column sc_canonical_lookup_id bigint references public.product_types(id);
create table public.sc_catalog_lookup_aliases (
  lookup_table text not null check(lookup_table in ('colors','sizes','product_types')),
  alias_id bigint not null, canonical_id bigint not null, original_row jsonb not null,
  created_at timestamptz not null default now(), primary key(lookup_table,alias_id), check(alias_id<>canonical_id)
);
alter table public.sc_catalog_lookup_aliases enable row level security;
revoke all on public.sc_catalog_lookup_aliases from public,anon,authenticated;
grant select on public.sc_catalog_lookup_aliases to authenticated;
grant all on public.sc_catalog_lookup_aliases to service_role;
create policy managers_read_catalog_aliases on public.sc_catalog_lookup_aliases for select to authenticated
using ((select public.sc_internal_access_allowed(array['admin','manager'])));
create table sc_maintenance.catalog_rows_before_20261016(
  table_name text not null,row_key text not null,row_data jsonb not null,
  primary key(table_name,row_key)
);
alter table sc_maintenance.catalog_rows_before_20261016 enable row level security;
create table sc_maintenance.catalog_cleanup_result_20261016(result jsonb not null);
alter table sc_maintenance.catalog_cleanup_result_20261016 enable row level security;

do $cleanup$
declare r record; t record; v_table text; v_column text; v_woo jsonb; v_before jsonb;
  v_after jsonb; v_case uuid; v_actor uuid; v_survivor uuid; v_preview jsonb;
  v_aliases int:=0; v_resolved int:=0; v_review int:=0; v_links int:=0; v_excluded int:=0;
begin
  -- Inventory amounts are an invariant. Record bin totals independently of
  -- catalog IDs so an approved duplicate resolution can consolidate references.
  select jsonb_build_object('movements',(select count(*) from public.blank_inventory_movements),
    'movement_units',(select coalesce(sum(quantity_change),0) from public.blank_inventory_movements),
    'bin_units',(select coalesce(jsonb_object_agg(bin_id::text,n),'{}') from
      (select bin_id,sum(quantity_change) n from public.blank_inventory_movements group by bin_id)b),
    'finished_units',(select coalesce(sum(quantity),0) from public.finished_inventory),
    'product_units',(select coalesce(sum(quantity),0) from public.products)) into v_before;
  -- Snapshot affected operational tables privately, including their original
  -- foreign keys. Keep source rows; aliases and blank duplicates are archived.
  for t in select distinct table_name from information_schema.columns
    where table_schema='public' and column_name in ('color_id','size_id','product_type_id','blank_product_id')
      and table_name !~ '(backup|_view|^phase[0-9]_.*report)'
      and exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname=table_name and c.relkind='r')
    union select unnest(array['colors','sizes','product_types','sc_color_pairing_rules','sc_product_blank_mappings','sc_product_identity_aliases'])
  loop
    execute format('insert into sc_maintenance.catalog_rows_before_20261016 select %L,coalesce(to_jsonb(x)->>''id'',md5(to_jsonb(x)::text)),to_jsonb(x) from public.%I x on conflict do nothing',t.table_name,t.table_name);
  end loop;
  create temp table sc_lookup_cleanup_map on commit drop as
  with source as (
    select 'colors'::text lookup_table,c.id,lower(btrim(c.name)) k,c.woo_term_id,
      exists(select 1 from public.sc_color_pairing_rules pairing where pairing.canonical_color_id=c.id and pairing.status='active') preferred
    from public.colors c where coalesce(c.is_active,true)
    union all select 'sizes',s.id,case when public.sc_identity_norm_v1(s.name)='ONESIZE' then 'one size' else lower(btrim(s.name)) end,s.woo_term_id,false from public.sizes s where s.is_active
    union all select 'product_types',p.id,lower(btrim(p.name)),p.woo_term_id,false from public.product_types p where p.is_active
  ), ranked as (
    select *,first_value(id) over(partition by lookup_table,k order by preferred desc,(woo_term_id is not null) desc,id) canonical_id,
      count(*) over(partition by lookup_table,k) n from source where k<>''
  ) select lookup_table,id alias_id,canonical_id from ranked where n>1 and id<>canonical_id;

  for r in select * from sc_lookup_cleanup_map order by lookup_table,canonical_id,alias_id loop
    v_table:=r.lookup_table;
    execute format('select to_jsonb(x) from public.%I x where id=$1',v_table) into v_woo using r.alias_id;
    insert into public.sc_catalog_lookup_aliases values(v_table,r.alias_id,r.canonical_id,v_woo,now());
    -- Preserve the WooCommerce code on the survivor, so the installed plugin's
    -- code-based upsert continues to reuse the same record after cleanup.
    execute format('update public.%I set is_active=false,sc_canonical_lookup_id=$1,code=$2,woo_term_id=null,woo_term_slug=null where id=$3',v_table)
      using r.canonical_id,'ARCHIVED-'||r.alias_id::text,r.alias_id;
    if nullif(v_woo->>'woo_term_id','') is not null then
      execute format('update public.%I set woo_term_id=coalesce(woo_term_id,$1),woo_term_slug=coalesce(woo_term_slug,$2),woo_attribute_taxonomy=coalesce(woo_attribute_taxonomy,$3),code=$4 where id=$5 and (woo_term_id is null or woo_term_id=$1)',v_table)
        using (v_woo->>'woo_term_id')::bigint,v_woo->>'woo_term_slug',v_woo->>'woo_attribute_taxonomy',v_woo->>'code',r.canonical_id;
    end if;
    v_column:=case v_table when 'colors' then 'color_id' when 'sizes' then 'size_id' else 'product_type_id' end;
    foreach v_table in array array['blank_products','products','sample_inventory_items'] loop
      execute format('update public.%I set %I=$1 where %I=$2',v_table,v_column,v_column) using r.canonical_id,r.alias_id;
    end loop;
    if r.lookup_table='colors' then update public.sc_color_pairing_rules set canonical_color_id=r.canonical_id where canonical_color_id=r.alias_id; end if;
    v_aliases:=v_aliases+1;
  end loop;

  -- Resolve only SKU groups whose non-empty identity fields agree and whose
  -- existing barcodes do not conflict. The existing case workflow previews,
  -- locks, preserves aliases and archives the duplicate atomically.
  select user_id into v_actor from public.sc_app_user_roles where role='admin' and is_active order by user_id limit 1;
  for r in
    select public.sc_identity_norm_v1(bp.sku_base) k,array_agg(bp.id) ids,
      count(distinct nullif(public.sc_identity_norm_v1(b.name),'')) brands,
      count(distinct nullif(public.sc_identity_norm_v1(p.name),'')) styles,
      count(distinct nullif(public.sc_identity_norm_v1(c.name),'')) colors,
      count(distinct nullif(public.sc_identity_norm_v1(s.name),'')) sizes,
      count(distinct nullif(public.sc_identity_norm_v1(coalesce(bp.upc,bp.barcode)),'')) barcodes
    from public.blank_products bp left join public.brands b on b.id=bp.brand_id
      left join public.product_types p on p.id=bp.product_type_id left join public.colors c on c.id=bp.color_id
      left join public.sizes s on s.id=bp.size_id
    where not coalesce(bp.sc_is_archived,false) and nullif(public.sc_identity_norm_v1(bp.sku_base),'') is not null
    group by 1 having count(*)>1
  loop
    select bp.id into v_survivor from public.blank_products bp where bp.id=any(r.ids)
    order by num_nonnulls(bp.brand_id,bp.product_type_id,bp.color_id,bp.size_id) desc,
      (select count(*) from public.products p where p.blank_product_id=bp.id) desc,
      (select count(*) from public.blank_inventory_movements m where m.blank_product_id=bp.id) desc,bp.id limit 1;
    insert into public.sc_product_review_cases(case_type,title,reason,candidate_group,proposed_survivor_id_text,created_by,evidence)
    values('duplicate_product','Catalog cleanup: '||r.k,'Duplicate normalized SKU; inventory quantities must be conserved.',r.k,v_survivor::text,v_actor,jsonb_build_object('cleanup','2026-10-16','identity',to_jsonb(r))) returning id into v_case;
    insert into public.sc_product_review_case_items(case_id,entity_type,entity_id_text,proposed_role,snapshot)
    select v_case,'blank_product',bp.id::text,case when bp.id=v_survivor then 'survivor' else 'duplicate' end,to_jsonb(bp)
    from public.blank_products bp where bp.id=any(r.ids);
    if greatest(r.brands,r.styles,r.colors,r.sizes,r.barcodes)>1 then
      v_review:=v_review+1; continue;
    end if;
    begin
      v_preview:=public.sc_preview_product_resolution_v1(v_case,v_actor);
      perform public.sc_apply_product_resolution_v1((v_preview->>'resolution_id')::uuid,v_preview->>'confirmation_phrase',v_actor);
      v_resolved:=v_resolved+1;
    exception when unique_violation or foreign_key_violation then
      update public.sc_product_review_cases set resolution_notes='Reference collision requires review; no merge was applied. '||sqlerrm where id=v_case;
      v_review:=v_review+1;
    end;
  end loop;

  -- Parent aggregates and approved non-inventory products do not need blanks.
  update public.products p set woo_link_status='excluded_parent_aggregate'
  where p.blank_product_id is null and p.woocommerce_variation_id is null and p.woocommerce_product_id is not null
    and exists(select 1 from public.products v where v.woocommerce_product_id=p.woocommerce_product_id and v.woocommerce_variation_id is not null);
  get diagnostics v_excluded=row_count;
  -- Use canonical lookup IDs and a single-candidate join. Never create a new
  -- physical blank or change an existing approved product mapping here.
  -- Exact links are repaired in short, bounded transactions after this migration.
  select jsonb_build_object('movements',(select count(*) from public.blank_inventory_movements),
    'movement_units',(select coalesce(sum(quantity_change),0) from public.blank_inventory_movements),
    'bin_units',(select coalesce(jsonb_object_agg(bin_id::text,n),'{}') from
      (select bin_id,sum(quantity_change) n from public.blank_inventory_movements group by bin_id)b),
    'finished_units',(select coalesce(sum(quantity),0) from public.finished_inventory),
    'product_units',(select coalesce(sum(quantity),0) from public.products)) into v_after;
  if v_before<>v_after then raise exception 'Catalog cleanup changed inventory amounts; transaction rolled back.'; end if;
  insert into sc_maintenance.catalog_cleanup_result_20261016 values(jsonb_build_object(
    'lookup_aliases_archived',v_aliases,'duplicate_blank_groups_resolved',v_resolved,'duplicate_groups_requiring_review',v_review,
    'exact_links_repaired',v_links,'parent_rows_excluded',v_excluded,'inventory_before',v_before,'inventory_after',v_after));
end
$cleanup$;

-- Reject new duplicate active lookup names. Archived aliases remain available
-- for history, while code-based WooCommerce upserts target the survivor.
create unique index sc_colors_active_name_unique on public.colors(lower(btrim(name))) where is_active;
create unique index sc_sizes_active_name_unique on public.sizes(lower(btrim(name))) where is_active;
create unique index sc_styles_active_name_unique on public.product_types(lower(btrim(name))) where is_active;
create function public.sc_canonicalize_lookup_references_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.color_id:=coalesce((select sc_canonical_lookup_id from public.colors where id=new.color_id),new.color_id);
  new.size_id:=coalesce((select sc_canonical_lookup_id from public.sizes where id=new.size_id),new.size_id);
  new.product_type_id:=coalesce((select sc_canonical_lookup_id from public.product_types where id=new.product_type_id),new.product_type_id);
  return new;
end;
$$;
revoke all on function public.sc_canonicalize_lookup_references_v1() from public,anon,authenticated;
create trigger aaa_sc_canonicalize_lookup_refs before insert or update of color_id,size_id,product_type_id on public.products for each row execute function public.sc_canonicalize_lookup_references_v1();
create trigger aaa_sc_canonicalize_lookup_refs before insert or update of color_id,size_id,product_type_id on public.blank_products for each row execute function public.sc_canonicalize_lookup_references_v1();
create trigger aaa_sc_canonicalize_lookup_refs before insert or update of color_id,size_id,product_type_id on public.sample_inventory_items for each row execute function public.sc_canonicalize_lookup_references_v1();

-- The integrity view includes active records only; archived duplicates are
-- retained history and must not appear as new duplicate repair work.
do $view$
declare v_sql text;
begin
  v_sql:=pg_get_viewdef('public.sc_product_integrity_issue_rows_v1'::regclass,true);
  v_sql:=regexp_replace(v_sql,'FROM (public\.)?blank_products bp','FROM public.blank_products bp WHERE NOT coalesce(bp.sc_is_archived,false)');
  v_sql:=regexp_replace(v_sql,'FROM (public\.)?colors(\s*\))','FROM public.colors WHERE is_active\2');
  v_sql:=replace(v_sql,'FROM product_types','FROM public.product_types WHERE is_active');
  v_sql:=replace(v_sql,'FROM sizes','FROM public.sizes WHERE is_active');
  v_sql:=replace(v_sql,'FROM colors','FROM public.colors WHERE is_active');
  execute 'create or replace view public.sc_product_integrity_issue_rows_v1 with(security_invoker=true) as '||v_sql;
end
$view$;

create function public.sc_catalog_cleanup_summary_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.sc_require_internal_access(array['admin','manager']);
  return (select result from sc_maintenance.catalog_cleanup_result_20261016 limit 1);
end;
$$;
revoke all on function public.sc_catalog_cleanup_summary_v1() from public,anon;
grant execute on function public.sc_catalog_cleanup_summary_v1() to authenticated,service_role;
create function public.sc_repair_exact_catalog_links_v1(p_limit integer default 50) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer; v_before numeric; v_after numeric;
begin
  perform public.sc_require_internal_access(array['admin','manager']);
  perform pg_advisory_xact_lock(hashtextextended('exact-catalog-link-repair',0));
  select coalesce(sum(quantity_change),0) into v_before from public.blank_inventory_movements;
  with unique_blanks as materialized (
    select brand_id,product_type_id,color_id,size_id,min(id::text)::uuid blank_id
    from public.blank_products where not coalesce(sc_is_archived,false)
      and brand_id is not null and product_type_id is not null and color_id is not null and size_id is not null
    group by 1,2,3,4 having count(*)=1
  ), candidates as materialized (
    select p.id,b.blank_id from public.products p join unique_blanks b
      on p.brand_id=b.brand_id and p.product_type_id=b.product_type_id and p.color_id=b.color_id and p.size_id=b.size_id
    where p.blank_product_id is null and coalesce(p.woo_link_status,'') not like 'excluded%'
      and not exists(select 1 from public.sc_find_non_inventory_rule_for_line(p.sku,p.woocommerce_product_id,p.woocommerce_variation_id,p.name))
    order by p.id limit least(greatest(coalesce(p_limit,50),1),100) for update of p skip locked
  ) update public.products p set blank_product_id=c.blank_id,woo_link_status='linked_exact_catalog_cleanup',woo_linked_at=now()
  from candidates c where p.id=c.id and p.blank_product_id is null;
  get diagnostics v_count=row_count;
  select coalesce(sum(quantity_change),0) into v_after from public.blank_inventory_movements;
  if v_before<>v_after then raise exception 'A link repair changed physical stock; rolled back.'; end if;
  update sc_maintenance.catalog_cleanup_result_20261016 set result=result || jsonb_build_object(
    'exact_links_repaired',coalesce((result->>'exact_links_repaired')::integer,0)+v_count,'last_link_repair_at',now());
  return v_count;
end;
$$;
revoke all on function public.sc_repair_exact_catalog_links_v1(integer) from public,anon;
grant execute on function public.sc_repair_exact_catalog_links_v1(integer) to authenticated,service_role;
notify pgrst,'reload schema';

-- Barcode and unit cost belong to the physical blank, not the storefront row.
-- Do not count parent aggregates or approved services as unpaired inventory.
create view public.sc_product_data_health_issues_v2 with(security_invoker=true) as
with physical as (
  select bp.id::text product_id,bp.sku_base sku,bp.name product_name,
    b.name brand_name,pt.name style_name,c.name color_name,s.name size_name,
    bp.brand_id,bp.product_type_id,bp.color_id,bp.size_id,bp.unit_cost,
    coalesce(nullif(btrim(bp.barcode),''),nullif(btrim(bp.upc),'')) barcode
  from public.blank_products bp left join public.brands b on b.id=bp.brand_id
    left join public.product_types pt on pt.id=bp.product_type_id
    left join public.colors c on c.id=bp.color_id left join public.sizes s on s.id=bp.size_id
  where not coalesce(bp.sc_is_archived,false)
), storefront as (
  select p.id::text product_id,p.sku,p.name product_name,b.name brand_name,pt.name style_name,
    c.name color_name,s.name size_name,p.brand_id,p.product_type_id,p.color_id,p.size_id,p.blank_product_id
  from public.products p left join public.brands b on b.id=p.brand_id
    left join public.product_types pt on pt.id=p.product_type_id left join public.colors c on c.id=p.color_id
    left join public.sizes s on s.id=p.size_id
  where p.blank_product_id is null and coalesce(p.woo_link_status,'') not like 'excluded%'
    and (p.woocommerce_variation_id is not null or p.woo_row_type='simple')
    and coalesce(p.woocommerce_status,'publish') not in ('trash','draft','private','pending')
    and not exists(select 1 from public.sc_find_non_inventory_rule_for_line(p.sku,p.woocommerce_product_id,p.woocommerce_variation_id,p.name))
)
select i.issue_type,'blank_products'::text product_table,p.product_id,p.sku,p.product_name,
  p.brand_name,p.style_name,p.color_name,p.size_name,i.detail,i.severity
from physical p cross join lateral (values
  ('missing_sku',nullif(btrim(p.sku),'') is null,'Blank item is missing its SKU.','warning'),
  ('missing_barcode',p.barcode is null,'Optional scanning information: this blank has no barcode or UPC.','info'),
  ('missing_unit_cost',coalesce(p.unit_cost,0)<=0,'Blank item has no positive unit cost; review costing before valuing stock.','warning'),
  ('missing_brand',p.brand_id is null,'Blank item is missing its brand.','warning'),
  ('missing_style',p.product_type_id is null,'Blank item is missing its style.','warning'),
  ('missing_color',p.color_id is null,'Blank item is missing its color.','warning'),
  ('missing_size',p.size_id is null,'Blank item is missing its size.','warning')
) i(issue_type,applies,detail,severity) where i.applies
union all
select i.issue_type,'products',p.product_id,p.sku,p.product_name,p.brand_name,p.style_name,p.color_name,p.size_name,i.detail,'warning'
from storefront p cross join lateral (values
  ('missing_blank_link',true,'Inventory-requiring WooCommerce item needs an approved blank mapping.'),
  ('missing_sku',nullif(btrim(p.sku),'') is null,'WooCommerce item is missing the SKU required by order import.'),
  ('missing_brand',p.brand_id is null,'WooCommerce item is missing its brand mapping.'),
  ('missing_style',p.product_type_id is null,'WooCommerce item is missing its style mapping.'),
  ('missing_color',p.color_id is null,'WooCommerce item is missing its color mapping.'),
  ('missing_size',p.size_id is null,'WooCommerce item is missing its size mapping.')
) i(issue_type,applies,detail) where i.applies;
revoke all on public.sc_product_data_health_issues_v2 from public,anon;
grant select on public.sc_product_data_health_issues_v2 to authenticated,service_role;
create or replace function public.phase6_product_data_health_summary()
returns table(issue_type text,issue_count integer) language sql stable security invoker set search_path='' as $$
  select r.issue_type,count(*)::integer from public.sc_product_data_health_issues_v2 r group by r.issue_type order by count(*) desc,r.issue_type
$$;
create or replace function public.phase6_product_data_health_report(p_issue text default 'all')
returns table(issue_type text,product_id text,sku text,product_name text,brand_name text,style_name text,color_name text,size_name text,detail text)
language sql stable security invoker set search_path='' as $$
  select r.issue_type,r.product_id,r.sku,r.product_name,r.brand_name,r.style_name,r.color_name,r.size_name,r.detail
  from public.sc_product_data_health_issues_v2 r where coalesce(p_issue,'all')='all' or r.issue_type=p_issue
  order by case when r.severity='info' then 1 else 0 end,r.issue_type,r.product_name,r.product_id limit 5000
$$;
create function public.sc_product_data_health_page_v2(p_issue text default 'all',p_offset integer default 0,p_limit integer default 100)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  perform public.sc_require_internal_access(array['admin','manager','operator','viewer']);
  return jsonb_build_object(
    'total',(select count(*) from public.sc_product_data_health_issues_v2 r where coalesce(p_issue,'all')='all' or r.issue_type=p_issue),
    'summary',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.phase6_product_data_health_summary() s),
    'rows',(select coalesce(jsonb_agg(to_jsonb(page)),'[]') from (
      select * from public.sc_product_data_health_issues_v2 r where coalesce(p_issue,'all')='all' or r.issue_type=p_issue
      order by case when r.severity='info' then 1 else 0 end,r.issue_type,r.product_name,r.product_id
      offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,100),1),200)
    ) page)
  );
end;
$$;
revoke all on function public.sc_product_data_health_page_v2(text,integer,integer) from public,anon;
grant execute on function public.sc_product_data_health_page_v2(text,integer,integer) to authenticated,service_role;
