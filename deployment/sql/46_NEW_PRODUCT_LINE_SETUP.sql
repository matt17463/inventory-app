-- Skilled Crafting Inventory v1.3.0
-- New Product Line Setup
--
-- Creates zero-on-hand blank catalog definitions without recording fake
-- inventory. Existing exact blanks are reused. Duplicate, archived, and SKU
-- conflicts block the entire operation before any row is created.
--
-- Prerequisites:
--   40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql
--   44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql

begin;

do $$
begin
  if to_regprocedure('public.sc_create_blank_product_safe_v1(jsonb,uuid)') is null then
    raise exception 'Run deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql first.';
  end if;
  if to_regclass('public.sc_core_mutation_audit') is null then
    raise exception 'Run deployment/sql/28_APPLICATION_INTEGRITY_PLATFORM.sql first.';
  end if;
  if to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)') is null then
    raise exception 'Run deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql first.';
  end if;
end;
$$;

create table if not exists public.sc_product_line_setups (
  id uuid primary key default gen_random_uuid(),
  line_name text not null,
  brand_id bigint not null references public.brands(id) on delete restrict,
  product_type_id bigint not null references public.product_types(id) on delete restrict,
  color_ids bigint[] not null default '{}'::bigint[],
  size_ids bigint[] not null default '{}'::bigint[],
  default_unit_cost numeric not null default 0 check (default_unit_cost >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  cost_review_required boolean not null default false,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  created_count integer not null default 0,
  reused_count integer not null default 0,
  woo_products_linked integer not null default 0,
  result_summary jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.sc_product_line_setups enable row level security;
revoke all on table public.sc_product_line_setups from public, anon, authenticated;
grant all on table public.sc_product_line_setups to service_role;

alter table public.blank_products
  add column if not exists sc_product_line_setup_id uuid,
  add column if not exists sc_cost_review_required boolean not null default false,
  add column if not exists sc_creation_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'blank_products_sc_product_line_setup_fk'
      and conrelid = 'public.blank_products'::regclass
  ) then
    alter table public.blank_products
      add constraint blank_products_sc_product_line_setup_fk
      foreign key (sc_product_line_setup_id)
      references public.sc_product_line_setups(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists ix_blank_products_product_line_setup
  on public.blank_products(sc_product_line_setup_id)
  where sc_product_line_setup_id is not null;

create or replace function public.sc_product_line_sku_piece_v1(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(both '-' from regexp_replace(upper(trim(coalesce(p_value, ''))), '[^A-Z0-9]+', '-', 'g'));
$$;

create or replace function public.sc_preview_new_product_line_v1(
  p_line_name text,
  p_brand_id bigint,
  p_product_type_id bigint,
  p_color_ids bigint[],
  p_size_ids bigint[],
  p_unit_cost numeric default 0,
  p_low_stock_threshold integer default 0,
  p_cost_review_required boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_brand public.brands%rowtype;
  v_style public.product_types%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb;
  v_token text;
begin
  if nullif(trim(coalesce(p_line_name, '')), '') is null then
    raise exception 'Enter a product-line name.';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost must be zero or greater.';
  end if;
  if coalesce(p_low_stock_threshold, 0) < 0 then
    raise exception 'Low-stock threshold must be zero or greater.';
  end if;
  if cardinality(coalesce(p_color_ids, '{}'::bigint[])) = 0 then
    raise exception 'Choose at least one color.';
  end if;
  if cardinality(coalesce(p_size_ids, '{}'::bigint[])) = 0 then
    raise exception 'Choose at least one size.';
  end if;

  select * into v_brand from public.brands where id = p_brand_id;
  if not found then raise exception 'The selected brand was not found.'; end if;
  select * into v_style from public.product_types where id = p_product_type_id;
  if not found then raise exception 'The selected style was not found.'; end if;

  if exists (
    select 1 from unnest(p_color_ids) requested(id)
    left join public.colors c on c.id = requested.id
    where c.id is null
  ) then raise exception 'One or more selected colors no longer exist.'; end if;
  if exists (
    select 1 from unnest(p_size_ids) requested(id)
    left join public.sizes s on s.id = requested.id
    where s.id is null
  ) then raise exception 'One or more selected sizes no longer exist.'; end if;

  with requested_colors as (
    select distinct unnest(p_color_ids) color_id
  ), requested_sizes as (
    select distinct unnest(p_size_ids) size_id
  ), matrix as (
    select
      c.id color_id,
      c.name color_name,
      c.code color_code,
      s.id size_id,
      s.name size_name,
      s.code size_code,
      concat_ws('-',
        public.sc_product_line_sku_piece_v1(coalesce(nullif(v_brand.code, ''), v_brand.name)),
        public.sc_product_line_sku_piece_v1(coalesce(nullif(v_style.code, ''), v_style.name)),
        public.sc_product_line_sku_piece_v1(coalesce(nullif(c.code, ''), c.name)),
        public.sc_product_line_sku_piece_v1(coalesce(nullif(s.code, ''), s.name))
      ) generated_sku,
      concat_ws(' ', v_brand.name, v_style.name, c.name, s.name) generated_name
    from requested_colors rc
    join public.colors c on c.id = rc.color_id
    cross join requested_sizes rs
    join public.sizes s on s.id = rs.size_id
  ), analyzed as (
    select
      matrix.*,
      active_match.match_count active_match_count,
      active_match.blank_product_id,
      archived_match.match_count archived_match_count,
      sku_match.match_count sku_conflict_count,
      woo_match.match_count woo_match_count
    from matrix
    cross join lateral (
      select count(*)::integer match_count, (array_agg(bp.id order by bp.id))[1] blank_product_id
      from public.blank_products bp
      where bp.brand_id = p_brand_id
        and bp.product_type_id = p_product_type_id
        and bp.color_id = matrix.color_id
        and bp.size_id = matrix.size_id
        and coalesce(bp.sc_is_archived, false) = false
    ) active_match
    cross join lateral (
      select count(*)::integer match_count
      from public.blank_products bp
      where bp.brand_id = p_brand_id
        and bp.product_type_id = p_product_type_id
        and bp.color_id = matrix.color_id
        and bp.size_id = matrix.size_id
        and coalesce(bp.sc_is_archived, false) = true
    ) archived_match
    cross join lateral (
      select count(*)::integer match_count
      from public.blank_products bp
      where public.sc_mapping_norm_v1(bp.sku_base) = public.sc_mapping_norm_v1(matrix.generated_sku)
        and coalesce(bp.sc_is_archived, false) = false
        and not (
          bp.brand_id = p_brand_id and bp.product_type_id = p_product_type_id
          and bp.color_id = matrix.color_id and bp.size_id = matrix.size_id
        )
    ) sku_match
    cross join lateral (
      select count(*)::integer match_count
      from public.products p
      where p.brand_id = p_brand_id
        and p.product_type_id = p_product_type_id
        and p.color_id = matrix.color_id
        and p.size_id = matrix.size_id
    ) woo_match
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'color_id', color_id,
    'color_name', color_name,
    'size_id', size_id,
    'size_name', size_name,
    'sku_base', generated_sku,
    'name', generated_name,
    'unit_cost', p_unit_cost,
    'low_stock_threshold', coalesce(p_low_stock_threshold, 0),
    'cost_review_required', coalesce(p_cost_review_required, false),
    'status', case
      when active_match_count > 1 then 'ambiguous_active'
      when active_match_count = 1 then 'existing'
      when archived_match_count > 0 then 'archived_match'
      when sku_conflict_count > 0 then 'sku_conflict'
      else 'create'
    end,
    'blank_product_id', blank_product_id,
    'active_match_count', active_match_count,
    'archived_match_count', archived_match_count,
    'sku_conflict_count', sku_conflict_count,
    'woo_match_count', woo_match_count
  ) order by color_name, size_name), '[]'::jsonb)
  into v_rows
  from analyzed;

  select jsonb_build_object(
    'total', count(*),
    'create_count', count(*) filter (where value->>'status' = 'create'),
    'existing_count', count(*) filter (where value->>'status' = 'existing'),
    'blocked_count', count(*) filter (where value->>'status' not in ('create','existing')),
    'woo_match_count', coalesce(sum((value->>'woo_match_count')::integer), 0)
  ) into v_summary
  from jsonb_array_elements(v_rows);

  v_token := md5(concat_ws('|',
    trim(p_line_name), p_brand_id::text, p_product_type_id::text,
    p_unit_cost::text, coalesce(p_low_stock_threshold, 0)::text,
    coalesce(p_cost_review_required, false)::text, v_rows::text
  ));

  return jsonb_build_object(
    'line_name', trim(p_line_name),
    'brand', jsonb_build_object('id', v_brand.id, 'name', v_brand.name, 'code', v_brand.code),
    'style', jsonb_build_object('id', v_style.id, 'name', v_style.name, 'code', v_style.code),
    'rows', v_rows,
    'summary', v_summary,
    'preview_token', v_token,
    'safe_to_apply', coalesce((v_summary->>'blocked_count')::integer, 0) = 0
  );
end;
$$;

create or replace function public.sc_apply_new_product_line_v1(
  p_line_name text,
  p_brand_id bigint,
  p_product_type_id bigint,
  p_color_ids bigint[],
  p_size_ids bigint[],
  p_unit_cost numeric,
  p_low_stock_threshold integer,
  p_cost_review_required boolean,
  p_preview_token text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_preview jsonb;
  v_setup_id uuid;
  v_item jsonb;
  v_creation jsonb;
  v_blank_id uuid;
  v_created integer := 0;
  v_reused integer := 0;
  v_linked integer := 0;
  v_changed integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('sc-product-line:' || p_brand_id::text || ':' || p_product_type_id::text));

  v_preview := public.sc_preview_new_product_line_v1(
    p_line_name, p_brand_id, p_product_type_id, p_color_ids, p_size_ids,
    p_unit_cost, p_low_stock_threshold, p_cost_review_required
  );

  if nullif(trim(coalesce(p_preview_token, '')), '') is null
     or p_preview_token <> v_preview->>'preview_token' then
    raise exception 'The product-line preview changed. Preview it again before creating blanks.';
  end if;
  if not coalesce((v_preview->>'safe_to_apply')::boolean, false) then
    raise exception 'The product line contains duplicate, archived, or SKU conflicts. Resolve every blocked row first.';
  end if;

  insert into public.sc_product_line_setups(
    line_name, brand_id, product_type_id, color_ids, size_ids,
    default_unit_cost, low_stock_threshold, cost_review_required, created_by
  ) values (
    trim(p_line_name), p_brand_id, p_product_type_id,
    (select array_agg(distinct id order by id) from unnest(p_color_ids) id),
    (select array_agg(distinct id order by id) from unnest(p_size_ids) id),
    p_unit_cost, coalesce(p_low_stock_threshold, 0), coalesce(p_cost_review_required, false), p_actor
  ) returning id into v_setup_id;

  for v_item in select value from jsonb_array_elements(v_preview->'rows')
  loop
    if v_item->>'status' = 'existing' then
      v_blank_id := (v_item->>'blank_product_id')::uuid;
      v_reused := v_reused + 1;
    else
      v_creation := public.sc_create_blank_product_safe_v1(
        jsonb_build_object(
          'sku_base', v_item->>'sku_base',
          'name', v_item->>'name',
          'brand_id', p_brand_id,
          'product_type_id', p_product_type_id,
          'color_id', (v_item->>'color_id')::bigint,
          'size_id', (v_item->>'size_id')::bigint,
          'unit_cost', p_unit_cost,
          'low_stock_threshold', coalesce(p_low_stock_threshold, 0)
        ),
        p_actor
      );
      if coalesce((v_creation->>'success')::boolean, false) is not true then
        raise exception 'Creation was blocked for %. Preview the product line again.', v_item->>'sku_base';
      end if;
      v_blank_id := (v_creation->'blank'->>'id')::uuid;
      update public.blank_products
      set sc_product_line_setup_id = v_setup_id,
          sc_cost_review_required = coalesce(p_cost_review_required, false),
          sc_creation_source = 'new_product_line_setup'
      where id = v_blank_id;
      v_created := v_created + 1;
    end if;

    update public.products
    set blank_product_id = v_blank_id
    where blank_product_id is null
      and brand_id = p_brand_id
      and product_type_id = p_product_type_id
      and color_id = (v_item->>'color_id')::bigint
      and size_id = (v_item->>'size_id')::bigint;
    get diagnostics v_changed = row_count;
    v_linked := v_linked + v_changed;
  end loop;

  update public.sc_product_line_setups
  set created_count = v_created,
      reused_count = v_reused,
      woo_products_linked = v_linked,
      result_summary = jsonb_build_object(
        'created_count', v_created,
        'reused_count', v_reused,
        'woo_products_linked', v_linked,
        'zero_on_hand', true,
        'inventory_movements_created', 0
      )
  where id = v_setup_id;

  insert into public.sc_core_mutation_audit(
    action, entity_type, entity_id_text, actor_user_id, after_snapshot, reason
  ) values (
    'create', 'product_line_setup', v_setup_id::text, p_actor,
    jsonb_build_object('preview', v_preview, 'created_count', v_created, 'reused_count', v_reused, 'woo_products_linked', v_linked),
    'New Product Line Setup: zero-on-hand blank definitions'
  );

  return jsonb_build_object(
    'success', true,
    'setup_id', v_setup_id,
    'created_count', v_created,
    'reused_count', v_reused,
    'woo_products_linked', v_linked,
    'zero_on_hand', true,
    'inventory_movements_created', 0,
    'message', format('Created %s blank definitions, reused %s, and linked %s WooCommerce product rows.', v_created, v_reused, v_linked)
  );
end;
$$;

revoke all on function public.sc_product_line_sku_piece_v1(text) from public, anon;
revoke all on function public.sc_preview_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean) from public, anon, authenticated;
revoke all on function public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid) from public, anon, authenticated;

grant execute on function public.sc_product_line_sku_piece_v1(text) to service_role;
grant execute on function public.sc_preview_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean) to service_role;
grant execute on function public.sc_apply_new_product_line_v1(text,bigint,bigint,bigint[],bigint[],numeric,integer,boolean,text,uuid) to service_role;

commit;
