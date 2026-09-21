# Skilled Crafting Inventory App v1.4.18
## Purchasing Fallback Double-Count Fix

### Root cause
v1.4.17 correctly made authoritative Purchasing inventory fail closed and added
job-item-aware fallback deduplication. However, when authoritative inventory
correctly reduced a reservation-backed Purchasing row to zero, that row was
filtered out before integrity fallback merge.

For a fallback-only item, the merge then initialized `current` with the fallback
row (already quantity 8 for Pull Sheet 270 Black AM) and added the same fallback
adjustment (8) again, displaying 16.

The same branch displayed Black AL as 14 instead of 7.

### Fix
Fallback-only rows are now inserted exactly once using the database-calculated
fallback order quantity. Existing-row fallback deduplication remains unchanged.

### Expected production values after deploy
- GILDAN-18500-BLACK-AM: Order Qty 8
- GILDAN-18500-BLACK-AL: Order Qty 7
- GILDAN-18500-SPORT-GREY-AM: threshold recommendation remains 2, assuming
  inventory state has not otherwise changed.

### Database impact
None. No Supabase SQL or data cleanup is required for v1.4.18.
