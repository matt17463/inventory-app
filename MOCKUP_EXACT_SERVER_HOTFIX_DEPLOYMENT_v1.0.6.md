# Mockup Studio Exact Clean Server Hotfix v1.0.6

This hotfix fixes **Failed to fetch** when **Exact Clean** or **Exact + Caption** is selected while AI Assist still works.

## What changed

Exact generation no longer downloads R2 files through the browser. A new authenticated Netlify function:

1. Reads the saved blank and artwork directly from private R2.
2. Applies the placement, rotation, size, opacity, blend mode, white-ink protection, and shadow.
3. Adds the selected caption when requested.
4. Saves the PNG and its preview to R2.
5. Records a completed generation job and output in Supabase.

No SQL or new environment variables are required.

## Install from Terminal

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-mockup-exact-server-hotfix-v1.0.6.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted changes were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/mockup-exact-server-v1.0.6
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add -A
git commit -m "Move Exact Clean mockup generation to server v1.0.6"
git push -u origin feature/mockup-exact-server-v1.0.6
```

Do not continue if `npm run check` fails.

## Pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-exact-server-v1.0.6?expand=1

Wait for all GitHub and Netlify checks to pass, merge the pull request, and wait for the production deployment.

## Verify

1. Open the production application in a new browser tab.
2. Open the existing Mockup Studio project.
3. Open **5. Generate**.
4. Click **Exact Clean**.
5. Confirm a new output appears.
6. Enter a caption and click **Exact + Caption**.
7. Confirm the captioned output appears.
8. Open Netlify → **Functions** and confirm `mockup-generate-exact` has a successful invocation.

If generation fails, the page now displays the server’s actual error. Open the `mockup-generate-exact` function log and copy the error entry.

## Notes

- AI Assist is unchanged.
- Existing placements and projects are unchanged.
- PNG, JPEG, WebP, and SVG artwork are supported.
- PDF artwork must be exported as a transparent PNG before Exact Clean generation.
- R2 CORS remains necessary for direct browser uploads and previews, but no longer controls Exact Clean rendering.
