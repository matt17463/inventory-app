# Mockup Studio v0.7.5 deployment guide

This hotfix adds safe WooCommerce connection retries after production logs showed `UND_ERR_CONNECT_TIMEOUT` between Netlify and the WooCommerce host.

Install it over v0.7.4. No Supabase SQL or new Netlify environment variables are required.

## Install and validate

Download `mockup-studio-v0.7.5-woocommerce-connection-retry.zip` to the Mac Downloads folder, then run:

```bash
ZIP_FILE="$HOME/Downloads/mockup-studio-v0.7.5-woocommerce-connection-retry.zip"
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
rsync -av "$PATCH_TEMP/mockup-studio-v0.7.5-woocommerce-connection-retry/files/" "$REPO_DIR/" || exit 1

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
  netlify/functions/_shared/mockupUtils.js \
  scripts/tests/mockup-studio.test.mjs \
  RELEASE_NOTES_0.7.5.md \
  DEPLOYMENT_GUIDE_0.7.5.md

git commit -m "Retry transient WooCommerce connections v0.7.5"
git push origin feature/mockup-studio-v0.7.0
```

Create and merge a pull request from `feature/mockup-studio-v0.7.0` into `main`, then wait for the Netlify production deployment to say **Published**.

## Verify

1. Confirm the WooCommerce product does not already exist as a draft.
2. Open the project and Phase 9, WooCommerce.
3. Confirm all included Color + Logo rows have image mappings.
4. Create the WooCommerce draft once.
5. If the first connection attempt times out, the function will retry automatically.
6. Confirm the product appears as Draft and verify its attributes, variations, images, pricing, and shipping.

If all three connection attempts fail, the application will now report the connection code and attempt count. Persistent failures after this patch should be reported to the WordPress host because the production logs identified the target host connection as the failing component.
