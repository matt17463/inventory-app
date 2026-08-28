# Product-to-Blank Mapping Lifecycle v1.2.0

This release fixes new WooCommerce and Mockup Studio variations that do not pair to inventory blanks. It also adds a controlled workflow for replacing a discontinued blank with another brand/style while preserving historical inventory and pull-sheet work.

## What changes

- New WooCommerce sync rows are paired automatically only when Brand + Style + Color + Size identifies exactly one active blank.
- Ambiguous and missing matches appear under **Tools > Product-to-Blank Mappings**.
- Manual pull-sheet overrides can remember both the WooCommerce variation ID and SKU for future orders.
- Mockup Studio resolves every Color/Size blank before it exports variations and saves confirmed Woo variation/SKU mappings afterward.
- A discontinued blank can be redirected to a replacement with a preview of affected mappings, products, finished-product definitions, and open pull sheets.
- Existing paired pull-sheet lines, reservations, completed jobs, and inventory history are preserved. Use **Bulk Pairing Repair** if an already paired open line truly must be changed.
- Pull sheets now load the saved WooCommerce product ID, variation ID, pairing source, and warning instead of incorrectly reporting that a captured variation is missing.

No new Netlify environment variables are required.

## Deployment order

### 1. Install the database migration

In Supabase, open **SQL Editor**, create a new query, paste the complete contents of:

`deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`

Select **Run**. This is additive and does not delete inventory, products, orders, mappings, or images.

Then run:

`deployment/sql/45_VERIFY_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`

Every verification row should report `PASS`. The final result set is the review queue and may contain rows.

### 2. Apply and validate the source package

Use the terminal block supplied with the release. It checks the repository and patch first, creates a dedicated branch, applies the files, installs the locked dependencies, and runs the full test/build suite.

### 3. Push and open the pull request

Push branch `feature/product-blank-mapping-lifecycle-v1.2.0`, open the supplied GitHub comparison link, and merge it into `main` after all checks pass.

### 4. Verify Netlify

In Netlify, confirm the production deploy is from `main` and that `package.json` version `1.2.0` was built. No environment-variable changes are needed.

## First-use workflow after deployment

1. Open **Tools > Product-to-Blank Mappings**.
2. Select **Run deterministic backfill** once.
3. Exact, unique Brand/Style/Color/Size matches are saved and currently unpaired pull-sheet lines are repaired.
4. Review rows still shown:
   - **matched**: select **Accept exact match**.
   - **ambiguous**: select **Choose blank** and choose the correct blank manually.
   - **missing**: first create/correct the Brand, Style, Color, Size, or blank in inventory; refresh and map it.
5. Open the affected pull sheet. The selected blank should now appear. If its synced product row was missing from the review queue, use **Override Blank Pairing** on that line and keep **Remember this variation/SKU mapping** checked.

For the previously reported line, Woo variation `15376` was captured but `blank_product_id` was null. After deployment, either the deterministic backfill will pair it or the pull-sheet override will save variation `15376` and its SKU as durable future mappings.

## Mockup Studio workflow

Before exporting a variable product, ensure that inventory contains one active blank for every selected:

`Brand + Style + Color + Size`

Mockup Studio now checks that matrix before it creates/updates Woo variations. A missing or ambiguous combination stops the export and lists the exact Color/Size combinations to fix. After WooCommerce confirms the variation IDs, the application records both variation-ID and SKU mappings automatically.

This means logo choices do not create duplicate blank inventory mappings: every logo variation for the same Color/Size points to the same physical blank.

## Replacing a discontinued blank

1. Open **Tools > Product-to-Blank Mappings**.
2. In **Replace a discontinued blank**, search for and select the old blank.
3. Search for and select the replacement blank.
4. Enter the vendor/discontinuation reason.
5. Select **Preview replacement**.
6. Review the counts, especially **open paired lines preserved**.
7. Select **Apply future mapping replacement** and confirm.

The replacement updates future mapping keys, synced product definitions, finished-product definitions, legacy mapping rows, and currently unpaired lines. It deliberately does not rewrite already paired open lines because they may have reservations or physical work attached.

If an already paired open order must use the new blank, open **Bulk Pairing Repair**, filter by the old blank, preview the selected lines and reservations, then apply the repair deliberately.

Do not archive or delete the old blank until its on-hand inventory and active reservations have been reviewed. Keeping it available preserves the ability to finish old work with remaining stock.

## Smoke test

1. Open **Product-to-Blank Mappings** and confirm the page loads.
2. Run the deterministic backfill and record the mapped/review counts.
3. Map one test Woo variation manually.
4. Reopen its pull sheet and verify the blank, Brand, Style, Color, Size, and pairing warning.
5. In Mockup Studio, update a draft product with one Color, one Size, and one Logo.
6. Confirm the export reports saved blank mappings.
7. Create a test Woo order for the variation and verify its pull-sheet line pairs automatically.
8. Preview (but do not apply) a blank substitution and verify the affected counts are reasonable.

## Rollback

Revert the GitHub pull request to remove the interface and runtime behavior. The two new mapping/history tables can remain safely in Supabase; they are additive and do not affect older application code. Do not drop the tables if you want to preserve mapping decisions and substitution history.
