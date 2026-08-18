# Deploy Mockup Studio 0.7.7

Version 0.7.7 is a source-only update. Do not run SQL and do not change Netlify environment variables.

## Install the cumulative update

Download `mockup-studio-v0.7.7-woocommerce-collection-fix.zip` into the Mac Downloads folder. Then run:

```bash
PATCH_ZIP="$HOME/Downloads/mockup-studio-v0.7.7-woocommerce-collection-fix.zip"
REPO_DIR="$HOME/inventory-app"

test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; exit 1; }
test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; exit 1; }

cd "$REPO_DIR"
git switch feature/mockup-studio-v0.7.0
git status
git pull --ff-only origin feature/mockup-studio-v0.7.0

ditto -x -k "$PATCH_ZIP" "$REPO_DIR"

npm install
npm run check
node -p "require('./package.json').version"
```

The final command must print `0.7.7`. Existing lint warnings are acceptable; the check must finish with no errors.

## Commit and push

```bash
cd "$HOME/inventory-app"

git add package.json package-lock.json netlify.toml \
  src/MockupStudio.jsx \
  src/lib/mockupStudioApi.js \
  netlify/functions/_shared/mockupUtils.js \
  netlify/functions/mockup-publish-woocommerce.js \
  netlify/functions/mockup-woo-options.js \
  scripts/tests/mockup-studio.test.mjs \
  RELEASE_NOTES_0.7.6.md RELEASE_NOTES_0.7.7.md \
  DEPLOYMENT_GUIDE_0.7.6.md DEPLOYMENT_GUIDE_0.7.7.md

git commit -m "Normalize WooCommerce collection responses v0.7.7"
git push origin feature/mockup-studio-v0.7.0
```

Create a pull request from `feature/mockup-studio-v0.7.0` into `main`, wait for the checks, and merge it. Netlify should deploy the merge automatically.

## Retest the product

1. Wait for the new Netlify production deployment to show **Published**.
2. Refresh the application with `Command + Shift + R`.
3. Open the same Mockup Studio project and choose **9. WooCommerce**.
4. Confirm the existing partial draft ID appears in **Existing Woo product ID**.
5. Click **Update WooCommerce Draft** once.
6. Leave the page open until variation processing completes.

If an error now specifically says that WooCommerce returned an unexpected response, exclude `/wp-json/wc/v3/` from WordPress caching, firewall response rewriting, and optimization rules. The new message will include the affected list and returned field names.

