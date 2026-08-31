# New Product Line button hotfix v1.3.1

## Cause

The shared `ActionButton` component defaults to `type="button"`. The **Preview product line** control was placed inside a form but did not override that default, so clicking it did not submit the form or call the preview API.

## Fix

- Sets **Preview product line** to `type="submit"`.
- Adds a regression test that requires the submit type.
- Updates the application version to 1.3.1.

No additional Supabase SQL or Netlify environment variables are required.

## Install

Download `inventory-app-new-product-line-button-hotfix-v1.3.1.zip` to Downloads, then run:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-new-product-line-button-hotfix-v1.3.1.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
git status --short
```

If the status is clean:

```bash
cd "$HOME/inventory-app"
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/new-product-line-button-v1.3.1
unzip -o "$HOME/Downloads/inventory-app-new-product-line-button-hotfix-v1.3.1.zip" -d "$HOME/inventory-app"
npm ci
npm run check
git add -A
git commit -m "Fix New Product Line preview button v1.3.1"
git push -u origin feature/new-product-line-button-v1.3.1
```

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/new-product-line-button-v1.3.1?expand=1

After merging and deploying, hard-refresh the application. Clicking **Preview product line** should show the review matrix and the second-step confirmation controls.
