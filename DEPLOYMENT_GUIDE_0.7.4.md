# Mockup Studio v0.7.4 deployment guide

This cumulative hotfix adds generated-mockup deletion and includes the v0.7.3 **Copy to all** repair. It can be installed over v0.7.2 or v0.7.3.

No Supabase SQL or new Netlify environment variables are required.

## Install and validate

Download `mockup-studio-v0.7.4-delete-mockups.zip` to the Mac Downloads folder, then run:

```bash
ZIP_FILE="$HOME/Downloads/mockup-studio-v0.7.4-delete-mockups.zip"
REPO_DIR="$HOME/inventory-app"

test -f "$ZIP_FILE" || { echo "STOP: Update ZIP was not found at $ZIP_FILE"; exit 1; }
test -d "$REPO_DIR/.git" || { echo "STOP: Git repository was not found at $REPO_DIR"; exit 1; }

cd "$REPO_DIR" || exit 1
git switch feature/mockup-studio-v0.7.0 || exit 1
git pull --ff-only origin feature/mockup-studio-v0.7.0 || exit 1

test -z "$(git status --porcelain)" || {
  echo "STOP: The repository contains uncommitted changes. Run git status before continuing."
  exit 1
}

PATCH_TEMP="$(mktemp -d)" || exit 1
unzip -q "$ZIP_FILE" -d "$PATCH_TEMP" || exit 1
rsync -av "$PATCH_TEMP/mockup-studio-v0.7.4-delete-mockups/files/" "$REPO_DIR/" || exit 1

npm ci
npm run check
```

## Commit and push

After the checks pass:

```bash
cd "$HOME/inventory-app"
git add \
  package.json \
  package-lock.json \
  src/MockupStudio.jsx \
  src/lib/mockupStudioApi.js \
  netlify/functions/mockup-delete-output.js \
  netlify/functions/mockup-publish-woocommerce.js \
  scripts/tests/mockup-studio.test.mjs \
  RELEASE_NOTES_0.7.4.md \
  DEPLOYMENT_GUIDE_0.7.4.md

git commit -m "Add generated mockup deletion v0.7.4"
git push origin feature/mockup-studio-v0.7.0
```

Create a pull request from `feature/mockup-studio-v0.7.0` into `main`, wait for the checks, and merge it. Netlify will deploy the updated `main` branch.

## Verify

1. Open **Artwork > Mockup Studio** and open a project.
2. Open **5. Generate**.
3. Confirm every generated output has **Select for Store** and **Delete Mockup** buttons.
4. Generate an expendable test mockup.
5. Click **Delete Mockup** and confirm the warning.
6. Confirm the card disappears.
7. Open the WooCommerce phase and confirm the deleted mockup is absent from the variation-image lists and gallery choices.
8. Uncheck **Include in product** for an unwanted Color + Logo row.
9. Confirm the planned variation count decreases by the number of selected sizes and that the excluded row no longer requires an image.

Deletion affects Mockup Studio only. It does not delete WooCommerce products or media that were published before the mockup was deleted.
