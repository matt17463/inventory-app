-- Skilled Crafting Inventory App v1.4.16
-- SQL 67 - Pending Stock helper correction
--
-- SQL 63 R3.2 used COALESCE(bin_code, label, ...) and then compared only the
-- first non-null value. If an existing workflow bin had label = 'Pending Stock'
-- but a different legacy bin_code, the helper incorrectly returned NULL.
--
-- This correction matches the app's established Pending Stock definition:
-- bin_code OR label can identify the official virtual Pending Stock bin.
--
-- IMPORTANT:
-- * This does not rename or create any bin.
-- * It does not treat a physical "Unassigned" bin as Pending Stock.
-- * It does not change inventory, reservations, pull sheets, or movement history.
-- * Safe to rerun.

begin;

create or replace function public.sc_ppi_pending_stock_bin_id_v1()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.bins b
  where lower(trim(coalesce(b.bin_code, ''))) in (
          'pending stock',
          'pending-stock',
          'pending_stock',
          'pendingstock'
        )
     or lower(trim(coalesce(b.label, ''))) = 'pending stock'
  order by b.display_order nulls last, b.id
  limit 1;
$$;

notify pgrst, 'reload schema';

commit;
