# Release Notes — 0.6.17

## Out-of-stock pull-sheet bin assignment

- Manual invoice jobs now automatically persist zero-on-hand paired lines to the existing **Unassigned** bin.
- Pull-sheet loading repairs older open lines that have zero on-hand inventory and no valid bin assignment.
- The pull sheet displays **Out of Stock — Unassigned** and selects the Unassigned bin automatically.
- Users are no longer required to choose a physical source bin for an item that has no stock.
- **Complete + Deduct Blank** is disabled for out-of-stock lines until inventory is received.
- **Complete All + Deduct Blanks** processes only in-stock lines and leaves shortages assigned to Unassigned.
- No database migration is required.
- The existing bin must have a code or label containing `Unassigned`.
