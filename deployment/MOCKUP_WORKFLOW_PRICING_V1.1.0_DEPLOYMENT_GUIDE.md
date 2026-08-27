# Deploy Mockup Studio Workflow and Pricing v1.1.0

This release adds the WooCommerce product-description field, fixes placement-display drift between workflow tabs, and adds separate Direct Retail and Wholesale pricing paths.

The SQL migration is additive. Existing projects, generated images, WooCommerce mappings, and pricing items are preserved. Existing pricing items become Direct Retail items.

No new Netlify environment variables are required.

## 1. Download the update

Place `inventory-app-mockup-workflow-pricing-v1.1.0.zip` in your Mac's Downloads folder.

## 2. Apply the package on a clean branch

Copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-mockup-workflow-pricing-v1.1.0.zip"
BRANCH_NAME="feature/mockup-workflow-pricing-v1.1.0"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Update ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"

if test -n "$(git status --porcelain)"; then
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status --short
  return 1 2>/dev/null || exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main

if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  git switch "$BRANCH_NAME"
else
  git switch -c "$BRANCH_NAME"
fi

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

echo "APPLICATION VERSION:"
node -p "require('./package.json').version"

echo "CHANGED FILES:"
git status --short

if git diff --quiet && git diff --cached --quiet; then
  echo "STOP: The ZIP did not produce any application changes. Do not create an empty pull request."
  return 1 2>/dev/null || exit 1
fi
```

The version must print `1.1.0`, and the changed-files section must not be empty.

If the block stops because it finds unrelated untracked files, preserve them, then rerun the block:

```bash
cd "$HOME/inventory-app"
git stash push --include-untracked -m "Before Mockup Studio v1.1.0"
```

## 3. Validate locally

```bash
cd "$HOME/inventory-app"
npm ci
npm run check
```

Do not continue unless `npm run check` finishes successfully.

## 4. Run the Supabase migration

1. Open the Supabase project used by the inventory application.
2. Open **SQL Editor** and create a new query.
3. On your Mac, copy the migration to the clipboard:

```bash
cd "$HOME/inventory-app"
pbcopy < deployment/sql/36_MOCKUP_STUDIO_PLACEMENT_PRICING.sql
```

4. Paste into Supabase SQL Editor and click **Run** once.
5. Create another new query and copy the verification:

```bash
cd "$HOME/inventory-app"
pbcopy < deployment/sql/37_VERIFY_MOCKUP_STUDIO_PLACEMENT_PRICING.sql
```

6. Paste and click **Run**.

The first verification result must show:

| Column | Expected |
|---|---|
| `pricing_path_ready` | `true` |
| `wholesale_price_ready` | `true` |
| `existing_rows_valid` | `true` |

The second result lists pricing-item counts by path. It can return no rows if the project has no pricing items yet.

## 5. Commit and push

```bash
cd "$HOME/inventory-app"

git add -A
git commit -m "Add Mockup Studio workflow and pricing paths v1.1.0"
git push -u origin feature/mockup-workflow-pricing-v1.1.0
```

Open this pull-request page:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-workflow-pricing-v1.1.0?expand=1

Use the title:

`Add Mockup Studio workflow and pricing paths v1.1.0`

Wait for GitHub and Netlify preview checks to pass, then merge into `main`.

## 6. Verify the Netlify production deploy

1. Open Netlify **Deploys**.
2. Confirm the newest **Production: main** deployment is published.
3. Open `https://inventory.skilledcrafting.com/mockup-studio` in a private/incognito window.
4. Hard-refresh once if an older bundle is still displayed.

## 7. Production smoke test

### Placement consistency

1. Open a disposable or existing test project.
2. On **4. Placements**, adjust Image Width, Horizontal Position, and Vertical Position and save.
3. Record the values shown on the controls.
4. Open **5. Generate**. The preview must match the saved placement.
5. Generate **Exact Clean** and **Exact + Caption**.
6. Compare the product area of both outputs. The garment, artwork size, and artwork position must be identical; only the caption strip is added below the product.
7. Open **6. Captions**. The output is displayed at its natural aspect ratio instead of being squeezed into a fixed-height box.

AI Assist remains generative and can alter pixels or geometry. Use Exact Clean or Exact + Caption whenever the saved placement must be reproduced exactly.

### Pricing paths

1. Open **8. Pricing**.
2. Select **Direct Retail** and add a row with Label, Quantity, Unit Cost, and Retail Price.
3. Select **Wholesale** and add a row with Label, Quantity, Unit Cost, Wholesale Price, and Retail Price.
4. Switch between the paths and verify that each breakdown contains only its own rows.
5. Confirm existing pricing rows appear under Direct Retail.

### WooCommerce description

1. Open **9. WooCommerce**.
2. Enter a Product Description and, optionally, a Short Description.
3. Create or update a draft.
4. Open the draft in WooCommerce and confirm both descriptions were saved in their correct fields.

## Rollback

The migration is backward-compatible. To roll back the interface urgently, revert the v1.1.0 pull request and let Netlify redeploy `main`. Do not remove the new pricing columns during a routine rollback because they may contain newly entered wholesale data.
