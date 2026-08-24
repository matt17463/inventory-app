# Supplier Receiving Match and Save Fix v0.8.14

This patch fixes two problems on **Add Item to Bin → Import Supplier Order Confirmation**:

1. The Color lists were reading the full `colors` table, including archived colors and source aliases. They now use only active canonical colors.
2. Every remaining invoice row was selected automatically, and one incomplete row stopped the entire receipt. The page now identifies exactly which selected rows need fields and includes **Select Ready Rows** for an intentional partial receipt.

It also protects older saved supplier-SKU mappings. If a saved blank points to a retired source color, the importer keeps its brand, style, and size but resolves it to the active canonical-color blank before receiving inventory.

No additional Supabase SQL or Netlify environment variables are required for v0.8.14. The v0.8.12 and v0.8.13 color migrations must already be installed.

## Apply the patch

Download `inventory-app-supplier-receiving-match-fix-v0.8.14.zip` into your Mac's Downloads folder. Then paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-match-fix-v0.8.14.zip"
BRANCH="feature/supplier-receiving-match-fix-v0.8.14"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

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
npm run check

git add \
  package.json \
  package-lock.json \
  src/AddItemToBin.jsx \
  src/SupplierConfirmationReceiving.jsx \
  src/index.css \
  netlify/functions/supplier-confirmation-parse.js \
  netlify/functions/supplier-receiving-action.js \
  scripts/tests/supplier-confirmation-parser.test.mjs \
  DEPLOY_SUPPLIER_RECEIVING_MATCH_FIX_v0.8.14.md

git commit -m "Fix supplier receiving color choices and row validation v0.8.14"
git push -u origin "$BRANCH"
```

If Terminal reports that the branch already exists, replace `git switch -c "$BRANCH"` with:

```bash
git switch "$BRANCH"
```

## Create the pull request

Open:

<https://github.com/matt17463/inventory-app/compare/main...feature/supplier-receiving-match-fix-v0.8.14?expand=1>

Create the pull request, wait for all checks to pass, merge into `main`, and wait for Netlify's Production deployment to finish.

## Verify the fix

1. Open **Add Item to Bin** and select **Refresh Lists**.
2. Confirm the default Color list no longer contains archived/source-alias duplicates.
3. Upload the supplier confirmation again and select **Read Confirmation**.
4. Each complete line should turn green and say **Ready**.
5. Incomplete lines state the exact missing fields, such as `Missing: Color, Size`.
6. To receive only complete rows, select **Select Ready Rows**.
7. Confirm the summary reports the expected ready rows and units.
8. Select **Receive Selected Units**.
9. Confirm the success message reports received units and the receipt appears in Supplier receiving history.

If a color still appears, it is an active canonical color. Use **Color Pairings → Unused Color Cleanup** to scan and archive a genuinely unused color; this patch intentionally does not hide legitimate active canonical colors.

