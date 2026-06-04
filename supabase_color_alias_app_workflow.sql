-- Skilled Crafting Color Alias App Workflow
-- Adds app-driven approval/rejection of Woo color -> Blank color aliases.
-- No alias is used unless status = 'approved'.
--
-- Deploy order:
-- 1) Run this SQL in Supabase.
-- 2) Deploy the app files.
-- 3) Open /color-aliases in the app.
-- 4) Approve/reject candidates.
-- 5) Click Relink Products.

-- =========================================================
-- Core helpers
-- =========================================================

create extension if not exists pgcrypto;

create or replace function public.sc_match_norm(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(upper(coalesce(p_value, '')), '&', 'AND'),
    '[^A-Z0-9]+',
    '',
    'g'
  );
$$;

create or replace function public.sc_sku_tokens(p_sku text)
returns table(token text)
language sql
immutable
as $$
  select distinct token
  from regexp_split_to_table(upper(coalesce(p_sku, '')), '[^A-Z0-9]+') token
  where token <> ''
$$;

create or replace function public.sc_infer_product_type_id_from_sku(p_sku text)
returns bigint
language plpgsql
stable
as $$
declare
  v_product_type_id public.product_types.id%type;
begin
  select pt.id
  into v_product_type_id
  from public.product_types pt
  join public.sc_sku_tokens(p_sku) t
    on public.sc_match_norm(pt.name) = public.sc_match_norm(t.token)
    or public.sc_match_norm(pt.code) = public.sc_match_norm(t.token)
  order by
    case when t.token ~ '^[0-9]{3,6}$' then 0 else 1 end,
    length(t.token) desc
  limit 1;

  return v_product_type_id;
end;
$$;

-- =========================================================
-- Approval table
-- =========================================================

create table if not exists public.color_alias_approvals (
  id uuid primary key default gen_random_uuid(),

  woo_color text not null,
  blank_color text not null,

  woo_color_norm text generated always as (
    regexp_replace(upper(coalesce(woo_color, '')), '[^A-Z0-9]+', '', 'g')
  ) stored,

  blank_color_norm text generated always as (
    regexp_replace(upper(coalesce(blank_color, '')), '[^A-Z0-9]+', '', 'g')
  ) stored,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,

  unique (woo_color_norm, blank_color_norm)
);

create index if not exists idx_color_alias_approvals_status
on public.color_alias_approvals(status);

-- App calls this RPC instead of trying to upsert generated columns directly.
create or replace function public.save_color_alias_decision(
  p_woo_color text,
  p_blank_color text,
  p_status text,
  p_notes text default null,
  p_reviewed_by text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  if nullif(trim(coalesce(p_woo_color, '')), '') is null then
    raise exception 'Woo color is required';
  end if;

  if nullif(trim(coalesce(p_blank_color, '')), '') is null then
    raise exception 'Blank color is required';
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Status must be pending, approved, or rejected';
  end if;

  insert into public.color_alias_approvals (
    woo_color,
    blank_color,
    status,
    notes,
    reviewed_at,
    reviewed_by,
    updated_at
  ) values (
    trim(p_woo_color),
    trim(p_blank_color),
    p_status,
    p_notes,
    case when p_status in ('approved','rejected') then now() else null end,
    p_reviewed_by,
    now()
  )
  on conflict (woo_color_norm, blank_color_norm)
  do update set
    status = excluded.status,
    notes = excluded.notes,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by,
    updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'woo_color', trim(p_woo_color),
    'blank_color', trim(p_blank_color),
    'status', p_status
  );
end;
$$;

grant execute on function public.save_color_alias_decision(text, text, text, text, text)
to anon, authenticated;

-- True only for exact normalized color match or explicit approved alias.
create or replace function public.sc_color_matches_or_approved_alias(
  p_woo_color text,
  p_blank_color text
)
returns boolean
language sql
stable
as $$
  select
    public.sc_match_norm(p_woo_color) = public.sc_match_norm(p_blank_color)
    or exists (
      select 1
      from public.color_alias_approvals caa
      where caa.status = 'approved'
        and public.sc_match_norm(caa.woo_color) = public.sc_match_norm(p_woo_color)
        and public.sc_match_norm(caa.blank_color) = public.sc_match_norm(p_blank_color)
    );
$$;

-- =========================================================
-- Color alias review candidates
-- =========================================================

drop view if exists public.color_alias_review_candidates cascade;

create view public.color_alias_review_candidates as
select distinct
  br.name as brand,
  pt.name as style,
  s.name as size,

  wc.name as woo_color,
  bc.name as possible_blank_color,

  count(*) over (
    partition by br.name, pt.name, s.name, wc.name, bc.name
  ) as affected_woo_products,

  coalesce(caa.status, 'not_reviewed') as approval_status,
  caa.notes
from public.products p
left join public.brands br on br.id = p.brand_id
left join public.product_types pt on pt.id = p.product_type_id
left join public.colors wc on wc.id = p.color_id
left join public.sizes s on s.id = p.size_id

join public.blank_products bp
  on (
       public.sc_match_norm(br.name) = public.sc_match_norm((select br2.name from public.brands br2 where br2.id = bp.brand_id))
       and public.sc_match_norm(coalesce(pt.name, (select ipt.name from public.product_types ipt where ipt.id = public.sc_infer_product_type_id_from_sku(p.sku))))
         = public.sc_match_norm((select pt2.name from public.product_types pt2 where pt2.id = bp.product_type_id))
       and public.sc_match_norm(s.name) = public.sc_match_norm((select s2.name from public.sizes s2 where s2.id = bp.size_id))
     )
 and coalesce(bp.is_active, true) = true

left join public.colors bc on bc.id = bp.color_id

left join public.color_alias_approvals caa
  on public.sc_match_norm(caa.woo_color) = public.sc_match_norm(wc.name)
 and public.sc_match_norm(caa.blank_color) = public.sc_match_norm(bc.name)

where p.blank_product_id is null
  and wc.name is not null
  and bc.name is not null
  and public.sc_match_norm(wc.name) <> public.sc_match_norm(bc.name)
  and coalesce(caa.status, 'not_reviewed') <> 'rejected';

grant select on public.color_alias_approvals to anon, authenticated;
grant select on public.color_alias_review_candidates to anon, authenticated;

-- =========================================================
-- Recreate matching views/functions to honor approved aliases only
-- =========================================================

drop view if exists public.woo_products_unmatched_to_blank_master cascade;
drop view if exists public.woo_blank_match_diagnostics cascade;
drop view if exists public.woo_blank_match_candidates cascade;

create view public.woo_blank_match_candidates as
with product_text as (
  select
    p.id as product_id,
    p.sku,
    p.name,
    p.woocommerce_product_id,
    p.woocommerce_variation_id,
    p.blank_product_id as current_blank_product_id,
    p.brand_id,
    br.name as brand,
    p.product_type_id,
    pt.name as product_type,
    public.sc_infer_product_type_id_from_sku(p.sku) as inferred_product_type_id,
    ipt.name as inferred_product_type,
    p.color_id,
    c.name as color,
    p.size_id,
    s.name as size,
    p.is_finished,
    coalesce(pt.name, ipt.name) as match_product_type
  from public.products p
  left join public.brands br on br.id = p.brand_id
  left join public.product_types pt on pt.id = p.product_type_id
  left join public.product_types ipt on ipt.id = public.sc_infer_product_type_id_from_sku(p.sku)
  left join public.colors c on c.id = p.color_id
  left join public.sizes s on s.id = p.size_id
),
blank_text as (
  select
    bp.id as blank_product_id,
    bp.sku_base,
    bp.name as blank_name,
    bp.brand_id,
    br.name as brand,
    bp.product_type_id,
    pt.name as product_type,
    bp.color_id,
    c.name as color,
    bp.size_id,
    s.name as size,
    coalesce(bp.is_active, true) as is_active
  from public.blank_products bp
  left join public.brands br on br.id = bp.brand_id
  left join public.product_types pt on pt.id = bp.product_type_id
  left join public.colors c on c.id = bp.color_id
  left join public.sizes s on s.id = bp.size_id
)
select
  p.product_id,
  p.sku,
  p.name,
  p.woocommerce_product_id,
  p.woocommerce_variation_id,
  p.current_blank_product_id,
  p.brand as woo_brand,
  p.product_type as woo_product_type,
  p.inferred_product_type,
  p.match_product_type,
  p.color as woo_color,
  p.size as woo_size,
  p.is_finished,
  b.blank_product_id,
  b.sku_base,
  b.blank_name,
  b.brand as blank_brand,
  b.product_type as blank_product_type,
  b.color as blank_color,
  b.size as blank_size,

  (
    case
      when public.sc_match_norm(p.sku) like '%' || public.sc_match_norm(b.sku_base) || '%' then 1000
      else 0
    end
    +
    case
      when public.sc_match_norm(p.brand) <> ''
       and public.sc_match_norm(p.brand) = public.sc_match_norm(b.brand) then 150
      else 0
    end
    +
    case
      when public.sc_match_norm(p.match_product_type) <> ''
       and public.sc_match_norm(p.match_product_type) = public.sc_match_norm(b.product_type) then 250
      else 0
    end
    +
    case
      when public.sc_match_norm(p.color) <> ''
       and public.sc_color_matches_or_approved_alias(p.color, b.color) then 150
      else 0
    end
    +
    case
      when public.sc_match_norm(p.size) <> ''
       and public.sc_match_norm(p.size) = public.sc_match_norm(b.size) then 200
      else 0
    end
  ) as match_score,

  case
    when public.sc_match_norm(p.sku) like '%' || public.sc_match_norm(b.sku_base) || '%' then 'sku_contains_blank_sku_base'
    when public.sc_match_norm(p.brand) = public.sc_match_norm(b.brand)
      and public.sc_match_norm(p.match_product_type) = public.sc_match_norm(b.product_type)
      and public.sc_color_matches_or_approved_alias(p.color, b.color)
      and public.sc_match_norm(p.size) = public.sc_match_norm(b.size)
      then 'normalized_attributes_or_approved_color_alias'
    else 'partial_match'
  end as match_method
from product_text p
join blank_text b
  on b.is_active = true
 and (
      public.sc_match_norm(p.sku) like '%' || public.sc_match_norm(b.sku_base) || '%'
      or (
        public.sc_match_norm(p.brand) <> ''
        and public.sc_match_norm(p.match_product_type) <> ''
        and public.sc_match_norm(p.color) <> ''
        and public.sc_match_norm(p.size) <> ''
        and public.sc_match_norm(p.brand) = public.sc_match_norm(b.brand)
        and public.sc_match_norm(p.match_product_type) = public.sc_match_norm(b.product_type)
        and public.sc_color_matches_or_approved_alias(p.color, b.color)
        and public.sc_match_norm(p.size) = public.sc_match_norm(b.size)
      )
    );

create or replace function public.wcsb_link_woo_product_to_blank_and_finished(p_sku text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_product public.products%rowtype;
  v_blank_id public.blank_products.id%type;
  v_candidate_count integer := 0;
  v_customer_name text;
  v_logo_name text;
  v_finished_id public.finished_products.id%type;
  v_inferred_product_type_id public.product_types.id%type;
  v_reason text;
begin
  select *
  into v_product
  from public.products
  where sku = p_sku
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_not_found', 'sku', p_sku);
  end if;

  if v_product.product_type_id is null then
    v_inferred_product_type_id := public.sc_infer_product_type_id_from_sku(v_product.sku);

    if v_inferred_product_type_id is not null then
      update public.products
      set product_type_id = v_inferred_product_type_id
      where sku = p_sku;

      v_product.product_type_id := v_inferred_product_type_id;
    end if;
  end if;

  with ranked as (
    select
      c.blank_product_id,
      c.match_score,
      c.match_method,
      row_number() over (
        order by
          c.match_score desc,
          case c.match_method
            when 'sku_contains_blank_sku_base' then 0
            when 'normalized_attributes_or_approved_color_alias' then 1
            else 2
          end,
          c.blank_product_id::text
      ) as rn,
      count(*) over () as total_candidates
    from public.woo_blank_match_candidates c
    where c.sku = p_sku
      and c.match_score >= 750
  )
  select blank_product_id, total_candidates
  into v_blank_id, v_candidate_count
  from ranked
  where rn = 1;

  if v_blank_id is null then
    if v_product.brand_id is null then
      v_reason := 'missing_brand';
    elsif v_product.product_type_id is null then
      v_reason := 'missing_style_product_type';
    elsif v_product.color_id is null then
      v_reason := 'missing_color';
    elsif v_product.size_id is null then
      v_reason := 'missing_size';
    else
      v_reason := 'no_approved_blank_match';
    end if;

    update public.products
    set blank_product_id = null,
        woo_link_status = v_reason,
        woo_linked_at = now()
    where sku = p_sku;

    return jsonb_build_object('ok', false, 'reason', v_reason, 'sku', p_sku);
  end if;

  update public.products
  set blank_product_id = v_blank_id,
      woo_link_status = 'linked',
      woo_linked_at = now()
  where sku = p_sku;

  if coalesce(v_product.is_finished, false) then
    if v_product.customer_id is not null then
      select name into v_customer_name from public.customers where id = v_product.customer_id limit 1;
    end if;

    if v_product.logo_id is not null then
      select name into v_logo_name from public.logos where id = v_product.logo_id limit 1;
    end if;

    select id
    into v_finished_id
    from public.finished_products
    where sku = v_product.sku
       or finished_sku = v_product.sku
    limit 1;

    if v_finished_id is null then
      insert into public.finished_products (
        sku,
        finished_sku,
        name,
        customer_name,
        logo_name,
        blank_product_id,
        woo_product_id,
        woo_variation_id,
        source,
        notes
      ) values (
        v_product.sku,
        v_product.sku,
        v_product.name,
        v_customer_name,
        v_logo_name,
        v_blank_id,
        v_product.woocommerce_product_id,
        v_product.woocommerce_variation_id,
        'woocommerce',
        'Created by WooCommerce sync and linked using approved color alias workflow'
      )
      returning id into v_finished_id;
    else
      update public.finished_products
      set
        finished_sku = v_product.sku,
        name = v_product.name,
        customer_name = coalesce(v_customer_name, customer_name),
        logo_name = coalesce(v_logo_name, logo_name),
        blank_product_id = v_blank_id,
        woo_product_id = v_product.woocommerce_product_id,
        woo_variation_id = v_product.woocommerce_variation_id,
        source = 'woocommerce'
      where id = v_finished_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'sku', p_sku,
    'blank_product_id', v_blank_id,
    'candidate_count', v_candidate_count,
    'finished_product_id', v_finished_id
  );
end;
$$;

grant execute on function public.wcsb_link_woo_product_to_blank_and_finished(text)
to anon, authenticated;

create or replace function public.wcsb_relink_all_woo_products_to_blank_master()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row record;
  v_result jsonb;
  v_total integer := 0;
  v_linked integer := 0;
  v_unmatched integer := 0;
begin
  for v_row in select sku from public.products where sku is not null order by sku
  loop
    v_total := v_total + 1;
    v_result := public.wcsb_link_woo_product_to_blank_and_finished(v_row.sku);

    if coalesce((v_result->>'ok')::boolean, false) then
      v_linked := v_linked + 1;
    else
      v_unmatched := v_unmatched + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'processed', v_total, 'linked', v_linked, 'unmatched', v_unmatched);
end;
$$;

grant execute on function public.wcsb_relink_all_woo_products_to_blank_master()
to anon, authenticated;

create view public.woo_blank_match_diagnostics as
with product_data as (
  select
    p.id,
    p.sku,
    p.name,
    p.woocommerce_product_id,
    p.woocommerce_variation_id,
    p.brand_id,
    br.name as brand,
    p.product_type_id,
    pt.name as product_type,
    public.sc_infer_product_type_id_from_sku(p.sku) as inferred_product_type_id,
    ipt.name as inferred_product_type,
    p.color_id,
    c.name as color,
    p.size_id,
    s.name as size,
    p.blank_product_id,
    p.woo_link_status,
    p.woo_linked_at
  from public.products p
  left join public.brands br on br.id = p.brand_id
  left join public.product_types pt on pt.id = p.product_type_id
  left join public.product_types ipt on ipt.id = public.sc_infer_product_type_id_from_sku(p.sku)
  left join public.colors c on c.id = p.color_id
  left join public.sizes s on s.id = p.size_id
)
select
  pd.*,
  case
    when pd.blank_product_id is not null then 'linked'
    when exists (select 1 from public.woo_blank_match_candidates c where c.sku = pd.sku and c.match_score >= 750) then 'candidate_exists_not_linked'
    when pd.brand_id is null then 'missing_brand'
    when coalesce(pd.product_type_id, pd.inferred_product_type_id) is null then 'missing_style_product_type'
    when pd.color_id is null then 'missing_color'
    when pd.size_id is null then 'missing_size'
    else 'no_approved_blank_match'
  end as match_diagnostic
from product_data pd;

create view public.woo_products_unmatched_to_blank_master as
select *
from public.woo_blank_match_diagnostics
where blank_product_id is null;

grant select on public.woo_blank_match_candidates to anon, authenticated;
grant select on public.woo_blank_match_diagnostics to anon, authenticated;
grant select on public.woo_products_unmatched_to_blank_master to anon, authenticated;

-- Verify:
-- select * from public.color_alias_review_candidates order by affected_woo_products desc;
-- select public.wcsb_relink_all_woo_products_to_blank_master();
-- select match_diagnostic, count(*) from public.woo_blank_match_diagnostics group by 1 order by 2 desc;
