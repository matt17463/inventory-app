-- Skilled Crafting Inventory App 0.6.23
-- Non-inventory purchasing-report toggle — function return-type repair
--
-- This replacement migration is safe to run when
-- public.non_inventory_product_rules does not yet exist.
--
-- It separates:
--   inventory_required = whether the pull-sheet line reserves/deducts inventory
--   include_on_purchasing_report = whether the line contributes purchasing demand
--
-- Run this file instead of all earlier 07/08 versions of this migration.

begin;

-- =========================================================
-- 1. Required job_items columns
-- =========================================================

alter table public.job_items
  add column if not exists inventory_required boolean;

update public.job_items
set inventory_required = true
where inventory_required is null;

alter table public.job_items
  alter column inventory_required set default true;

alter table public.job_items
  alter column inventory_required set not null;


alter table public.job_items
  add column if not exists include_on_purchasing_report boolean;

update public.job_items
set include_on_purchasing_report = true
where include_on_purchasing_report is null;

alter table public.job_items
  alter column include_on_purchasing_report set default true;

alter table public.job_items
  alter column include_on_purchasing_report set not null;


alter table public.job_items
  add column if not exists non_inventory_reason text;

alter table public.job_items
  add column if not exists non_inventory_rule_id bigint;

alter table public.job_items
  add column if not exists non_inventory_marked_at timestamptz;


comment on column public.job_items.include_on_purchasing_report is
  'For a pull-sheet line, controls whether the line contributes purchasing demand independently of inventory tracking.';


-- =========================================================
-- 2. Create the reusable non-inventory rules table
-- =========================================================

create table if not exists public.non_inventory_product_rules (
  id bigserial primary key,
  rule_type text not null default 'exact_sku',
  match_value text not null,
  label text,
  reason text not null default 'No inventory tracking required for this WooCommerce item.',
  priority integer not null default 100,
  is_active boolean not null default true,
  include_on_purchasing_report boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.non_inventory_product_rules
  add column if not exists rule_type text;

alter table public.non_inventory_product_rules
  add column if not exists match_value text;

alter table public.non_inventory_product_rules
  add column if not exists label text;

alter table public.non_inventory_product_rules
  add column if not exists reason text;

alter table public.non_inventory_product_rules
  add column if not exists priority integer;

alter table public.non_inventory_product_rules
  add column if not exists is_active boolean;

alter table public.non_inventory_product_rules
  add column if not exists include_on_purchasing_report boolean;

alter table public.non_inventory_product_rules
  add column if not exists created_at timestamptz;

alter table public.non_inventory_product_rules
  add column if not exists updated_at timestamptz;


update public.non_inventory_product_rules
set
  rule_type = coalesce(nullif(trim(rule_type), ''), 'exact_sku'),
  match_value = coalesce(match_value, ''),
  reason = coalesce(
    nullif(trim(reason), ''),
    'No inventory tracking required for this WooCommerce item.'
  ),
  priority = coalesce(priority, 100),
  is_active = coalesce(is_active, true),
  include_on_purchasing_report = coalesce(include_on_purchasing_report, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.non_inventory_product_rules
  alter column rule_type set default 'exact_sku';

alter table public.non_inventory_product_rules
  alter column reason set default 'No inventory tracking required for this WooCommerce item.';

alter table public.non_inventory_product_rules
  alter column priority set default 100;

alter table public.non_inventory_product_rules
  alter column is_active set default true;

alter table public.non_inventory_product_rules
  alter column include_on_purchasing_report set default true;

alter table public.non_inventory_product_rules
  alter column created_at set default now();

alter table public.non_inventory_product_rules
  alter column updated_at set default now();


create index if not exists ix_non_inventory_rules_active_priority
  on public.non_inventory_product_rules (is_active, priority, id);

create index if not exists ix_non_inventory_rules_match
  on public.non_inventory_product_rules (
    lower(rule_type),
    lower(match_value)
  );


comment on table public.non_inventory_product_rules is
  'Reusable rules that mark matching WooCommerce or manual-order lines as non-inventory.';

comment on column public.non_inventory_product_rules.include_on_purchasing_report is
  'Controls whether lines matched by this non-inventory rule remain purchasing requirements.';


-- =========================================================
-- 3. Keep updated_at current
-- =========================================================

create or replace function public.sc_touch_non_inventory_rule_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_sc_touch_non_inventory_rule_updated_at
  on public.non_inventory_product_rules;

create trigger trg_sc_touch_non_inventory_rule_updated_at
before update on public.non_inventory_product_rules
for each row
execute function public.sc_touch_non_inventory_rule_updated_at();


-- =========================================================
-- 4. List and save rules
-- =========================================================

create or replace function public.sc_list_non_inventory_product_rules_v3()
returns setof public.non_inventory_product_rules
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.non_inventory_product_rules r
  order by r.priority asc, r.id asc;
$$;


create or replace function public.sc_save_non_inventory_product_rule_v3(
  p_rule_id_text text default null,
  p_rule_type text default 'exact_sku',
  p_match_value text default null,
  p_label text default null,
  p_reason text default null,
  p_priority integer default 100,
  p_is_active boolean default true,
  p_include_on_purchasing_report boolean default true
)
returns setof public.non_inventory_product_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id bigint;
  v_rule_type text := lower(trim(coalesce(p_rule_type, 'exact_sku')));
  v_match_value text := trim(coalesce(p_match_value, ''));
  v_reason text := coalesce(
    nullif(trim(coalesce(p_reason, '')), ''),
    'No inventory tracking required for this WooCommerce item.'
  );
begin
  if v_rule_type not in (
    'exact_sku',
    'sku_contains',
    'sku_prefix',
    'sku_regex',
    'woo_product_id',
    'woo_variation_id',
    'product_name_contains'
  ) then
    raise exception 'Unsupported non-inventory rule type: %', v_rule_type;
  end if;

  if v_match_value = '' then
    raise exception 'A non-inventory rule match value is required.';
  end if;

  if v_rule_type in ('woo_product_id', 'woo_variation_id')
     and v_match_value !~ '^[0-9]+$' then
    raise exception '% rules require a numeric match value.', v_rule_type;
  end if;

  if v_rule_type = 'sku_regex' then
    begin
      perform '' ~ v_match_value;
    exception
      when invalid_regular_expression then
        raise exception 'Invalid SKU regular expression: %', v_match_value;
    end;
  end if;

  if nullif(trim(coalesce(p_rule_id_text, '')), '') is not null then
    if trim(p_rule_id_text) !~ '^[0-9]+$' then
      raise exception 'Invalid non-inventory rule ID: %', p_rule_id_text;
    end if;

    v_rule_id := trim(p_rule_id_text)::bigint;

    update public.non_inventory_product_rules
    set
      rule_type = v_rule_type,
      match_value = v_match_value,
      label = nullif(trim(coalesce(p_label, '')), ''),
      reason = v_reason,
      priority = coalesce(p_priority, 100),
      is_active = coalesce(p_is_active, true),
      include_on_purchasing_report =
        coalesce(p_include_on_purchasing_report, true),
      updated_at = now()
    where id = v_rule_id;

    if not found then
      raise exception 'Non-inventory rule % was not found.', v_rule_id;
    end if;
  else
    select r.id
    into v_rule_id
    from public.non_inventory_product_rules r
    where lower(trim(r.rule_type)) = v_rule_type
      and lower(trim(r.match_value)) = lower(v_match_value)
    order by r.id desc
    limit 1;

    if v_rule_id is null then
      insert into public.non_inventory_product_rules (
        rule_type,
        match_value,
        label,
        reason,
        priority,
        is_active,
        include_on_purchasing_report
      )
      values (
        v_rule_type,
        v_match_value,
        nullif(trim(coalesce(p_label, '')), ''),
        v_reason,
        coalesce(p_priority, 100),
        coalesce(p_is_active, true),
        coalesce(p_include_on_purchasing_report, true)
      )
      returning id into v_rule_id;
    else
      update public.non_inventory_product_rules
      set
        label = nullif(trim(coalesce(p_label, label, '')), ''),
        reason = v_reason,
        priority = coalesce(p_priority, priority, 100),
        is_active = coalesce(p_is_active, is_active, true),
        include_on_purchasing_report =
          coalesce(
            p_include_on_purchasing_report,
            include_on_purchasing_report,
            true
          ),
        updated_at = now()
      where id = v_rule_id;
    end if;
  end if;

  return query
  select r.*
  from public.non_inventory_product_rules r
  where r.id = v_rule_id;
end
$$;


-- PostgreSQL cannot change an existing function's return type with
-- CREATE OR REPLACE FUNCTION. Remove the older signature first.
drop function if exists public.sc_set_non_inventory_rule_active_v2(
  text,
  boolean
);

create function public.sc_set_non_inventory_rule_active_v2(
  p_rule_id_text text,
  p_is_active boolean
)
returns setof public.non_inventory_product_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id bigint;
begin
  if trim(coalesce(p_rule_id_text, '')) !~ '^[0-9]+$' then
    raise exception 'Invalid non-inventory rule ID: %', p_rule_id_text;
  end if;

  v_rule_id := trim(p_rule_id_text)::bigint;

  update public.non_inventory_product_rules
  set
    is_active = coalesce(p_is_active, false),
    updated_at = now()
  where id = v_rule_id;

  if not found then
    raise exception 'Non-inventory rule % was not found.', v_rule_id;
  end if;

  return query
  select r.*
  from public.non_inventory_product_rules r
  where r.id = v_rule_id;
end
$$;


-- =========================================================
-- 5. Rule lookup used by WooCommerce/manual-pullsheet functions
-- =========================================================

drop function if exists public.sc_find_non_inventory_rule_for_line(
  text,
  bigint,
  bigint,
  text
);

create function public.sc_find_non_inventory_rule_for_line(
  p_sku text default null,
  p_woo_product_id bigint default null,
  p_woo_variation_id bigint default null,
  p_product_name text default null
)
returns table (
  rule_id bigint,
  rule_type text,
  match_value text,
  label text,
  reason text,
  priority integer,
  include_on_purchasing_report boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as rule_id,
    r.rule_type,
    r.match_value,
    r.label,
    r.reason,
    r.priority,
    r.include_on_purchasing_report
  from public.non_inventory_product_rules r
  where r.is_active = true
    and (
      (
        lower(r.rule_type) = 'exact_sku'
        and lower(trim(coalesce(p_sku, ''))) =
            lower(trim(r.match_value))
      )
      or (
        lower(r.rule_type) = 'sku_contains'
        and lower(coalesce(p_sku, '')) like
            '%' || lower(r.match_value) || '%'
      )
      or (
        lower(r.rule_type) = 'sku_prefix'
        and lower(coalesce(p_sku, '')) like
            lower(r.match_value) || '%'
      )
      or (
        lower(r.rule_type) = 'sku_regex'
        and coalesce(p_sku, '') ~* r.match_value
      )
      or (
        lower(r.rule_type) = 'woo_product_id'
        and p_woo_product_id is not null
        and r.match_value ~ '^[0-9]+$'
        and p_woo_product_id = r.match_value::bigint
      )
      or (
        lower(r.rule_type) = 'woo_variation_id'
        and p_woo_variation_id is not null
        and r.match_value ~ '^[0-9]+$'
        and p_woo_variation_id = r.match_value::bigint
      )
      or (
        lower(r.rule_type) = 'product_name_contains'
        and lower(coalesce(p_product_name, '')) like
            '%' || lower(r.match_value) || '%'
      )
    )
  order by r.priority asc, r.id asc
  limit 1;
$$;


-- =========================================================
-- 6. Automatically apply a saved rule's purchasing choice
--    when a webhook creates a non-inventory job item
-- =========================================================

create or replace function public.sc_job_item_rule_purchasing_flag()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_include boolean;
begin
  if new.inventory_required = false
     and new.non_inventory_rule_id is not null then
    select r.include_on_purchasing_report
    into v_include
    from public.non_inventory_product_rules r
    where r.id::text = new.non_inventory_rule_id::text
    limit 1;

    if found then
      new.include_on_purchasing_report := coalesce(v_include, true);
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_sc_job_item_rule_purchasing_flag_insert
  on public.job_items;

create trigger trg_sc_job_item_rule_purchasing_flag_insert
before insert on public.job_items
for each row
execute function public.sc_job_item_rule_purchasing_flag();

drop trigger if exists trg_sc_job_item_rule_purchasing_flag_update
  on public.job_items;

create trigger trg_sc_job_item_rule_purchasing_flag_update
before update of non_inventory_rule_id, inventory_required
on public.job_items
for each row
when (
  old.non_inventory_rule_id is distinct from new.non_inventory_rule_id
  or old.inventory_required is distinct from new.inventory_required
)
execute function public.sc_job_item_rule_purchasing_flag();


-- =========================================================
-- 7. Mark one pull-sheet line as non-inventory
-- =========================================================

create or replace function public.sc_mark_job_item_non_inventory_v2(
  p_job_item_id bigint,
  p_reason text default null,
  p_create_future_rule boolean default false,
  p_rule_type text default 'exact_sku',
  p_rule_match_value text default null,
  p_include_on_purchasing_report boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.job_items%rowtype;
  v_rule_id bigint;
  v_match_value text;
  v_reason text := coalesce(
    nullif(trim(coalesce(p_reason, '')), ''),
    'No inventory tracking required for this WooCommerce item.'
  );
begin
  select *
  into v_item
  from public.job_items
  where id = p_job_item_id
  for update;

  if not found then
    raise exception 'Pull-sheet line % was not found.', p_job_item_id;
  end if;

  v_match_value := nullif(trim(coalesce(p_rule_match_value, '')), '');

  if coalesce(p_create_future_rule, false) then
    if v_match_value is null then
      case lower(trim(coalesce(p_rule_type, 'exact_sku')))
        when 'woo_product_id' then
          v_match_value := nullif(v_item.woocommerce_product_id::text, '');
        when 'woo_variation_id' then
          v_match_value := nullif(v_item.woocommerce_variation_id::text, '');
        when 'product_name_contains' then
          v_match_value := nullif(
            trim(coalesce(v_item.item_name, v_item.name, '')),
            ''
          );
        else
          v_match_value := nullif(
            trim(coalesce(v_item.order_sku, v_item.sku, '')),
            ''
          );
      end case;
    end if;

    if v_match_value is null then
      raise exception
        'A future rule could not be created because this line has no usable match value.';
    end if;

    select r.id
    into v_rule_id
    from public.sc_save_non_inventory_product_rule_v3(
      null,
      coalesce(p_rule_type, 'exact_sku'),
      v_match_value,
      null,
      v_reason,
      100,
      true,
      coalesce(p_include_on_purchasing_report, true)
    ) r
    limit 1;
  end if;

  -- Preserve the behavior of an older installation when its original
  -- non-inventory function is available, including reservation cleanup.
  if to_regprocedure(
       'public.sc_mark_job_item_non_inventory(bigint,text,boolean,text,text)'
     ) is not null then
    execute
      'select 1
         from public.sc_mark_job_item_non_inventory($1,$2,$3,$4,$5)
         limit 1'
    using
      p_job_item_id,
      v_reason,
      false,
      coalesce(p_rule_type, 'exact_sku'),
      v_match_value;
  else
    update public.job_items
    set
      inventory_required = false,
      non_inventory_reason = v_reason,
      non_inventory_marked_at = now(),
      selected_bin_id = null
    where id = p_job_item_id;

    -- Release active reservations when the standard reservation table exists.
    if to_regclass('public.inventory_reservations') is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'inventory_reservations'
           and column_name = 'job_item_id'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'inventory_reservations'
           and column_name = 'status'
       ) then
      execute
        'update public.inventory_reservations
            set status = ''released''
          where job_item_id::text = $1::text
            and lower(coalesce(status, '''')) not in
                (''released'', ''completed'', ''cancelled'', ''void'')'
      using p_job_item_id;
    end if;
  end if;

  update public.job_items
  set
    inventory_required = false,
    include_on_purchasing_report =
      coalesce(p_include_on_purchasing_report, true),
    non_inventory_reason = v_reason,
    non_inventory_rule_id =
      coalesce(v_rule_id, non_inventory_rule_id),
    non_inventory_marked_at = now(),
    selected_bin_id = null
  where id = p_job_item_id;

  return jsonb_build_object(
    'success', true,
    'job_item_id', p_job_item_id,
    'inventory_required', false,
    'include_on_purchasing_report',
      coalesce(p_include_on_purchasing_report, true),
    'non_inventory_rule_id', v_rule_id
  );
end
$$;


-- =========================================================
-- 8. Apply rules to one pull sheet
-- =========================================================

create or replace function public.sc_apply_non_inventory_rules_to_job_v2(
  p_job_id bigint
)
returns setof public.job_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.job_items%rowtype;
  v_rule record;
  v_updated_ids bigint[] := array[]::bigint[];
begin
  for v_item in
    select ji.*
    from public.job_items ji
    where ji.job_id = p_job_id
      and lower(coalesce(ji.status, '')) !~ '(complete|cancel|void|deduct)'
    order by ji.id
  loop
    select *
    into v_rule
    from public.sc_find_non_inventory_rule_for_line(
      coalesce(v_item.order_sku, v_item.sku),
      v_item.woocommerce_product_id,
      v_item.woocommerce_variation_id,
      coalesce(v_item.item_name, v_item.name)
    )
    limit 1;

    if v_rule.rule_id is not null then
      perform public.sc_mark_job_item_non_inventory_v2(
        v_item.id,
        v_rule.reason,
        false,
        v_rule.rule_type,
        v_rule.match_value,
        v_rule.include_on_purchasing_report
      );

      update public.job_items
      set non_inventory_rule_id = v_rule.rule_id
      where id = v_item.id;

      v_updated_ids := array_append(v_updated_ids, v_item.id);
    end if;
  end loop;

  return query
  select ji.*
  from public.job_items ji
  where ji.id = any(v_updated_ids)
  order by ji.id;
end
$$;


-- =========================================================
-- 9. Apply rules to open pull sheets
-- =========================================================

create or replace function public.sc_apply_non_inventory_rules_to_open_jobs_v2(
  p_limit integer default 500
)
returns setof public.job_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.job_items%rowtype;
  v_rule record;
  v_updated_ids bigint[] := array[]::bigint[];
begin
  for v_item in
    select ji.*
    from public.job_items ji
    join public.jobs j on j.id = ji.job_id
    where lower(coalesce(j.status, '')) !~ '(complete|cancel|void)'
      and lower(coalesce(ji.status, '')) !~ '(complete|cancel|void|deduct)'
    order by ji.id
    limit greatest(coalesce(p_limit, 500), 1)
  loop
    select *
    into v_rule
    from public.sc_find_non_inventory_rule_for_line(
      coalesce(v_item.order_sku, v_item.sku),
      v_item.woocommerce_product_id,
      v_item.woocommerce_variation_id,
      coalesce(v_item.item_name, v_item.name)
    )
    limit 1;

    if v_rule.rule_id is not null then
      perform public.sc_mark_job_item_non_inventory_v2(
        v_item.id,
        v_rule.reason,
        false,
        v_rule.rule_type,
        v_rule.match_value,
        v_rule.include_on_purchasing_report
      );

      update public.job_items
      set non_inventory_rule_id = v_rule.rule_id
      where id = v_item.id;

      v_updated_ids := array_append(v_updated_ids, v_item.id);
    end if;
  end loop;

  return query
  select ji.*
  from public.job_items ji
  where ji.id = any(v_updated_ids)
  order by ji.id;
end
$$;


-- =========================================================
-- 10. Permissions
-- =========================================================

grant select on public.non_inventory_product_rules
  to authenticated, service_role;

grant usage, select on sequence
  public.non_inventory_product_rules_id_seq
  to authenticated, service_role;

grant execute on function
  public.sc_list_non_inventory_product_rules_v3()
  to authenticated, service_role;

grant execute on function
  public.sc_save_non_inventory_product_rule_v3(
    text, text, text, text, text, integer, boolean, boolean
  )
  to authenticated, service_role;

grant execute on function
  public.sc_set_non_inventory_rule_active_v2(text, boolean)
  to authenticated, service_role;

grant execute on function
  public.sc_find_non_inventory_rule_for_line(
    text, bigint, bigint, text
  )
  to authenticated, service_role;

grant execute on function
  public.sc_mark_job_item_non_inventory_v2(
    bigint, text, boolean, text, text, boolean
  )
  to authenticated, service_role;

grant execute on function
  public.sc_apply_non_inventory_rules_to_job_v2(bigint)
  to authenticated, service_role;

grant execute on function
  public.sc_apply_non_inventory_rules_to_open_jobs_v2(integer)
  to authenticated, service_role;

commit;


-- =========================================================
-- Verification
-- =========================================================

select
  to_regclass('public.non_inventory_product_rules') is not null
    as rules_table_installed,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'job_items'
      and column_name = 'include_on_purchasing_report'
  ) as job_item_toggle_installed,
  to_regprocedure(
    'public.sc_mark_job_item_non_inventory_v2(bigint,text,boolean,text,text,boolean)'
  ) is not null as mark_function_installed,
  to_regprocedure(
    'public.sc_apply_non_inventory_rules_to_job_v2(bigint)'
  ) is not null as apply_job_function_installed,
  to_regprocedure(
    'public.sc_apply_non_inventory_rules_to_open_jobs_v2(integer)'
  ) is not null as apply_open_jobs_function_installed;
