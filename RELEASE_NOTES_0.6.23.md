# Release Notes — 0.6.23

## Non-inventory purchasing toggle

A pull-sheet line can now be marked as non-inventory without automatically
deciding whether it should be purchased.

The line has two independent settings:

- **Inventory Required:** No
- **Include on Purchasing Report:** Yes or No

### Pull-sheet behavior

- Mark Non-Inventory now opens a settings dialog.
- The dialog includes an **Include this item on the Purchasing Report** checkbox.
- The checkbox defaults to checked to preserve existing purchasing demand.
- Unchecking it removes that pull-sheet line from purchasing demand.
- Existing non-inventory lines display a persistent toggle so the choice can be
  changed later.
- The line shows whether purchasing is Included or Excluded.

### Rule behavior

- Non-inventory rules now store the purchasing-report choice.
- Applying rules to current or future pull sheets applies both settings.

### Purchasing behavior

- Included non-inventory lines contribute purchasing demand.
- Excluded non-inventory lines are removed from reservation-based purchasing
  demand when their job-item source can be identified.
- Excluded lines are also omitted from Pending Stock demand.
- Other valid demand for the same blank remains intact.
- A blank can still appear for its independent low-stock threshold even after
  one order line is excluded.

## Database change

Run:

```text
deployment/sql/07_NON_INVENTORY_PURCHASING_TOGGLE.sql
```

before deploying the application.
