-- Pull Sheet 170 Growth Diagnostic
-- READ ONLY: this script does not insert, update, delete, or alter anything.
--
-- Run once before opening pull sheet 170, save the results, open it once,
-- then run this diagnostic again and compare the counts and IDs.

-- Result 1: pull-sheet header
select
  j.id,
  to_jsonb(j) as complete_job_record
from public.jobs j
where j.id = 170;


-- Result 2: exact saved job-item rows
select
  ji.id as job_item_id,
  ji.job_id,
  ji.status,
  ji.quantity,
  ji.sku,
  ji.order_sku,
  ji.item_name,
  ji.name,
  ji.blank_product_id,
  ji.selected_bin_id,
  ji.inventory_required,
  to_jsonb(ji) as complete_job_item_record
from public.job_items ji
where ji.job_id = 170
order by ji.id;


-- Result 3: saved row count and ID range
select
  count(*) as saved_job_item_count,
  min(id) as first_job_item_id,
  max(id) as last_job_item_id,
  array_agg(id order by id) as saved_job_item_ids
from public.job_items
where job_id = 170;


-- Result 4: likely duplicate groups.
-- JSON key access is used so this works even when optional source columns vary.
with lines as (
  select
    ji.id,
    to_jsonb(ji) as record,
    coalesce(
      to_jsonb(ji)->>'manual_order_item_id',
      to_jsonb(ji)->>'manual_invoice_order_item_id',
      to_jsonb(ji)->>'source_item_id',
      to_jsonb(ji)->>'woocommerce_order_item_id',
      ''
    ) as source_line_id,
    lower(trim(coalesce(
      ji.order_sku,
      ji.sku,
      to_jsonb(ji)->>'ordered_sku',
      ''
    ))) as normalized_sku,
    lower(trim(coalesce(
      ji.item_name,
      ji.name,
      to_jsonb(ji)->>'ordered_product_name',
      ''
    ))) as normalized_name,
    coalesce(ji.quantity, 0) as quantity,
    coalesce(ji.blank_product_id::text, '') as blank_product_id
  from public.job_items ji
  where ji.job_id = 170
)
select
  source_line_id,
  normalized_sku,
  normalized_name,
  quantity,
  blank_product_id,
  count(*) as matching_row_count,
  array_agg(id order by id) as job_item_ids
from lines
group by
  source_line_id,
  normalized_sku,
  normalized_name,
  quantity,
  blank_product_id
having count(*) > 1
order by matching_row_count desc, min(id);


-- Result 5: all triggers on job_items.
-- Look for triggers that INSERT into job_items or synchronize manual orders.
select
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition,
  p.oid::regprocedure as trigger_function,
  pg_get_functiondef(p.oid) as trigger_function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname = 'job_items'
order by t.tgname;


-- Result 6: definitions of every pull-sheet read/sync function.
-- A read function should not contain INSERT INTO job_items.
select
  p.oid::regprocedure as function_signature,
  case p.provolatile
    when 'i' then 'immutable'
    when 's' then 'stable'
    else 'volatile'
  end as volatility,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'sc_pull_sheet_items',
    'sc_pull_sheet_items_catalog_v1',
    'sc_pull_sheet_ordered_blank_pairings',
    'sc_sync_manual_invoice_order_to_generated_job',
    'sc_generate_job_from_manual_invoice_order'
  )
order by p.proname, p.oid::regprocedure::text;


-- Result 7: reservations connected to pull sheet 170.
do $diagnostic$
begin
  if to_regclass('public.inventory_reservations') is null then
    raise notice 'public.inventory_reservations does not exist.';
  end if;
end
$diagnostic$;

select
  r.job_item_id,
  count(*) as reservation_rows,
  sum(coalesce(r.quantity, 0)) as reserved_quantity,
  array_agg(r.id order by r.id) as reservation_ids
from public.inventory_reservations r
join public.job_items ji
  on ji.id::text = r.job_item_id::text
where ji.job_id = 170
group by r.job_item_id
order by r.job_item_id;


-- Result 8: source manual-order details, when exposed through the detail view.
-- This uses JSON so optional columns do not cause compilation failures.
select
  to_jsonb(m) as manual_invoice_line
from public.sc_manual_invoice_order_items_detail m
where coalesce(
  to_jsonb(m)->>'generated_job_id',
  to_jsonb(m)->>'job_id',
  ''
) = '170'
or coalesce(
  to_jsonb(m)->>'generated_job_item_id',
  ''
) in (
  select ji.id::text
  from public.job_items ji
  where ji.job_id = 170
)
order by coalesce(
  (to_jsonb(m)->>'line_number')::integer,
  0
);
