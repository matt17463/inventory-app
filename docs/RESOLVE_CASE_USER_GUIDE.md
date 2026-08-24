# Resolve Duplicate Product Cases

Version 1.0.2 supports the UUID identifiers used by production blank-product records.

## Who can resolve a case

Only active application users with the `admin` or `manager` role can preview, reject, reopen, or apply a duplicate-product resolution.

## Create the review case

1. Open Product Integrity Center and identify records in the same duplicate group.
2. Open Operations Integrity → Duplicate Workbench.
3. Select every record representing the same physical blank.
4. Select the correct proposed survivor.
5. Enter a reason describing why the records are duplicates.
6. Click Create Review Case.

Creating the case does not change products or inventory.

## Preview the resolution

1. In Review Cases, find the case and click Preview Resolve.
2. Review the survivor ID and each product being archived.
3. Compare the net ledger quantity and movement count for every product.
4. Review every table and row count under References that will be repointed.
5. Read all warnings. A warning about different brand, style, color, or size means you must verify the survivor carefully.

The preview expires after 30 minutes. If a reference changes after preview, application is blocked and a new preview is required.

## Apply the resolution

Apply only when all of the following are true:

- Every selected record is the same physical blank.
- The survivor has the correct brand, style, color, size, SKU, barcode, cost, and image.
- The combined ledger quantities make sense.
- The reference tables are appropriate.
- A current database backup exists for the first production resolutions.

Then:

1. Type the exact confirmation phrase shown on the screen.
2. Check the acknowledgement box.
3. Click Resolve Case and Archive Duplicates.

The application repoints references and archives duplicates in one database transaction. It does not rewrite quantity values. If one update fails, the complete operation rolls back.

## What happens to archived duplicates

- The original database row remains.
- The original SKU, barcode, and name are stored in archive fields.
- The duplicate points to the canonical survivor.
- Its visible SKU and name are marked as archived.
- Its former SKU and barcode become aliases to the survivor.
- Primary receiving, pull-sheet, editing, inventory, and Mockup Studio searches hide it.
- Product Integrity diagnostics omit it after refresh.

## Reject or reopen a case

Use Reject when the products are not true duplicates or more investigation is required. Rejected and cancelled cases can be reopened. Completed cases cannot be reopened from the interface.

## After resolving

1. Refresh Product Integrity Center.
2. Verify the duplicate issue has disappeared.
3. Check inventory totals and bin locations.
4. Check active pull sheets and reservations.
5. Check supplier receiving mappings.
6. Check WooCommerce-linked records.

Never adjust inventory quantities merely to make the totals look unchanged. The resolution combines product references; the movement ledger remains the source of truth.
