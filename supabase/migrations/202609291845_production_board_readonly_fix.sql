-- Skilled Crafting Inventory App v1.4.24
-- Production Board read-only transaction repair
--
-- sc_list_order_status_board_v2 calls the legacy production-board RPC, which
-- may perform reconciliation writes. PostgreSQL STABLE functions execute under
-- a read-only function context for SQL data-modifying statements, so this
-- wrapper must be VOLATILE.
--
-- This migration is intentionally additive: it preserves historical migration
-- files and repairs the function property after the original v0.8.3 migration.

begin;

alter function public.sc_list_order_status_board_v2(
  text,
  text,
  integer
)
volatile;

comment on function public.sc_list_order_status_board_v2(text, text, integer) is
  'Production Board rows corrected from active job_items; VOLATILE because the legacy board RPC may reconcile persisted production status.';

commit;
