# Release Notes — 0.6.18

## Pending Stock workflow

- Renames the workflow concept from **Unassigned** to **Pending Stock**.
- Continues recognizing legacy `Unassigned` bin records during transition.
- Prioritizes a bin whose code or label is `Pending Stock`.
- Keeps out-of-stock pull-sheet lines assigned to the same saved bin record.
- Updates pull-sheet and manual-order messages to use **Pending Stock**.

## Purchasing report correction

- Open pull-sheet lines assigned to Pending Stock now count as purchasing demand.
- They appear in **Current Shortages**.
- They appear in **Recommended Orders**.
- Their quantities are included in purchasing totals and the supplier summary.
- The purchasing report shows a visible `Pending Stock: N` indicator.
- Closed, cancelled, voided, completed, and deducted job lines are excluded.

## Database change

Run:

```text
deployment/sql/06_RENAME_UNASSIGNED_BIN_TO_PENDING_STOCK.sql
```

The SQL preserves the existing bin ID and all references. It does not move or
delete inventory.
