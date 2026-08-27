# Mockup Caption Regeneration Fix v1.1.1

This cumulative patch fixes the WooCommerce export warning that remains after a captioned mockup is regenerated.

## What changes

- A stale captioned output now shows **Regenerate Caption** on the Captions tab.
- Regeneration uses that output's saved caption text, font, size, colors, alignment, and padding.
- If the stale output was selected for the store, the regenerated output replaces it automatically.
- Saved WooCommerce main-image and variation-image references are changed from the old output ID to the new output ID.
- The replacement output is set to pending approval so its new pixels can be reviewed before production.
- WooCommerce validation ignores stale caption metadata on clean and AI outputs because those output kinds do not contain a baked caption.

## 1. Apply the patch

Copy `inventory-app-caption-regeneration-fix-v1.1.1.zip` to Downloads, then paste this block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-caption-regeneration-fix-v1.1.1.zip"

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
git switch -c feature/mockup-caption-regeneration-v1.1.1
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

node -p "require('./package.json').version"
npm ci
npm run check
```

The version command must print `1.1.1`, and `npm run check` must finish successfully.

## 2. Apply the v1.1 pricing migration if it has not already been applied

No new SQL is required specifically for the caption fix. The ZIP includes the earlier v1.1.0 pricing migration because this package is cumulative.

In Supabase SQL Editor, run these files in order only if migration 36 was not already applied:

1. `deployment/sql/36_MOCKUP_STUDIO_PLACEMENT_PRICING.sql`
2. `deployment/sql/37_VERIFY_MOCKUP_STUDIO_PLACEMENT_PRICING.sql`

Migration 36 is additive and may safely be run again.

## 3. Commit and push

```bash
cd "$HOME/inventory-app"

git add -A
git commit -m "Fix stale caption regeneration and Woo image replacement v1.1.1"
git push -u origin feature/mockup-caption-regeneration-v1.1.1
```

Open this pull request:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-caption-regeneration-v1.1.1?expand=1

Merge it into `main`, then wait for the Netlify production deploy to succeed.

## 4. Repair an existing project

1. Open the existing Mockup Studio project.
2. Open **6. Captions**.
3. Find the image marked **Caption pixels are out of date**.
4. Click **Regenerate Caption** on that exact image.
5. Wait for generation to finish and the project to refresh.
6. Open **7. Approval** and click **Approve & Select** on the newly generated image after reviewing it.
7. Open **9. WooCommerce**.
8. Confirm the same existing WooCommerce product ID is shown.
9. Confirm the main image and every Color / Logo mapping show the new image.
10. Click the WooCommerce update button and verify the existing product—not a duplicate—was updated.

Do not use **Exact + Caption** on the Generate tab to repair a stale caption. That creates a separate output. Use **Regenerate Caption** on the stale image so selection and WooCommerce mappings are replaced automatically.

## Immediate workaround before deployment

If the patch is not deployed yet, open **5. Generate**, select the newly regenerated captioned image for the store, and deselect the old stale image. Then reopen **9. WooCommerce** and manually reselect the regenerated image for the main image and every affected variation mapping.

