# Release Notes — 0.6.20

## Pending Stock assignment reconciliation

This release fixes a pull-sheet line that remained on the purchasing report
after inventory was received and a physical source bin was selected.

### Root causes corrected

1. The pull-sheet bin dropdown updated browser state but did not persist
   `job_items.selected_bin_id`.
2. Legacy compatibility treated every bin named `Unassigned` as Pending Stock,
   even when an official `Pending Stock` bin existed.
3. Pending Stock demand could be added a second time when the same job item was
   already represented by reservation-based purchasing demand.

### Correct behavior

- `Pending Stock` is the only virtual shortage bin.
- A separate physical `Unassigned` bin counts as usable inventory.
- Choosing a source bin saves immediately to `job_items.selected_bin_id`.
- When a stale Pending Stock line has exactly one usable physical bin, opening
  the pull sheet automatically saves that physical bin.
- When multiple physical bins contain the item, Pending Stock is cleared and
  the employee chooses the correct physical source bin.
- Purchasing adds only Pending Stock demand not already represented by the
  reservation/demand-source system.
- No SQL migration is required.
