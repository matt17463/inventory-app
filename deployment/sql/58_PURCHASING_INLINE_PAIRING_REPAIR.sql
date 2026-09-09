-- Skilled Crafting Inventory App v1.4.7
-- Purchasing Report inline blank-pairing repair
--
-- Adds:
--   1) richer source metadata inside purchasing_demand_sources_v1
--   2) sc_purchasing_fix_pairing_v1() RPC
--
-- The repair RPC reuses the existing pull-sheet override function so the current
-- job item and its existing reservation follow the corrected blank. When a durable
-- WooCommerce variation/SKU/product key is available, it also saves the corrected
-- mapping through the existing Product-to-Blank Mapping Lifecycle.
--
-- SAFE TO RERUN. Does not create inventory quantities or inventory movements.

begin;

-- ---------------------------------------------------------------------------
-- Preflight: this feature intentionally builds on the pairing lifecycle that is
-- already used by Pull Sheets. Fail before changing anything if those primitives
-- are not installed.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.job_items') is null then
    raise exception 'Required table public.job_items is missing.';
  end if;

  if to_regclass('public.blank_products') is null then
    raise exception 'Required table public.blank_products is missing.';
  end if;

  if to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)') is null then
    raise exception 'Product-to-Blank Mapping Lifecycle is missing. Install deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql first.';
  end if;

  if to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text)') is null
     and to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text,text)') is null then
    raise exception 'Pull-sheet override RPC override_job_item_blank_pairing is missing. Install the pull-sheet pairing override SQL first.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Purchasing demand-source view
--
-- Keep the same top-level columns already consumed by inventoryApi.js. The only
-- change is additional keys inside each sources JSON object so Purchasing can
-- create a durable future mapping without guessing from display text.
-- ---------------------------------------------------------------------------
create or replace view public.purchasing_demand_sources_v1 as
with source_lines as (
  select
    ji.blank_product_id::uuid as blank_product_id,
    j.id as job_id,
    ji.id as job_item_id,
    coalesce(
      nullif(to_jsonb(ji)->>'quantity', '')::numeric,
      nullif(to_jsonb(ji)->>'qty', '')::numeric,
      1
    ) as quantity,
    nullif(to_jsonb(j)->>'woocommerce_order_id', '') as woocommerce_order_id,
    coalesce(
      nullif(to_jsonb(j)->>'woocommerce_order_id', ''),
      nullif(to_jsonb(j)->>'manual_order_id', ''),
      nullif(to_jsonb(j)->>'order_number', ''),
      nullif(to_jsonb(j)->>'order_id', '')
    ) as order_number,
    coalesce(
      nullif(to_jsonb(j)->>'job_name', ''),
      'Pull Sheet #' || j.id::text
    ) as job_name,
    nullif(to_jsonb(j)->>'customer_name', '') as customer_name,
    coalesce(nullif(to_jsonb(j)->>'status', ''), 'queued') as job_status,
    nullif(to_jsonb(ji)->>'status', '') as job_item_status,
    coalesce(
      nullif(to_jsonb(ji)->>'order_sku', ''),
      nullif(to_jsonb(ji)->>'sku', '')
    ) as order_sku,
    coalesce(
      nullif(to_jsonb(ji)->>'ordered_product_name', ''),
      nullif(to_jsonb(ji)->>'item_name', ''),
      nullif(to_jsonb(ji)->>'notes', '')
    ) as item_name,
    nullif(to_jsonb(ji)->>'pairing_source', '') as pairing_source,
    nullif(to_jsonb(ji)->>'pairing_warning', '') as pairing_warning,
    nullif(to_jsonb(ji)->>'woocommerce_product_id', '') as woocommerce_product_id,
    nullif(to_jsonb(ji)->>'woocommerce_variation_id', '') as woocommerce_variation_id,
    coalesce(
      nullif(to_jsonb(ji)->>'manual_order_id', ''),
      nullif(to_jsonb(j)->>'manual_order_id', '')
    ) as manual_order_id,
    coalesce(
      nullif(to_jsonb(ji)->>'manual_order_item_id', ''),
      nullif(to_jsonb(ji)->>'manual_invoice_order_item_id', '')
    ) as manual_order_item_id,
    coalesce(
      nullif(to_jsonb(j)->>'due_date', ''),
      nullif(to_jsonb(j)->>'created_at', ''),
      nullif(to_jsonb(ji)->>'created_at', '')
    ) as sort_date
  from public.job_items ji
  left join public.jobs j
    on j.id = ji.job_id
  where ji.blank_product_id is not null
    and lower(coalesce(nullif(to_jsonb(j)->>'status', ''), 'queued')) not in (
      'completed', 'complete', 'filled', 'cancelled', 'canceled', 'voided', 'void'
    )
    and lower(coalesce(nullif(to_jsonb(ji)->>'status', ''), 'queued')) not in (
      'completed', 'complete', 'filled', 'cancelled', 'canceled', 'voided', 'void'
    )
)
select
  blank_product_id,
  count(*)::integer as source_count,
  coalesce(sum(quantity), 0)::numeric as total_quantity,
  string_agg(distinct coalesce('Order #' || order_number, 'Pull Sheet #' || job_id::text), ', ') as order_numbers,
  string_agg(distinct 'Pull Sheet #' || job_id::text, ', ') as pullsheet_numbers,
  jsonb_agg(
    jsonb_build_object(
      'job_id', job_id,
      'pullsheet_number', job_id,
      'pullsheet_label', 'Pull Sheet #' || job_id::text,
      'job_item_id', job_item_id,
      'order_number', order_number,
      'order_label', coalesce('Order #' || order_number, 'Order not recorded'),
      'woocommerce_order_id', woocommerce_order_id,
      'woocommerce_product_id', woocommerce_product_id,
      'woocommerce_variation_id', woocommerce_variation_id,
      'manual_order_id', manual_order_id,
      'manual_order_item_id', manual_order_item_id,
      'current_blank_product_id', blank_product_id,
      'customer_name', customer_name,
      'job_name', job_name,
      'job_status', job_status,
      'job_item_status', job_item_status,
      'quantity', quantity,
      'order_sku', order_sku,
      'item_name', item_name,
      'pairing_source', pairing_source,
      'pairing_warning', pairing_warning,
      'sort_date', sort_date
    )
    order by sort_date desc nulls last, job_id desc, job_item_id desc
  ) as sources
from source_lines
group by blank_product_id;

grant select on public.purchasing_demand_sources_v1 to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic Purchasing correction
-- ---------------------------------------------------------------------------
drop function if exists public.sc_purchasing_fix_pairing_v1(bigint, uuid, text, boolean);

create or replace function public.sc_purchasing_fix_pairing_v1(
  p_job_item_id bigint,
  p_new_blank_product_id uuid,
  p_reason text default 'Corrected from Purchasing Report',
  p_remember_mapping boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_old_blank_product_id uuid;
  v_job_id bigint;
  v_order_sku text;
  v_woo_variation_id text;
  v_woo_product_id text;
  v_reason text;
  v_mapping_result jsonb;
  v_mapping_results jsonb := '[]'::jsonb;
  v_mapping_count integer := 0;
  v_has_reusable_key boolean := false;
  v_mapping_skipped_reason text := null;
begin
  if p_job_item_id is null or p_job_item_id <= 0 then
    raise exception 'A valid pull-sheet line ID is required.';
  end if;

  if p_new_blank_product_id is null then
    raise exception 'Choose a replacement blank product.';
  end if;

  select to_jsonb(ji)
  into v_item
  from public.job_items ji
  where ji.id = p_job_item_id
  for update;

  if v_item is null then
    raise exception 'Pull-sheet line % was not found.', p_job_item_id;
  end if;

  if not exists (
    select 1
    from public.blank_products bp
    where bp.id = p_new_blank_product_id
      and coalesce(bp.sc_is_archived, false) = false
  ) then
    raise exception 'The replacement blank product does not exist or is archived.';
  end if;

  v_old_blank_product_id := nullif(v_item->>'blank_product_id', '')::uuid;
  v_job_id := nullif(v_item->>'job_id', '')::bigint;
  v_order_sku := trim(coalesce(nullif(v_item->>'order_sku', ''), nullif(v_item->>'sku', ''), ''));
  v_woo_variation_id := trim(coalesce(v_item->>'woocommerce_variation_id', ''));
  v_woo_product_id := trim(coalesce(v_item->>'woocommerce_product_id', ''));
  v_reason := coalesce(nullif(trim(p_reason), ''), 'Corrected from Purchasing Report');

  v_has_reusable_key :=
       v_woo_variation_id ~ '^[0-9]+$'
    or (v_order_sku <> '' and v_order_sku !~* '^MANUAL-[0-9]+-LINE-[0-9]+$')
    or v_woo_product_id ~ '^[0-9]+$';

  if p_remember_mapping
     and v_has_reusable_key
     and to_regprocedure('public.sc_set_product_blank_mapping_v1(text,text,uuid,text,text,boolean,uuid)') is null then
    raise exception 'Product-to-Blank Mapping Lifecycle RPC is not installed.';
  end if;

  -- Use the same override operation as the Pull Sheet screen. This is important:
  -- the existing override implementation updates the job-item pairing and the
  -- reservation associated with that job item, and logs the correction.
  if to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text)') is not null then
    execute 'select public.override_job_item_blank_pairing($1,$2,$3)'
      using p_job_item_id, p_new_blank_product_id, v_reason;
  elsif to_regprocedure('public.override_job_item_blank_pairing(bigint,uuid,text,text)') is not null then
    execute 'select public.override_job_item_blank_pairing($1,$2,$3,$4)'
      using p_job_item_id, p_new_blank_product_id, v_reason, 'Corrected from Purchasing Report';
  else
    raise exception 'Pull-sheet pairing override RPC is not installed.';
  end if;

  if p_remember_mapping then
    -- Strongest durable key first: exact WooCommerce variation.
    if v_woo_variation_id ~ '^[0-9]+$' then
      execute 'select public.sc_set_product_blank_mapping_v1($1,$2,$3,$4,$5,$6,$7)'
        into v_mapping_result
        using
          'woocommerce_variation',
          v_woo_variation_id,
          p_new_blank_product_id,
          'purchasing_report',
          v_reason,
          true,
          null::uuid;
      v_mapping_results := v_mapping_results || jsonb_build_array(v_mapping_result);
      v_mapping_count := v_mapping_count + 1;
    end if;

    -- Save a SKU rule too when the SKU is real. Never remember generated manual
    -- placeholders such as MANUAL-21-LINE-1141.
    if v_order_sku <> '' and v_order_sku !~* '^MANUAL-[0-9]+-LINE-[0-9]+$' then
      execute 'select public.sc_set_product_blank_mapping_v1($1,$2,$3,$4,$5,$6,$7)'
        into v_mapping_result
        using
          'woocommerce_sku',
          v_order_sku,
          p_new_blank_product_id,
          'purchasing_report',
          v_reason,
          true,
          null::uuid;
      v_mapping_results := v_mapping_results || jsonb_build_array(v_mapping_result);
      v_mapping_count := v_mapping_count + 1;
    end if;

    -- Simple products may not have a variation ID or useful SKU. In that case,
    -- remember the Woo parent/simple product ID.
    if not (v_woo_variation_id ~ '^[0-9]+$')
       and (v_order_sku = '' or v_order_sku ~* '^MANUAL-[0-9]+-LINE-[0-9]+$')
       and v_woo_product_id ~ '^[0-9]+$' then
      execute 'select public.sc_set_product_blank_mapping_v1($1,$2,$3,$4,$5,$6,$7)'
        into v_mapping_result
        using
          'woocommerce_product',
          v_woo_product_id,
          p_new_blank_product_id,
          'purchasing_report',
          v_reason,
          true,
          null::uuid;
      v_mapping_results := v_mapping_results || jsonb_build_array(v_mapping_result);
      v_mapping_count := v_mapping_count + 1;
    end if;

    if not v_has_reusable_key then
      v_mapping_skipped_reason := 'No reusable WooCommerce variation, SKU, or product ID was captured for this line.';
    elsif v_mapping_count = 0 then
      v_mapping_skipped_reason := 'No reusable mapping key was eligible to save.';
    end if;
  else
    v_mapping_skipped_reason := 'Remember mapping was not selected.';
  end if;

  return jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'job_item_id', p_job_item_id,
    'old_blank_product_id', v_old_blank_product_id,
    'new_blank_product_id', p_new_blank_product_id,
    'order_sku', nullif(v_order_sku, ''),
    'woocommerce_variation_id', nullif(v_woo_variation_id, ''),
    'woocommerce_product_id', nullif(v_woo_product_id, ''),
    'remember_mapping_requested', p_remember_mapping,
    'mappings_saved', v_mapping_count,
    'mapping_results', v_mapping_results,
    'mapping_skipped_reason', v_mapping_skipped_reason
  );
end;
$$;

grant execute on function public.sc_purchasing_fix_pairing_v1(bigint, uuid, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
