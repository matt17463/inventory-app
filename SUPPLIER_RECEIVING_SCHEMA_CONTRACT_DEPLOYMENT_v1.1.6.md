# Supplier Receiving Schema Contract Repair v1.1.6

This package repairs the supplier-confirmation import error:

> Could not find the `document_mime_type` column of `sc_supplier_receiving_imports` in the schema cache

The root cause is schema drift. The original supplier-receiving migration created the order tables, while a later R2 migration introduced four document metadata columns. The deployed function was newer than the database table.

## What this repair changes

- Adds a cumulative, repeatable SQL contract containing every table and column used by supplier receiving.
- Adds the missing R2 document fields: provider, bucket, path, byte size, MIME type, and SHA-256.
- Explicitly refreshes Supabase/PostgREST's schema cache.
- Checks the complete schema before parsing or uploading a supplier PDF.
- Uploads the PDF only after schema, matching, and duplicate-order validation succeeds.
- Replaces supplier-import `.upsert()` calls with read/insert/update plus safe concurrent-insert recovery.
- Keeps the same receipt request key after a network failure, preventing a retry from creating a second receipt.
- Treats failures to remember optional SKU/color aliases as warnings after inventory has already been received.
- Reports duplicate natural-key groups without deleting or merging records.

The SQL is additive and contains no product, inventory, receipt, or document deletion.

## Phase 1 — Repair and verify Supabase first

1. Open Supabase for the production project.
2. Open **SQL Editor** and create a new query.
3. Open `deployment/sql/42_SUPPLIER_RECEIVING_SCHEMA_CONTRACT.sql` from this package, copy the entire file into the query, and click **Run**.
4. Wait 30 seconds. The migration explicitly requests a PostgREST schema-cache reload.
5. Create another new query.
6. Open `deployment/sql/43_VERIFY_SUPPLIER_RECEIVING_SCHEMA_CONTRACT.sql`, copy the entire file, and click **Run**.

The verification must return one row with:

- `contract_ready` = `true`
- `document_mime_type_ready` = `true`
- every `*_duplicate_groups` value = `0`
- `missing_columns` = `[]`

If any duplicate count is greater than zero, stop before receiving inventory and save the verification row. SQL 42 deliberately does not guess which historical record should be removed.

## Phase 2 — Apply the application patch on the Mac

Download `inventory-app-supplier-receiving-contract-v1.1.6.zip` to the Mac Downloads folder. Then paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-contract-v1.1.6.zip"
BRANCH="feature/supplier-receiving-contract-v1.1.6"

test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c "$BRANCH"
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false npm run check

git add \
  package.json \
  package-lock.json \
  src/SupplierConfirmationReceiving.jsx \
  netlify/functions/supplier-confirmation-parse.js \
  netlify/functions/supplier-receiving-action.js \
  netlify/functions/_shared/supplierReceivingContract.js \
  scripts/tests/supplier-confirmation-parser.test.mjs \
  deployment/sql/42_SUPPLIER_RECEIVING_SCHEMA_CONTRACT.sql \
  deployment/sql/43_VERIFY_SUPPLIER_RECEIVING_SCHEMA_CONTRACT.sql \
  SUPPLIER_RECEIVING_SCHEMA_CONTRACT_DEPLOYMENT_v1.1.6.md

git commit -m "Repair supplier receiving schema contract v1.1.6"
git push -u origin "$BRANCH"
```

Expected local result: all tests, lint, the Vite production build, and production-bundle verification pass.

## Phase 3 — Open and merge the pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/supplier-receiving-contract-v1.1.6?expand=1

Use this pull-request title:

`Repair supplier receiving schema contract v1.1.6`

Wait for GitHub and Netlify preview checks to pass, then merge into `main`.

## Phase 4 — Verify Netlify production

1. Open the Netlify production deploy created from the merge.
2. Confirm the deploy status is **Published**.
3. Confirm the deployed commit is the merge commit from the pull request.
4. No new environment variables are required. Existing R2 variables and `ASSET_STORAGE_PROVIDER=r2` remain required.
5. Hard-refresh the inventory application once after the production deploy.

## Phase 5 — Supplier receiving smoke test

Use a real confirmation but receive only a small, known line first.

1. Open **Add Item to Bin**.
2. Choose the default receiving bin.
3. Upload an S&S Activewear or Momentec PDF and click **Read Confirmation**.
4. Verify the order summary and every parsed line appear.
5. Verify existing SKU, brand, style, color, and size matches are retained.
6. Resolve any yellow/red row rather than accepting an ambiguous color or product.
7. Select one known line and enter its actual received quantity.
8. Click **Receive Selected** once.
9. Verify the success message, the receiving history entry, and the inventory movement.
10. Open the stored PDF from receiving history to confirm its private R2 link works.
11. Refresh and reopen the same confirmation. Previously received units must be shown and only the remaining quantity may be received.

## If an error remains

- Re-run SQL 43 and save its complete one-row result.
- In Netlify, open **Functions > supplier-confirmation-parse** and **supplier-receiving-action**, then save the first complete error for the failed request.
- Confirm production is actually running version `1.1.6`.
- Do not repeatedly click Receive if a request is still processing. The stable request key protects retries after a failed response, but the history record should be inspected before intentionally starting another receipt.

## Rollback

The application change can be reverted with a normal GitHub revert of the merge commit. SQL 42 is additive and should remain installed; removing its columns could make existing receiving history and R2 document references unreadable.

