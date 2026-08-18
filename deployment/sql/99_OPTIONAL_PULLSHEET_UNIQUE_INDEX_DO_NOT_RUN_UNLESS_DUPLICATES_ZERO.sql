-- Skilled Crafting Inventory App
-- FINAL OPTIONAL HARDENING: prevent duplicate WooCommerce line items in one job.
--
-- Your final audit reported:
--   duplicate_job_items_by_woocommerce_line = 0
--
-- This script is safe to run more than once.
-- It does not change any inventory, order, reservation, or job-item row.
-- It may briefly lock public.job_items while PostgreSQL creates the index.

set lock_timeout = '10s';
set statement_timeout = '5min';

do $block$
declare
  v_duplicate_groups bigint;
begin
  if to_regclass('public.job_items') is null then
    raise exception 'public.job_items is missing. Nothing was changed.';
  end if;

  select count(*)
    into v_duplicate_groups
  from (
    select job_id, woocommerce_line_item_id
    from public.job_items
    where woocommerce_line_item_id is not null
    group by job_id, woocommerce_line_item_id
    having count(*) > 1
  ) duplicates;

  if v_duplicate_groups > 0 then
    raise exception
      'Index was not created because % duplicate job/line-item group(s) exist. Nothing was changed.',
      v_duplicate_groups;
  end if;

  execute '
    create unique index if not exists job_items_job_woo_line_uidx
    on public.job_items(job_id, woocommerce_line_item_id)
    where woocommerce_line_item_id is not null
  ';
end
$block$;

select
  case when to_regclass('public.job_items_job_woo_line_uidx') is not null
       then 'PASS'
       else 'STOP'
  end as status,
  'job_items_job_woo_line_uidx' as index_name,
  case when to_regclass('public.job_items_job_woo_line_uidx') is not null
       then 'Unique pull-sheet line protection is installed.'
       else 'The index was not created.'
  end as detail;
