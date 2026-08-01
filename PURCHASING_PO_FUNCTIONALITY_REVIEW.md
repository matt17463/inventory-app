# Purchasing and Purchase Order Functionality Review

## Root cause found

The application used two separate recommendation systems:

1. `Purchasing.jsx` called `getPurchasingRecommendedOrders()`, which included
   the newer Pending Stock purchasing logic.
2. `PurchaseOrderGenerator.jsx` called `getPurchaseOrderRecommendations()`,
   which used the older `phase1_get_purchase_recommendations` RPC.
3. `WaitingOn.jsx` used the older `phase1_get_waiting_on_items` RPC.

The result was that the Purchasing Report could correctly show an item while
the Create Purchase Order and Waiting On screens omitted it.

## Other issue found

The PO receiving screen loaded every bin, including Pending Stock. Pending
Stock is not physical inventory and should never be selected as the receiving
destination for an arriving item.

## Corrected workflow

- Purchasing Report remains the authoritative demand calculation.
- Create Purchase Order displays the same recommendation rows.
- Open PO quantities are calculated separately and subtracted from demand.
- Covered items remain visible for reconciliation, but cannot be reordered.
- Waiting On uses the same current-shortage rows.
- PO receiving accepts only physical bins.

## Database impact

No schema, table, view, RPC, or migration change is required.
