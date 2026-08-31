# Skilled Crafting Inventory App — Visual Layout Fixes v1.2.1

This package corrects two visible problems and includes the complete v1.2.0 product-to-blank mapping dependency set so the Netlify preview does not fail on a missing `AssetStorageHealth` module.

## Included fixes

1. Mockup Studio now uses the full available page width.
2. Mockup projects display in a responsive multi-column grid.
3. Projects can be sorted by last update, project name, customer, or campaign/store, in either direction.
4. Pull-sheet blank search rows are normalized when Supabase returns wrapped RPC data.
5. Blank results display as readable responsive cards instead of empty boxes.
6. The previously omitted Asset Storage Health component and function dependencies are included.

## Database requirements

There is no new SQL for the visual changes.

If v1.2.0 product-to-blank mapping SQL has not already been installed, run these bundled files in Supabase SQL Editor in order:

1. `deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`
2. `deployment/sql/45_VERIFY_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql`

The first script is additive/idempotent. The second script is verification only.

## Apply the package

Copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-visual-layout-fixes-v1.2.1-complete.zip"
BRANCH="feature/visual-layout-fixes-v1.2.1"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Git repository not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: Patch ZIP not found at $PATCH_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status --short
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git switch "$BRANCH"
  git merge --ff-only main
else
  git switch -c "$BRANCH"
fi

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add \
  src/MockupStudio.jsx \
  src/MockupStudio.css \
  src/PullSheetView.jsx \
  src/App.css \
  src/App.jsx \
  src/AssetStorageHealth.jsx \
  src/ProductBlankMappings.jsx \
  src/components/AppShell.jsx \
  src/lib/productBlankMappingApi.js \
  src/navigationConfig.js \
  netlify/functions/_shared/operationalStorage.js \
  netlify/functions/asset-storage-health.js \
  netlify/functions/product-blank-mapping.js \
  netlify/functions/mockup-publish-woocommerce.js \
  netlify/functions/woocommerce-webhook.js \
  netlify/functions/manual-pullsheet.js \
  deployment/sql/44_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql \
  deployment/sql/45_VERIFY_PRODUCT_BLANK_MAPPING_LIFECYCLE.sql \
  scripts/tests/mockup-studio.test.mjs \
  scripts/tests/product-blank-mapping-lifecycle.test.mjs \
  package.json \
  package-lock.json \
  VISUAL_LAYOUT_V1.2.1_DEPLOYMENT_GUIDE.md \
  PATCH_MANIFEST_V1.2.1.md

git commit -m "Fix Mockup Studio and pull-sheet result layouts v1.2.1"
git push -u origin "$BRANCH"
```

## Open the pull request

Open:

`https://github.com/matt17463/inventory-app/compare/main...feature/visual-layout-fixes-v1.2.1?expand=1`

Create the pull request, wait for the GitHub and Netlify checks to pass, then merge it into `main`.

## Verify after deployment

1. Open Mockup Studio.
2. Confirm projects use multiple columns on a desktop-sized browser.
3. Sort by Project name, Customer, and Campaign/store.
4. Reverse the sort direction with the A→Z / Z→A button.
5. Open a pull sheet with an unpaired line.
6. Select **Override Blank Pairing**, search for a brand or SKU, and confirm each result has a visible SKU/name and Brand / Style / Color / Size description.
7. Select a result and verify the line pairs normally.

No existing project, image, pull-sheet, product, reservation, or inventory data is changed by the visual update.
