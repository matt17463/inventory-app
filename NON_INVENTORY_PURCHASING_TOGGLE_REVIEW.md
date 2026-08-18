# Non-Inventory Purchasing Toggle — Functionality Review

## Existing problem

The application treated **non-inventory** as one decision, but operationally
there are two different questions:

1. Should this item reserve and deduct tracked inventory?
2. Does this item still need to be purchased for the order?

Those answers are not always the same.

Examples:

- Artwork fee: no inventory, no purchasing.
- Customer-supplied garment: no inventory, no purchasing.
- Special-order item not stocked internally: no inventory tracking, but it may
  still need purchasing.
- Outsourced service: no inventory, but it may need to remain visible to a
  buyer depending on the workflow.

## New model

`inventory_required` continues controlling reservation and deduction.

`include_on_purchasing_report` controls purchasing demand independently.

## Purchasing reconciliation

The application reads included non-inventory lines directly from `job_items`.
It also removes excluded job-item sources from aggregated reservation demand.
It does not remove unrelated demand for the same blank product.
