# Mockup Studio v0.7.2 deployment guide

This is a cumulative source patch. It includes the earlier v0.7.1 variable-product work, so you can install it directly over the v0.7.0 Mockup Studio branch.

## What this update adds

- WooCommerce Brand, Style, Color, Size, and Logo attributes.
- Color × Size × Logo variation generation.
- A specific mockup image for every variation.
- Main product image selection and ordered product gallery.
- WooCommerce category selection.
- Shipping class, weight, length, width, and height.
- One regular price applied to all generated variations.
- Validation that stops incomplete products before they are sent to WooCommerce.

No SQL migration is required for v0.7.2.

## Before installing

1. Download `mockup-studio-v0.7.2-cumulative-patch.zip` to your Mac's Downloads folder.
2. Open Terminal.
3. Make sure your current pull request branch has no unfinished merge or conflict resolution.

Run:

```bash
cd "$HOME/inventory-app"
git status
```

If the output mentions `unmerged paths`, `MERGING`, or unresolved conflicts, stop and resolve that work before installing this patch. If it says the working tree is clean, continue.

## Install the patch

Copy and paste this complete block into Terminal:

```bash
ZIP_FILE="$HOME/Downloads/mockup-studio-v0.7.2-cumulative-patch.zip"
REPO_DIR="$HOME/inventory-app"

test -f "$ZIP_FILE" || { echo "STOP: Patch ZIP not found at $ZIP_FILE"; exit 1; }
test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; exit 1; }

cd "$REPO_DIR" || exit 1
git switch feature/mockup-studio-v0.7.0 || exit 1
git pull --ff-only origin feature/mockup-studio-v0.7.0 || exit 1

test -z "$(git status --porcelain)" || {
  echo "STOP: Your repository has uncommitted changes. Run git status and review them first."
  exit 1
}

BACKUP_BRANCH="backup/mockup-studio-before-v0.7.2-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH" || exit 1
echo "Created backup branch: $BACKUP_BRANCH"

PATCH_TEMP="$(mktemp -d)" || exit 1
unzip -q "$ZIP_FILE" -d "$PATCH_TEMP" || exit 1
rsync -av "$PATCH_TEMP/mockup-studio-v0.7.2-cumulative-patch/files/" "$REPO_DIR/" || exit 1

git status --short
npm ci
npm run check
```

The final command should finish without errors. A Vite bundle-size warning is informational and does not mean the build failed.

## Commit and deploy

After the checks pass, run:

```bash
cd "$HOME/inventory-app"
git add \
  README_FIRST_0.7.2.md \
  RELEASE_NOTES_0.7.2.md \
  MOCKUP_STUDIO_EPO_STORE_WORKFLOW_GUIDE_0.7.2.md \
  DEPLOYMENT_GUIDE_0.7.2.md \
  package.json \
  package-lock.json \
  src/MockupStudio.jsx \
  src/MockupStudioWoo.css \
  src/lib/mockupStudioApi.js \
  netlify/functions/mockup-publish-woocommerce.js \
  netlify/functions/mockup-woo-options.js \
  scripts/tests/mockup-studio.test.mjs

git commit -m "Complete Mockup Studio WooCommerce fields v0.7.2"
git push origin feature/mockup-studio-v0.7.0
```

Netlify should build a new deploy from the pushed commit. Open the branch deploy after Netlify reports `Published`.

## One-time WooCommerce preparation

Before testing, confirm WooCommerce already contains:

- Global attributes named Brand, Style, Color, Size, and Logo.
- Terms such as Gildan, 18500, 6400, Red, Sport Grey, Black, White, and each EPO logo name.
- The desired product categories.
- The desired shipping class.

The WooCommerce REST API key already used by the application must have read/write permission. No new environment variable is required by this update.

## Smoke test

1. Create a small Mockup Studio project.
2. Select two colors, two sizes, and two logos.
3. Select and map the correct mockup for every Color + Logo combination.
4. In the WooCommerce phase, select Brand, Style, categories, shipping class, weight, dimensions, and a main product image.
5. Use a test name ending in `— DELETE`.
6. Select `Draft`, never `Publish`, for the first test.
7. Create the product.
8. In WooCommerce verify:
   - The parent product is a variable product and remains a draft.
   - Eight variations exist (2 colors × 2 sizes × 2 logos).
   - Every variation has the expected image and price.
   - The selected main image is first and the other selected mockups are in the gallery.
   - Brand, Style, categories, shipping class, weight, and dimensions are correct.
9. Delete the test product after verification.

## Rollback

The installer creates a backup branch before changing files. If you need to roll back, do not delete your current work. First run `git status`, then switch to the printed backup branch name or ask for help with the status output.
