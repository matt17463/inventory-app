# Skilled Crafting Inventory App v1.4.16
## Pull Sheet / Purchasing Integrity — R3

This revision is built from the read-only v1.4.15 source inspection captured on the feature branch.

### Changes
- Pull Sheets list now displays **Pull Sheet #** directly instead of exposing the number only after opening the pull sheet.
- Pull Sheet detail audits each active line against its active reservation and the authoritative Purchasing inventory model.
- Admin/manager users can run **Reconcile Purchasing** from a line with a detected integrity problem.
- Reconciliation cancels active reservations tied to the wrong blank, creates/repairs a reservation when usable stock exists, or assigns a true shortage to Pending Stock.
- Physical inventory counts and inventory movement history are not changed by reconciliation.
- Purchasing loads a database-calculated integrity adjustment after the existing v1.4.15 authoritative inventory and Pending Stock logic, so an unrepresented pull-sheet shortage cannot silently disappear.
- Recommended Orders receives the mathematically correct incremental adjustment, including low-stock threshold effects, instead of blindly adding the shortage quantity.
- Newly established exact `products.blank_product_id` mappings can reconcile eligible open, currently-unpaired pull-sheet lines.
- `MANUAL-<order>-LINE-<line>` placeholders are never treated as durable automatic SKU mappings.

### Why R3
The v1.4.15 Purchasing API already contains substantial Pending Stock, non-inventory, demand-source, and authoritative-inventory reconciliation logic. R3 extends that actual architecture rather than replacing it.
