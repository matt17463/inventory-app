-- Skilled Crafting Inventory App 0.6.18
-- Rename the existing workflow placeholder bin from Unassigned to Pending Stock.
--
-- This preserves the bin ID, so existing job_items.selected_bin_id and other
-- references continue to point to the same record.
--
-- Safe behavior:
--   * If a Pending Stock bin already exists, it normalizes its label and exits.
--   * Otherwise it renames the first legacy Unassigned bin.
--   * It does not delete, merge, or move physical inventory.

do $$
declare
  v_pending_id public.bins.id%type;
  v_legacy_id public.bins.id%type;
begin
  select b.id
    into v_pending_id
  from public.bins b
  where lower(trim(coalesce(b.bin_code, ''))) in (
          'pending stock',
          'pending-stock',
          'pending_stock'
        )
     or lower(trim(coalesce(b.label, ''))) = 'pending stock'
  order by b.display_order nulls last, b.id
  limit 1;

  if v_pending_id is not null then
    update public.bins
       set label = 'Pending Stock',
           bin_code = case
             when coalesce(trim(bin_code), '') = '' then 'PENDING-STOCK'
             else bin_code
           end
     where id = v_pending_id;

    raise notice 'Pending Stock bin already exists with ID %.', v_pending_id;
    return;
  end if;

  select b.id
    into v_legacy_id
  from public.bins b
  where lower(trim(coalesce(b.bin_code, ''))) = 'unassigned'
     or lower(trim(coalesce(b.label, ''))) = 'unassigned'
     or lower(trim(coalesce(b.bin_code, ''))) like '%unassigned%'
     or lower(trim(coalesce(b.label, ''))) like '%unassigned%'
  order by b.display_order nulls last, b.id
  limit 1;

  if v_legacy_id is null then
    raise exception
      'No legacy Unassigned bin was found. Create a bin with code PENDING-STOCK and label Pending Stock.';
  end if;

  update public.bins
     set bin_code = 'PENDING-STOCK',
         label = 'Pending Stock'
   where id = v_legacy_id;

  raise notice
    'Renamed legacy Unassigned bin ID % to Pending Stock without changing its ID.',
    v_legacy_id;
end
$$;

-- Verification
select
  id,
  bin_code,
  label,
  location,
  display_order
from public.bins
where lower(trim(coalesce(bin_code, ''))) in (
        'pending stock',
        'pending-stock',
        'pending_stock'
      )
   or lower(trim(coalesce(label, ''))) = 'pending stock'
order by display_order nulls last, id;
