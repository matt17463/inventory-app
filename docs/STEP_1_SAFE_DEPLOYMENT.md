# Step 1 Safe Deployment Instructions

## Do not run the old combined SQL file for this step

Do not re-run `supabase_feature_updates_incremental_samples_bins.sql` as part of this deployment. It contains older sample-model definitions, view drops, and broad grants that are outside this safe consolidation.

## Before changing anything

1. Create a fresh Supabase database backup or point-in-time recovery checkpoint.
2. Save the current deployed Netlify build and environment-variable list.
3. Open the Supabase SQL editor and run `supabase/verification/000_step1_preflight_read_only.sql`.
4. Save or export the results.
5. Stop if either `blank_products` or `blank_inventory_movements` is missing, or if the preflight returns unexpected data types.

## Required SQL deployment order

Run these files one at a time:

1. `supabase/migrations/202607250001_inventory_model_registry.sql`
2. `supabase/migrations/202607250002_sample_products_canonical_support.sql`
3. `supabase/verification/900_step1_post_install_verification.sql`

The first migration creates only model metadata, comments, and a health-check function.

The second migration creates missing sample support objects and columns. Existing sample rows are not updated or deleted, and an existing `sample_products_with_bins` view is not replaced.

## Optional SQL

Run `supabase/optional/202607250003_optional_sample_image_bucket.sql` only when the Sample Inventory page reports that the storage bucket is missing.

Run `supabase/optional/202607250004_optional_legacy_write_monitor.sql` only when you want to monitor whether any old client still writes to `bin_items`. It logs writes but does not block them.

## Application deployment

Deploy the supplied application files after the required SQL succeeds. The `/create-product` compatibility route remains available, but it no longer inserts directly into the WooCommerce `products` table. It directs employees to the current receiving and blank-product editing workflows.

The old `AssignBin.jsx`, `BinPage.jsx`, and `SelectProduct.jsx` components are converted to safe compatibility screens and no longer insert into or link toward `bin_items`.

## Smoke test after deployment

Perform these tests against one known existing item and order:

1. Open Blank Inventory and confirm current quantities are unchanged.
2. Open a bin and confirm its contents are unchanged.
3. Receive one test blank through `/add-item`; verify exactly one positive movement is added.
4. Transfer that test unit between bins; verify one negative and one positive movement.
5. Open Pull Sheets and confirm existing orders and mappings still load.
6. Open one existing pull sheet and confirm its `blank_product_id` mappings are unchanged.
7. Open Sample Inventory and confirm all existing sample rows load.
8. Create, edit, and delete one temporary sample.
9. Visit `/create-product` and confirm it presents the safe replacement links rather than writing a Woo catalog row.
10. Run `select public.sc_inventory_model_health_v1();` and save the result.

## Rollback

The database migrations do not rewrite operational rows. If the application patch must be rolled back, redeploy the previous React files. Leave the new registry and health function in place; they do not affect inventory processing.

Do not drop `sample_products`, `sample_product_types`, `sample_products_with_bins`, `bin_items`, or `sample_inventory` during rollback.
