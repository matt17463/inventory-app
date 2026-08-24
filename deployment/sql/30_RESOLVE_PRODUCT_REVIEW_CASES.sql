-- Skilled Crafting Inventory v1.0.2
-- Guarded duplicate blank-product case resolution.
--
-- SAFETY CONTRACT
--   * Run after 27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql and
--     28_APPLICATION_INTEGRITY_PLATFORM.sql.
--   * Never changes an inventory quantity or deletes an inventory movement.
--   * Repoints references to the selected survivor in one transaction.
--   * Archives duplicate blank-product rows; it never deletes them.
--   * Requires a fresh preview and an exact confirmation phrase.
--   * Any constraint failure rolls back the complete resolution.

begin;

create extension if not exists pgcrypto;

alter table public.blank_products
  add column if not exists sc_is_archived boolean not null default false,
  add column if not exists sc_archived_at timestamptz,
  add column if not exists sc_archived_by uuid references auth.users(id) on delete set null,
  add column if not exists sc_archived_reason text,
  add column if not exists sc_archived_original_sku text,
  add column if not exists sc_archived_original_barcode text,
  add column if not exists sc_archived_original_name text;

-- blank_products.id is UUID in the production schema. Repair an empty column
-- left by an interrupted/partial earlier attempt, then enforce the same type.
do $$
declare
  v_data_type text;
  v_non_null_count bigint;
begin
  select column_row.data_type into v_data_type
  from information_schema.columns column_row
  where column_row.table_schema = 'public'
    and column_row.table_name = 'blank_products'
    and column_row.column_name = 'sc_canonical_blank_product_id';

  if v_data_type is null then
    alter table public.blank_products
      add column sc_canonical_blank_product_id uuid;
  elsif v_data_type <> 'uuid' then
    execute 'select count(*) from public.blank_products where sc_canonical_blank_product_id is not null'
      into v_non_null_count;
    if v_non_null_count > 0 then
      raise exception 'sc_canonical_blank_product_id has type % and contains data. Stop and contact support before converting it to UUID.', v_data_type;
    end if;
    alter table public.blank_products
      alter column sc_canonical_blank_product_id type uuid using null::uuid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'blank_products_sc_canonical_blank_product_fk'
      and conrelid = 'public.blank_products'::regclass
  ) then
    alter table public.blank_products
      add constraint blank_products_sc_canonical_blank_product_fk
      foreign key (sc_canonical_blank_product_id)
      references public.blank_products(id)
      on delete restrict;
  end if;
end
$$;

create index if not exists ix_blank_products_sc_active
  on public.blank_products(id)
  where sc_is_archived is false;

create index if not exists ix_blank_products_sc_canonical
  on public.blank_products(sc_canonical_blank_product_id)
  where sc_is_archived is true;

-- Migration 28 originally installed a bigint overload. Production blank
-- products use UUID identifiers, so replace that unusable overload.
drop function if exists public.sc_update_blank_product_safe_v1(bigint,jsonb,uuid);

create or replace function public.sc_update_blank_product_safe_v1(
  p_blank_product_id uuid,
  p_payload jsonb,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.blank_products%rowtype;
  v_after public.blank_products%rowtype;
  v_conflict uuid;
begin
  select * into v_before
  from public.blank_products
  where id = p_blank_product_id and sc_is_archived is false
  for update;
  if not found then
    raise exception 'Active blank product % was not found.', p_blank_product_id;
  end if;

  select bp.id into v_conflict
  from public.blank_products bp
  where bp.id <> p_blank_product_id
    and bp.sc_is_archived is false
    and (
      (public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base', v_before.sku_base::text)) <> '' and
       public.sc_identity_norm_v1(bp.sku_base::text) = public.sc_identity_norm_v1(coalesce(p_payload->>'sku_base', v_before.sku_base::text)))
      or
      (public.sc_identity_norm_v1(coalesce(p_payload->>'barcode', v_before.barcode::text)) <> '' and
       public.sc_identity_norm_v1(bp.barcode::text) = public.sc_identity_norm_v1(coalesce(p_payload->>'barcode', v_before.barcode::text)))
      or
      (bp.brand_id = coalesce(nullif(p_payload->>'brand_id','')::bigint, v_before.brand_id)
       and bp.product_type_id = coalesce(nullif(p_payload->>'product_type_id','')::bigint, v_before.product_type_id)
       and bp.color_id = coalesce(nullif(p_payload->>'color_id','')::bigint, v_before.color_id)
       and bp.size_id = coalesce(nullif(p_payload->>'size_id','')::bigint, v_before.size_id))
    )
  limit 1;

  if v_conflict is not null then
    return jsonb_build_object(
      'success', false,
      'blocked', true,
      'conflicting_blank_product_id', v_conflict,
      'message', 'This edit would create a duplicate SKU, barcode, or complete product identity.'
    );
  end if;

  update public.blank_products set
    sku_base = upper(trim(coalesce(p_payload->>'sku_base', v_before.sku_base::text))),
    name = trim(coalesce(p_payload->>'name', v_before.name::text)),
    barcode = case when p_payload ? 'barcode' then nullif(trim(p_payload->>'barcode'),'') else v_before.barcode end,
    brand_id = case when p_payload ? 'brand_id' then nullif(p_payload->>'brand_id','')::bigint else v_before.brand_id end,
    product_type_id = case when p_payload ? 'product_type_id' then nullif(p_payload->>'product_type_id','')::bigint else v_before.product_type_id end,
    color_id = case when p_payload ? 'color_id' then nullif(p_payload->>'color_id','')::bigint else v_before.color_id end,
    size_id = case when p_payload ? 'size_id' then nullif(p_payload->>'size_id','')::bigint else v_before.size_id end,
    image_url = case when p_payload ? 'image_url' then nullif(trim(p_payload->>'image_url'),'') else v_before.image_url end,
    unit_cost = case when p_payload ? 'unit_cost' then nullif(p_payload->>'unit_cost','')::numeric else v_before.unit_cost end,
    low_stock_threshold = case when p_payload ? 'low_stock_threshold' then nullif(p_payload->>'low_stock_threshold','')::integer else v_before.low_stock_threshold end
  where id = p_blank_product_id
  returning * into v_after;

  insert into public.sc_core_mutation_audit(
    action, entity_type, entity_id_text, actor_user_id,
    before_snapshot, after_snapshot, reason
  ) values (
    'update', 'blank_product', p_blank_product_id::text, p_actor,
    to_jsonb(v_before), to_jsonb(v_after), 'Guarded product update'
  );

  return jsonb_build_object('success', true, 'blank', to_jsonb(v_after));
end;
$$;

revoke all on function public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)
from public, anon, authenticated;
grant execute on function public.sc_update_blank_product_safe_v1(uuid,jsonb,uuid)
to service_role;

alter table public.sc_product_review_cases
  add column if not exists resolved_survivor_id_text text,
  add column if not exists resolution_preview jsonb,
  add column if not exists resolution_summary jsonb,
  add column if not exists resolution_started_at timestamptz,
  add column if not exists resolution_completed_at timestamptz;

create table if not exists public.sc_product_resolution_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.sc_product_review_cases(id) on delete restrict,
  status text not null default 'ready'
    check (status in ('ready','applying','completed','expired','cancelled','failed')),
  survivor_id_text text not null,
  duplicate_ids_text jsonb not null default '[]'::jsonb,
  preview_hash text not null,
  preview jsonb not null,
  confirmation_phrase text not null,
  requested_by uuid references auth.users(id) on delete set null,
  applied_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  applied_at timestamptz,
  result jsonb,
  error_message text
);

create index if not exists ix_sc_product_resolution_runs_case
  on public.sc_product_resolution_runs(case_id, created_at desc);

alter table public.sc_product_resolution_runs enable row level security;
revoke all on public.sc_product_resolution_runs from public, anon, authenticated;
grant select, insert, update on public.sc_product_resolution_runs to service_role;

create or replace function public.sc_blank_product_reference_targets_v1()
returns table (
  target_schema text,
  target_table text,
  target_column text,
  reference_kind text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with foreign_key_targets as (
    select
      ns.nspname::text as target_schema,
      rel.relname::text as target_table,
      source_attribute.attname::text as target_column,
      'foreign_key'::text as reference_kind
    from pg_constraint constraint_row
    join pg_class rel on rel.oid = constraint_row.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_attribute source_attribute
      on source_attribute.attrelid = constraint_row.conrelid
     and source_attribute.attnum = constraint_row.conkey[1]
    join pg_attribute referenced_attribute
      on referenced_attribute.attrelid = constraint_row.confrelid
     and referenced_attribute.attnum = constraint_row.confkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.blank_products'::regclass
      and array_length(constraint_row.conkey, 1) = 1
      and referenced_attribute.attname = 'id'
      and rel.relkind in ('r','p')
  ), known_text_targets(target_schema, target_table, target_column, reference_kind) as (
    values
      ('public','sc_supplier_item_mappings','blank_product_id_text','text'),
      ('public','sc_supplier_receiving_lines','blank_product_id_text','text'),
      ('public','sc_supplier_receiving_receipt_lines','blank_product_id_text','text'),
      ('public','mockup_blank_assets','blank_product_id_text','text'),
      ('public','sc_product_identity_aliases','canonical_blank_product_id_text','text')
  )
  select * from foreign_key_targets
  union
  select known.*
  from known_text_targets known
  join information_schema.columns column_row
    on column_row.table_schema = known.target_schema
   and column_row.table_name = known.target_table
   and column_row.column_name = known.target_column
  order by 1, 2, 3;
$$;

revoke all on function public.sc_blank_product_reference_targets_v1() from public, anon, authenticated;
grant execute on function public.sc_blank_product_reference_targets_v1() to service_role;

create or replace function public.sc_product_resolution_evidence_v1(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.sc_product_review_cases%rowtype;
  v_members uuid[];
  v_duplicates uuid[];
  v_survivor uuid;
  v_products jsonb := '[]'::jsonb;
  v_references jsonb := '[]'::jsonb;
  v_inventory jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_target record;
  v_member uuid;
  v_count bigint;
  v_identity_count integer;
begin
  select * into v_case
  from public.sc_product_review_cases
  where id = p_case_id;

  if not found then
    raise exception 'Review case % was not found.', p_case_id;
  end if;

  if v_case.case_type <> 'duplicate_product' then
    v_blockers := v_blockers || jsonb_build_array('Only duplicate-product cases can use this resolution workflow.');
  end if;

  select array_agg(item.entity_id_text::uuid order by item.entity_id_text::uuid)
    into v_members
  from public.sc_product_review_case_items item
  where item.case_id = p_case_id
    and item.entity_type = 'blank_product'
    and item.entity_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  if coalesce(cardinality(v_members), 0) < 2 then
    v_blockers := v_blockers || jsonb_build_array('The case must contain at least two valid blank products.');
  end if;

  if coalesce(v_case.proposed_survivor_id_text, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_blockers := v_blockers || jsonb_build_array('Choose a valid proposed survivor.');
  else
    v_survivor := v_case.proposed_survivor_id_text::uuid;
  end if;

  if v_survivor is not null and not (v_survivor = any(coalesce(v_members, array[]::uuid[]))) then
    v_blockers := v_blockers || jsonb_build_array('The proposed survivor is not a member of this review case.');
  end if;

  v_duplicates := array(
    select member_id from unnest(coalesce(v_members, array[]::uuid[])) member_id
    where member_id <> v_survivor
    order by member_id
  );

  select coalesce(jsonb_agg(to_jsonb(product_row) order by product_row.id), '[]'::jsonb)
    into v_products
  from public.blank_products product_row
  where product_row.id = any(coalesce(v_members, array[]::uuid[]));

  if jsonb_array_length(v_products) <> coalesce(cardinality(v_members), 0) then
    v_blockers := v_blockers || jsonb_build_array('One or more blank-product records no longer exist.');
  end if;

  if exists (
    select 1 from public.blank_products
    where id = any(coalesce(v_members, array[]::uuid[])) and sc_is_archived is true
  ) then
    v_blockers := v_blockers || jsonb_build_array('One or more case members are already archived.');
  end if;

  select count(distinct concat_ws('|', brand_id::text, product_type_id::text, color_id::text, size_id::text))
    into v_identity_count
  from public.blank_products
  where id = any(coalesce(v_members, array[]::uuid[]));

  if coalesce(v_identity_count, 0) > 1 then
    v_warnings := v_warnings || jsonb_build_array(
      'The products do not have identical brand, style, color, and size values. Verify that the proposed survivor is correct.'
    );
  end if;

  for v_target in select * from public.sc_blank_product_reference_targets_v1()
  loop
    foreach v_member in array coalesce(v_members, array[]::uuid[])
    loop
      execute format(
        'select count(*) from %I.%I where %I::text = $1',
        v_target.target_schema, v_target.target_table, v_target.target_column
      ) into v_count using v_member::text;

      if v_count > 0 then
        v_references := v_references || jsonb_build_array(jsonb_build_object(
          'schema', v_target.target_schema,
          'table', v_target.target_table,
          'column', v_target.target_column,
          'kind', v_target.reference_kind,
          'blank_product_id', v_member::text,
          'role', case when v_member = v_survivor then 'survivor' else 'duplicate' end,
          'row_count', v_count
        ));
      end if;
    end loop;
  end loop;

  if to_regclass('public.blank_inventory_movements') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'blank_product_id', product_id::text,
      'role', case when product_id = v_survivor then 'survivor' else 'duplicate' end,
      'movement_count', movement_count,
      'net_quantity', net_quantity
    ) order by product_id), '[]'::jsonb)
      into v_inventory
    from (
      select movement.blank_product_id::uuid product_id,
             count(*)::bigint movement_count,
             coalesce(sum(movement.quantity_change), 0) net_quantity
      from public.blank_inventory_movements movement
      where movement.blank_product_id::text in (
        select member_id::text from unnest(coalesce(v_members, array[]::uuid[])) member_id
      )
      group by movement.blank_product_id::uuid
    ) inventory_rows;
  end if;

  return jsonb_build_object(
    'case_id', p_case_id,
    'case_status', v_case.status,
    'survivor_id', v_survivor,
    'duplicate_ids', to_jsonb(coalesce(v_duplicates, array[]::uuid[])),
    'products', v_products,
    'references', v_references,
    'inventory', v_inventory,
    'warnings', v_warnings,
    'blockers', v_blockers
  );
end;
$$;

revoke all on function public.sc_product_resolution_evidence_v1(uuid) from public, anon, authenticated;
grant execute on function public.sc_product_resolution_evidence_v1(uuid) to service_role;

create or replace function public.sc_preview_product_resolution_v1(p_case_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_case public.sc_product_review_cases%rowtype;
  v_evidence jsonb;
  v_hash text;
  v_phrase text;
  v_run public.sc_product_resolution_runs%rowtype;
begin
  select * into v_case
  from public.sc_product_review_cases
  where id = p_case_id
  for update;

  if not found then raise exception 'Review case % was not found.', p_case_id; end if;
  if v_case.status not in ('open','reviewing','approved') then
    raise exception 'Review case % cannot be resolved while its status is %.', p_case_id, v_case.status;
  end if;

  v_evidence := public.sc_product_resolution_evidence_v1(p_case_id);
  if jsonb_array_length(coalesce(v_evidence->'blockers', '[]'::jsonb)) > 0 then
    raise exception 'Resolution preview is blocked: %', v_evidence->'blockers';
  end if;

  v_hash := encode(digest((v_evidence - 'case_status')::text, 'sha256'), 'hex');
  v_phrase := 'RESOLVE ' || upper(left(p_case_id::text, 8));

  update public.sc_product_resolution_runs
  set status = 'expired'
  where case_id = p_case_id and status = 'ready';

  insert into public.sc_product_resolution_runs (
    case_id, survivor_id_text, duplicate_ids_text, preview_hash, preview,
    confirmation_phrase, requested_by
  ) values (
    p_case_id, v_evidence->>'survivor_id', coalesce(v_evidence->'duplicate_ids', '[]'::jsonb),
    v_hash, v_evidence, v_phrase, p_actor
  ) returning * into v_run;

  update public.sc_product_review_cases
  set status = 'reviewing', resolution_preview = v_evidence,
      resolution_started_at = coalesce(resolution_started_at, now()), updated_at = now()
  where id = p_case_id;

  return jsonb_build_object(
    'success', true,
    'resolution_id', v_run.id,
    'expires_at', v_run.expires_at,
    'confirmation_phrase', v_phrase,
    'preview_hash', v_hash,
    'evidence', v_evidence
  );
end;
$$;

revoke all on function public.sc_preview_product_resolution_v1(uuid,uuid) from public, anon, authenticated;
grant execute on function public.sc_preview_product_resolution_v1(uuid,uuid) to service_role;

create or replace function public.sc_apply_product_resolution_v1(
  p_resolution_id uuid,
  p_confirmation text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.sc_product_resolution_runs%rowtype;
  v_case public.sc_product_review_cases%rowtype;
  v_evidence jsonb;
  v_hash text;
  v_survivor uuid;
  v_duplicate uuid;
  v_duplicate_row public.blank_products%rowtype;
  v_survivor_row public.blank_products%rowtype;
  v_target record;
  v_changed bigint;
  v_moved jsonb := '[]'::jsonb;
  v_archived jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  select * into v_run
  from public.sc_product_resolution_runs
  where id = p_resolution_id
  for update;

  if not found then raise exception 'Resolution preview % was not found.', p_resolution_id; end if;
  if v_run.status <> 'ready' then raise exception 'Resolution preview status is %.', v_run.status; end if;
  if v_run.expires_at <= now() then
    update public.sc_product_resolution_runs set status = 'expired' where id = p_resolution_id;
    raise exception 'Resolution preview expired. Run a new preview.';
  end if;
  if btrim(coalesce(p_confirmation, '')) <> v_run.confirmation_phrase then
    raise exception 'The confirmation phrase does not match.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_run.case_id::text, 0));

  select * into v_case
  from public.sc_product_review_cases
  where id = v_run.case_id
  for update;

  if v_case.status not in ('open','reviewing','approved') then
    raise exception 'Review case status is now %. Run a new preview.', v_case.status;
  end if;

  v_evidence := public.sc_product_resolution_evidence_v1(v_run.case_id);
  v_hash := encode(digest((v_evidence - 'case_status')::text, 'sha256'), 'hex');
  if v_hash <> v_run.preview_hash then
    raise exception 'The case or its references changed after preview. Run a new preview.';
  end if;

  v_survivor := (v_evidence->>'survivor_id')::uuid;
  select * into v_survivor_row from public.blank_products where id = v_survivor for update;
  if not found or v_survivor_row.sc_is_archived then
    raise exception 'The proposed survivor is missing or archived.';
  end if;

  update public.sc_product_resolution_runs
  set status = 'applying'
  where id = p_resolution_id;

  for v_duplicate in
    select value::uuid from jsonb_array_elements_text(v_evidence->'duplicate_ids') value
  loop
    select * into v_duplicate_row
    from public.blank_products
    where id = v_duplicate
    for update;

    if not found or v_duplicate_row.sc_is_archived then
      raise exception 'Duplicate product % is missing or archived.', v_duplicate;
    end if;

    for v_target in select * from public.sc_blank_product_reference_targets_v1()
    loop
      if v_target.reference_kind = 'text' then
        execute format(
          'update %I.%I set %I = $1 where %I::text = $2',
          v_target.target_schema, v_target.target_table, v_target.target_column, v_target.target_column
        ) using v_survivor::text, v_duplicate::text;
      else
        execute format(
          'update %I.%I set %I = $1 where %I = $2',
          v_target.target_schema, v_target.target_table, v_target.target_column, v_target.target_column
        ) using v_survivor, v_duplicate;
      end if;
      get diagnostics v_changed = row_count;
      if v_changed > 0 then
        v_moved := v_moved || jsonb_build_array(jsonb_build_object(
          'duplicate_id', v_duplicate,
          'survivor_id', v_survivor,
          'schema', v_target.target_schema,
          'table', v_target.target_table,
          'column', v_target.target_column,
          'row_count', v_changed
        ));
      end if;
    end loop;

    if nullif(btrim(coalesce(v_duplicate_row.sku_base::text, '')), '') is not null then
      insert into public.sc_product_identity_aliases (
        source_system, alias_type, source_value, source_value_norm,
        canonical_blank_product_id_text, canonical_label, confidence, status,
        notes, created_by, reviewed_by, updated_at
      ) values (
        'case_resolution', 'sku', v_duplicate_row.sku_base::text,
        public.sc_identity_norm_v1(v_duplicate_row.sku_base::text),
        v_survivor::text, v_survivor_row.sku_base::text, 100, 'active',
        'Preserved from resolved duplicate ' || v_duplicate::text, p_actor, p_actor, now()
      )
      on conflict (source_system, alias_type, source_value_norm, context_brand_norm, context_style_norm)
      do update set canonical_blank_product_id_text = excluded.canonical_blank_product_id_text,
                    canonical_label = excluded.canonical_label, status = 'active',
                    reviewed_by = excluded.reviewed_by, updated_at = now();
    end if;

    if nullif(btrim(coalesce(v_duplicate_row.barcode::text, '')), '') is not null then
      insert into public.sc_product_identity_aliases (
        source_system, alias_type, source_value, source_value_norm,
        canonical_blank_product_id_text, canonical_label, confidence, status,
        notes, created_by, reviewed_by, updated_at
      ) values (
        'case_resolution', 'barcode', v_duplicate_row.barcode::text,
        public.sc_identity_norm_v1(v_duplicate_row.barcode::text),
        v_survivor::text, v_survivor_row.sku_base::text, 100, 'active',
        'Preserved from resolved duplicate ' || v_duplicate::text, p_actor, p_actor, now()
      )
      on conflict (source_system, alias_type, source_value_norm, context_brand_norm, context_style_norm)
      do update set canonical_blank_product_id_text = excluded.canonical_blank_product_id_text,
                    canonical_label = excluded.canonical_label, status = 'active',
                    reviewed_by = excluded.reviewed_by, updated_at = now();
    end if;

    update public.blank_products
    set sc_is_archived = true,
        sc_archived_at = now(),
        sc_archived_by = p_actor,
        sc_archived_reason = 'Resolved duplicate review case ' || v_run.case_id::text,
        sc_canonical_blank_product_id = v_survivor,
        sc_archived_original_sku = coalesce(sc_archived_original_sku, sku_base::text),
        sc_archived_original_barcode = coalesce(sc_archived_original_barcode, barcode::text),
        sc_archived_original_name = coalesce(sc_archived_original_name, name::text),
        sku_base = 'ARCHIVED-' || id::text,
        barcode = case when barcode is null then null else left('ARCHIVED-' || id::text, 190) end,
        name = left('ARCHIVED → ' || coalesce(name::text, sku_base::text, id::text), 90)
    where id = v_duplicate;

    v_archived := v_archived || jsonb_build_array(jsonb_build_object(
      'duplicate_id', v_duplicate,
      'original_sku', v_duplicate_row.sku_base,
      'original_barcode', v_duplicate_row.barcode,
      'original_name', v_duplicate_row.name,
      'survivor_id', v_survivor
    ));

    insert into public.sc_core_mutation_audit (
      action, entity_type, entity_id_text, actor_user_id,
      before_snapshot, after_snapshot, reason
    )
    select 'resolve_duplicate', 'blank_product', v_duplicate::text, p_actor,
           to_jsonb(v_duplicate_row), to_jsonb(after_row),
           'Resolved review case ' || v_run.case_id::text || ' into survivor ' || v_survivor::text
    from public.blank_products after_row
    where after_row.id = v_duplicate;
  end loop;

  v_result := jsonb_build_object(
    'success', true,
    'case_id', v_run.case_id,
    'resolution_id', p_resolution_id,
    'survivor_id', v_survivor,
    'archived_products', v_archived,
    'moved_references', v_moved,
    'quantity_values_rewritten', false,
    'completed_at', now()
  );

  update public.sc_product_review_cases
  set status = 'completed', resolved_survivor_id_text = v_survivor::text,
      resolution_summary = v_result, resolution_completed_at = now(),
      completed_at = now(), reviewed_by = p_actor, updated_at = now()
  where id = v_run.case_id;

  update public.sc_product_resolution_runs
  set status = 'completed', applied_by = p_actor, applied_at = now(), result = v_result
  where id = p_resolution_id;

  insert into public.sc_core_mutation_audit (
    action, entity_type, entity_id_text, actor_user_id, after_snapshot, reason
  ) values (
    'complete_resolution', 'product_review_case', v_run.case_id::text,
    p_actor, v_result, 'Atomic duplicate-product resolution completed'
  );

  return v_result;
exception when others then
  raise;
end;
$$;

revoke all on function public.sc_apply_product_resolution_v1(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.sc_apply_product_resolution_v1(uuid,text,uuid) to service_role;

create or replace function public.sc_update_product_review_case_status_v1(
  p_case_id uuid,
  p_status text,
  p_notes text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.sc_product_review_cases%rowtype;
  v_after public.sc_product_review_cases%rowtype;
begin
  if p_status not in ('open','reviewing','approved','rejected','cancelled') then
    raise exception 'Unsupported review case status %.', p_status;
  end if;

  select * into v_before from public.sc_product_review_cases where id = p_case_id for update;
  if not found then raise exception 'Review case % was not found.', p_case_id; end if;
  if v_before.status = 'completed' then raise exception 'Completed review cases cannot be reopened.'; end if;

  update public.sc_product_review_cases
  set status = p_status,
      resolution_notes = coalesce(nullif(btrim(p_notes), ''), resolution_notes),
      reviewed_by = p_actor,
      updated_at = now()
  where id = p_case_id
  returning * into v_after;

  insert into public.sc_core_mutation_audit (
    action, entity_type, entity_id_text, actor_user_id,
    before_snapshot, after_snapshot, reason
  ) values (
    'review_status', 'product_review_case', p_case_id::text, p_actor,
    to_jsonb(v_before), to_jsonb(v_after), coalesce(nullif(btrim(p_notes), ''), 'Review status updated')
  );

  return to_jsonb(v_after);
end;
$$;

revoke all on function public.sc_update_product_review_case_status_v1(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.sc_update_product_review_case_status_v1(uuid,text,text,uuid) to service_role;

-- Keep archived duplicates out of the resolver used by receiving and creation previews.
create or replace function public.sc_blank_product_candidates_v1(
  p_source_system text default '', p_supplier_sku text default '', p_sku text default '',
  p_barcode text default '', p_brand text default '', p_style text default '',
  p_color text default '', p_size text default '', p_limit integer default 25
)
returns table (
  blank_product_id_text text, sku_base text, barcode text, product_name text,
  brand text, style text, color text, size text, match_method text, confidence integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with input as (
    select public.sc_identity_norm_v1(p_supplier_sku) supplier_norm,
      public.sc_identity_norm_v1(p_sku) sku_norm,
      public.sc_identity_norm_v1(p_barcode) barcode_norm,
      public.sc_identity_norm_v1(p_brand) brand_norm,
      public.sc_identity_norm_v1(p_style) style_norm,
      public.sc_identity_norm_v1(p_color) color_norm,
      public.sc_identity_norm_v1(p_size) size_norm
  ), aliases as (
    select distinct alias_row.canonical_blank_product_id_text
    from public.sc_product_identity_aliases alias_row, input i
    where alias_row.status = 'active' and alias_row.alias_type in ('supplier_sku','sku','barcode')
      and (
        (alias_row.alias_type = 'supplier_sku'
          and public.sc_identity_norm_v1(alias_row.source_system) = public.sc_identity_norm_v1(p_source_system)
          and alias_row.source_value_norm = i.supplier_norm and i.supplier_norm <> '')
        or (alias_row.alias_type = 'sku' and alias_row.source_value_norm = i.sku_norm and i.sku_norm <> '')
        or (alias_row.alias_type = 'barcode' and alias_row.source_value_norm = i.barcode_norm and i.barcode_norm <> '')
      )
  ), base as (
    select bp.id::text id_text, bp.sku_base::text, bp.barcode::text,
      bp.name::text product_name, brand_row.name::text brand,
      style_row.name::text style, color_row.name::text color, size_row.name::text size,
      case
        when alias_row.canonical_blank_product_id_text is not null then 'remembered_identity'
        when i.barcode_norm <> '' and public.sc_identity_norm_v1(bp.barcode::text) = i.barcode_norm then 'exact_barcode'
        when i.sku_norm <> '' and public.sc_identity_norm_v1(bp.sku_base::text) = i.sku_norm then 'exact_sku'
        when i.brand_norm <> '' and i.style_norm <> '' and i.color_norm <> '' and i.size_norm <> ''
          and public.sc_identity_norm_v1(brand_row.name::text) = i.brand_norm
          and public.sc_identity_norm_v1(style_row.name::text) = i.style_norm
          and public.sc_identity_norm_v1(color_row.name::text) = i.color_norm
          and public.sc_identity_norm_v1(size_row.name::text) = i.size_norm then 'exact_identity'
        else 'partial_identity'
      end match_method,
      case
        when alias_row.canonical_blank_product_id_text is not null then 100
        when i.barcode_norm <> '' and public.sc_identity_norm_v1(bp.barcode::text) = i.barcode_norm then 99
        when i.sku_norm <> '' and public.sc_identity_norm_v1(bp.sku_base::text) = i.sku_norm then 98
        when i.brand_norm <> '' and i.style_norm <> '' and i.color_norm <> '' and i.size_norm <> ''
          and public.sc_identity_norm_v1(brand_row.name::text) = i.brand_norm
          and public.sc_identity_norm_v1(style_row.name::text) = i.style_norm
          and public.sc_identity_norm_v1(color_row.name::text) = i.color_norm
          and public.sc_identity_norm_v1(size_row.name::text) = i.size_norm then 95
        else (case when i.brand_norm <> '' and public.sc_identity_norm_v1(brand_row.name::text) = i.brand_norm then 15 else 0 end)
           + (case when i.style_norm <> '' and public.sc_identity_norm_v1(style_row.name::text) = i.style_norm then 25 else 0 end)
           + (case when i.color_norm <> '' and public.sc_identity_norm_v1(color_row.name::text) = i.color_norm then 15 else 0 end)
           + (case when i.size_norm <> '' and public.sc_identity_norm_v1(size_row.name::text) = i.size_norm then 15 else 0 end)
      end confidence
    from public.blank_products bp
    left join public.brands brand_row on brand_row.id = bp.brand_id
    left join public.product_types style_row on style_row.id = bp.product_type_id
    left join public.colors color_row on color_row.id = bp.color_id
    left join public.sizes size_row on size_row.id = bp.size_id
    cross join input i
    left join aliases alias_row on alias_row.canonical_blank_product_id_text = bp.id::text
    where bp.sc_is_archived is false
  )
  select id_text, base.sku_base, base.barcode, product_name, brand, style, color, size,
         match_method, confidence
  from base
  where confidence > 0
  order by confidence desc, sku_base
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

revoke all on function public.sc_blank_product_candidates_v1(text,text,text,text,text,text,text,text,integer)
from public, anon, authenticated;
grant execute on function public.sc_blank_product_candidates_v1(text,text,text,text,text,text,text,text,integer)
to service_role;

-- The original diagnostic view remains intact for traceability. Its public RPCs
-- now omit archived blank products so a completed case disappears on refresh.
create or replace function public.sc_product_integrity_summary_v1()
returns table (issue_type text, severity text, issue_count bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select issue_row.issue_type, issue_row.severity, count(*)::bigint
  from public.sc_product_integrity_issue_rows_v1 issue_row
  where not (
    issue_row.entity_type = 'blank_product'
    and exists (
      select 1 from public.blank_products archived_product
      where archived_product.id::text = issue_row.entity_id
        and archived_product.sc_is_archived is true
    )
  )
  group by issue_row.issue_type, issue_row.severity
  order by case when issue_row.severity = 'high' then 0 else 1 end, issue_row.issue_type;
$$;

create or replace function public.sc_product_integrity_issues_v1(
  p_issue_type text default 'all',
  p_search text default '',
  p_limit integer default 500
)
returns table (
  issue_id text, issue_type text, severity text, entity_type text,
  entity_id text, sku text, product_name text, candidate_group text, details jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select issue_row.issue_id, issue_row.issue_type, issue_row.severity,
    issue_row.entity_type, issue_row.entity_id, issue_row.sku,
    issue_row.product_name, issue_row.candidate_group, issue_row.details
  from public.sc_product_integrity_issue_rows_v1 issue_row
  where (coalesce(trim(p_issue_type), '') in ('', 'all') or issue_row.issue_type = trim(p_issue_type))
    and not (
      issue_row.entity_type = 'blank_product'
      and exists (
        select 1 from public.blank_products archived_product
        where archived_product.id::text = issue_row.entity_id
          and archived_product.sc_is_archived is true
      )
    )
    and (
      coalesce(trim(p_search), '') = ''
      or concat_ws(' ', issue_row.issue_type, issue_row.entity_type,
           issue_row.entity_id, issue_row.sku, issue_row.product_name,
           issue_row.candidate_group, issue_row.details::text)
         ilike '%' || trim(p_search) || '%'
    )
  order by case when issue_row.severity = 'high' then 0 else 1 end,
           issue_row.issue_type, issue_row.candidate_group, issue_row.sku
  limit least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

revoke all on function public.sc_product_integrity_summary_v1() from public, anon;
revoke all on function public.sc_product_integrity_issues_v1(text,text,integer) from public, anon;
grant execute on function public.sc_product_integrity_summary_v1() to authenticated, service_role;
grant execute on function public.sc_product_integrity_issues_v1(text,text,integer) to authenticated, service_role;

commit;

select
  to_regprocedure('public.sc_preview_product_resolution_v1(uuid,uuid)') is not null as preview_ready,
  to_regprocedure('public.sc_apply_product_resolution_v1(uuid,text,uuid)') is not null as apply_ready,
  to_regprocedure('public.sc_update_product_review_case_status_v1(uuid,text,text,uuid)') is not null as status_ready;
