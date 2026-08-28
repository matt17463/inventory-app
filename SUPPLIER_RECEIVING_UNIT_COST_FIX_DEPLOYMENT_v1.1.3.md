# Supplier Receiving Unit Cost Fix v1.1.3

This update fixes the supplier-confirmation receiving error:

> null value in column "unit_cost" of relation "blank_products" violates not-null constraint

It is built on application v1.1.2 and does not require new Netlify environment variables.

## What changes

- Carries the editable Cost value from each supplier receipt row into a newly created blank product.
- Stops a new blank product and shows an actionable message when its cost is missing or invalid.
- Preserves an existing product's saved unit cost during brand, style, color, or size corrections.
- Stores a missing receipt cost as SQL `NULL` for an existing product instead of silently changing it to zero.
- Gives the guarded database create function a safe zero fallback if another application path omits cost.
- Gives `blank_products.unit_cost` a database default of zero while retaining its `NOT NULL` protection.
- Rejects negative costs in both the application and guarded SQL functions.

## Files in the update

- `src/lib/unitCost.js`
- `src/lib/inventoryApi.js`
- `src/AddItemToBin.jsx`
- `src/SupplierConfirmationReceiving.jsx`
- `netlify/functions/supplier-receiving-action.js`
- `scripts/tests/supplier-confirmation-parser.test.mjs`
- `deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql`
- `deployment/sql/41_VERIFY_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql`
- `package.json`
- `package-lock.json`

## Phase 1 — Run the Supabase repair SQL

1. Sign in to Supabase.
2. Open the inventory project.
3. Open **SQL Editor** and choose **New query**.
4. Open `deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql` from this package.
5. Copy the entire file into the query editor and click **Run** once.
6. The result should show:
   - `guarded_create_ready = true`
   - `guarded_update_ready = true`
   - `unit_cost_required = true`

This migration is safe to run again. It does not delete products, inventory, receipts, or movements.

## Phase 2 — Verify Supabase

1. Open a second new Supabase SQL query.
2. Copy all of `deployment/sql/41_VERIFY_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql` into it.
3. Click **Run**.
4. Confirm every returned value is `true`:
   - `unit_cost_is_not_null`
   - `unit_cost_has_zero_default`
   - `guarded_create_ready`
   - `guarded_update_ready`
   - `guarded_create_defaults_missing_cost`
   - `guarded_update_preserves_existing_cost`
   - `no_null_product_costs`

Do not continue until all seven values are true.

## Phase 3 — Install the application files

Copy and paste this complete block into Terminal on the Mac:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-unit-cost-fix-v1.1.3.zip"
BRANCH="feature/supplier-receiving-unit-cost-v1.1.3"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Git repository was not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: Patch ZIP was not found at $PATCH_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c "$BRANCH"

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run test:supplier-receiving
npm run check

git add \
  src/lib/unitCost.js \
  src/lib/inventoryApi.js \
  src/AddItemToBin.jsx \
  src/SupplierConfirmationReceiving.jsx \
  netlify/functions/supplier-receiving-action.js \
  scripts/tests/supplier-confirmation-parser.test.mjs \
  deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql \
  deployment/sql/41_VERIFY_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql \
  SUPPLIER_RECEIVING_UNIT_COST_FIX_DEPLOYMENT_v1.1.3.md \
  SUPPLIER_RECEIVING_UNIT_COST_FIX_MANIFEST_v1.1.3.json \
  package.json \
  package-lock.json

git commit -m "Fix supplier receiving unit cost handling v1.1.3"
git push -u origin "$BRANCH"
```

If the clean-worktree check stops, do not delete or overwrite those files. Move or commit your unrelated work first, and then run the block again.

## Phase 4 — Open and merge the pull request

Open:

<https://github.com/matt17463/inventory-app/compare/main...feature/supplier-receiving-unit-cost-v1.1.3?expand=1>

Use this title:

`Fix supplier receiving unit cost handling v1.1.3`

Confirm the automated checks pass, merge the pull request into `main`, and wait for the production Netlify deploy to finish successfully.

## Phase 5 — Confirm the deployment

In Netlify:

1. Open the production site.
2. Open **Deploys**.
3. Confirm the newest production deploy is based on `main` and is **Published**.
4. Open the deployed site in a fresh browser tab.
5. If the old screen is cached, perform one hard refresh.

No environment-variable changes are required.

## Phase 6 — Functional smoke test

Use a supplier confirmation containing a line whose blank product does not already exist.

1. Open **Add Item to Bin**.
2. Upload the supplier confirmation PDF and click **Read Confirmation**.
3. Confirm the Cost field is populated from the document; correct it if needed.
4. Complete Bin, Brand, Style, Color, and Size.
5. Receive one test line.
6. Confirm the receipt succeeds and the new blank product is created.
7. Open the new blank product and confirm its unit cost matches the receipt.
8. Edit only an attribute on that product and save it.
9. Confirm the saved unit cost did not change.

Also test a line mapped to an existing product. Leaving receipt cost blank must not reset that product's existing cost to zero.

## Expected behavior after deployment

- New product plus valid receipt cost: product is created and the receipt is applied.
- New product plus blank cost: row remains in review and identifies **Unit Cost** as missing.
- New product plus negative/invalid cost: receiving is blocked with a clear validation message.
- Existing product plus blank receipt cost: inventory is received without replacing the product's saved cost.
- Attribute-only product edit: existing cost is preserved.

## Rollback

If the application deploy must be rolled back, use Netlify's previous successful production deploy or revert the v1.1.3 Git commit. The SQL migration may remain installed; it is backward-compatible and prevents invalid null costs. Do not rerun the older SQL 28 or SQL 30 function definitions after SQL 40, because those older definitions reintroduce the null-cost behavior.
