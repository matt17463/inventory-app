# Supplier Receiving Build Dependency Hotfix v1.1.4

This corrected package supersedes v1.1.3. The v1.1.3 source update imported the shared R2 operational-storage helper but its ZIP did not include that helper. Netlify therefore stopped with:

> Could not resolve "./_shared/operationalStorage.js"

The `pdf.mjs` `import.meta` messages shown immediately above the failure are warnings and are not the cause of the failed deploy.

## What v1.1.4 includes

- Every application and SQL change from the v1.1.3 unit-cost fix.
- `netlify/functions/_shared/operationalStorage.js`.
- Its local R2 dependency, `netlify/functions/_shared/mockupStorage.js`.
- The full authentication/parser dependency chain used by `supplier-receiving-action.js`.
- A regression test that verifies those shared function files exist.

No additional SQL or Netlify environment variables are required beyond the v1.1.3 instructions.

## If the v1.1.3 pull request is still open

Use these commands to update the existing branch and pull request:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-unit-cost-fix-v1.1.4.zip"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Git repository was not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: Corrected v1.1.4 ZIP was not found at $PATCH_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
test "$CURRENT_BRANCH" = "feature/supplier-receiving-unit-cost-v1.1.3" || {
  echo "STOP: Expected feature/supplier-receiving-unit-cost-v1.1.3 but found $CURRENT_BRANCH"
  return 1 2>/dev/null || exit 1
}

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

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
  netlify/functions/_shared/security.js \
  netlify/functions/_shared/cryptoSecurity.js \
  netlify/functions/_shared/supplierConfirmationParser.js \
  netlify/functions/_shared/operationalStorage.js \
  netlify/functions/_shared/mockupStorage.js \
  scripts/tests/supplier-confirmation-parser.test.mjs \
  deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql \
  deployment/sql/41_VERIFY_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql \
  SUPPLIER_RECEIVING_UNIT_COST_FIX_DEPLOYMENT_v1.1.3.md \
  SUPPLIER_RECEIVING_UNIT_COST_FIX_MANIFEST_v1.1.3.json \
  SUPPLIER_RECEIVING_BUILD_HOTFIX_DEPLOYMENT_v1.1.4.md \
  SUPPLIER_RECEIVING_BUILD_HOTFIX_MANIFEST_v1.1.4.json \
  package.json \
  package-lock.json

git commit -m "Include supplier receiving function dependencies v1.1.4"
git push
```

Pushing to the same branch automatically updates the existing pull request and starts a new Netlify preview build. Do not create another pull request.

## If v1.1.3 was already merged

Start a new branch from current `main`:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-unit-cost-fix-v1.1.4.zip"
BRANCH="feature/supplier-receiving-build-hotfix-v1.1.4"

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
npm run check

git add -A
git commit -m "Include supplier receiving function dependencies v1.1.4"
git push -u origin "$BRANCH"
```

Then open:

<https://github.com/matt17463/inventory-app/compare/main...feature/supplier-receiving-build-hotfix-v1.1.4?expand=1>

## Supabase SQL

If SQL 40 and 41 were already run successfully, do not run them again. If they have not been run, follow `SUPPLIER_RECEIVING_UNIT_COST_FIX_DEPLOYMENT_v1.1.3.md`; both SQL files are included in this corrected ZIP.

## Expected Netlify result

- The `operationalStorage.js` unresolved-import error is gone.
- The PDF.js `import.meta` warnings may still be displayed during bundling; warnings do not fail the deploy.
- The preview deploy completes and all checks become green.
- After merging, the production deploy should report application version `1.1.4`.
