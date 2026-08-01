# Pending Stock Purchasing Reconciliation Review

## Reported behavior

A WooCommerce pull-sheet line was initially assigned to Pending Stock. After
one blank was received into a physical Unassigned bin and selected on the pull
sheet, the purchasing report still requested one and referenced Pending Stock.

## Findings

### The bin selection was not saved

The select control only called `setSelectedBinByLine(...)`. That changed the
visible dropdown but never updated `job_items.selected_bin_id`.

### Physical Unassigned was classified as virtual Pending Stock

The compatibility predicate returned true for both `Pending Stock` and
`Unassigned`. Consequently, inventory in the physical Unassigned bin was
excluded from usable physical inventory.

### Possible duplicate demand

The Pending Stock merge added the whole job-item quantity to
`reserved_quantity`, even when the purchasing demand-source view already
contained that same job item.

## Correction

Version 0.6.20 saves the physical bin, distinguishes the two bin roles, repairs
stale assignments, and deduplicates reservation-backed demand.
