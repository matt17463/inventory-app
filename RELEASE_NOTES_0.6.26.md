# Release Notes — 0.6.26

## Atomic, idempotent pull-sheet completion

Diagnostics established that pull sheet 165 successfully deducted the Under
Armour backpack through movement 960, but job item 215 remained `pulled`.
Movements 962 and 963 belong to jobs 163 and 164 respectively.

Version 0.6.26:

- Repairs job item 215 without deducting another backpack.
- Adds `job_item_id`, `job_id`, and `source_type` attribution to future blank
  inventory movements.
- Links movements 960, 962, and 963 to their proven job items.
- Creates one unique pull-sheet completion movement per job item.
- Makes completion retries idempotent.
- Routes both individual and bulk pull-sheet completion through the safe RPC.
- Keeps the old `complete_job_item` RPC as a compatibility wrapper around the
  safe implementation.
- Returns a clear message when completion was already recorded.

The current backpack quantity remains 1.
