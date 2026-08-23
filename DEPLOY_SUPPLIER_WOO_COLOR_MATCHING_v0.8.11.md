# Supplier WooCommerce Color Matching v0.8.11

This update completes supplier confirmation lookup matching:

- Missing supplier brands and styles can be created when inventory is received.
- Supplier colors are matched only to existing colors in the application's WooCommerce-synced color lookup.
- `Grey` and `Gray`, punctuation, spaces, and capitalization are normalized.
- Active Color Pairing rules redirect duplicate/alias colors to the canonical color.
- Ambiguous or missing matches remain unselected for review; the importer never creates colors or sizes.

No SQL or new Netlify environment variables are required for v0.8.11.

## 1. Apply the patch

Copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-woo-color-matching-v0.8.11.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"

if test -n "$(git status --porcelain)"; then
  echo "STOP: Uncommitted files were found. Commit, move, or remove them before applying this patch."
  git status
  return 1 2>/dev/null || exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/supplier-woo-color-matching-v0.8.11
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run test:supplier-receiving
npm run check

git add package.json package-lock.json \
  netlify/functions/_shared/supplierColorMatcher.js \
  netlify/functions/supplier-confirmation-parse.js \
  netlify/functions/supplier-receiving-action.js \
  src/SupplierConfirmationReceiving.jsx \
  scripts/tests/supplier-confirmation-parser.test.mjs \
  DEPLOY_SUPPLIER_WOO_COLOR_MATCHING_v0.8.11.md

git commit -m "Match supplier colors to WooCommerce colors v0.8.11"
git push -u origin feature/supplier-woo-color-matching-v0.8.11
```

If Git reports that the branch already exists, use:

```bash
cd "$HOME/inventory-app"
git switch feature/supplier-woo-color-matching-v0.8.11
```

Then repeat the `unzip`, test, add, commit, and push commands above.

## 2. Open and merge the pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/supplier-woo-color-matching-v0.8.11?expand=1

Confirm the checks pass, merge the pull request into `main`, and wait for the Netlify production deployment to finish.

## 3. Verify the deployed version

In Netlify, confirm the production deployment points to the merge commit. In Terminal, verify `main` contains version 0.8.11:

```bash
cd "$HOME/inventory-app"
git fetch origin
git show origin/main:package.json | awk -F'"' '/"version"/ {print $4; exit}'
```

Expected result:

```text
0.8.11
```

## 4. Functional test

1. Open **Add Items to Bin** and upload an S&S Activewear or Momentec confirmation.
2. Read the confirmation.
3. Under each Color selector, verify one of these messages appears:
   - `WooCommerce color exact match`
   - `WooCommerce color pairing rule`
   - `matched blank WooCommerce color`
   - `choose existing WooCommerce color`
   - `ambiguous WooCommerce color`
4. For unmatched or ambiguous colors, choose an existing color from the selector.
5. Receive one small test line and confirm the created/matched blank uses that color.

To permanently consolidate duplicate color names, use the application's **Color Pairings** screen, save the source-to-canonical rule, and then read the supplier PDF again.
