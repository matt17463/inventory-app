# Mockup Studio Exact Clean Memory Hotfix v1.0.7

This hotfix resolves Netlify `Runtime.OutOfMemory` failures when Exact Clean processes large 300-DPI blank photos or artwork.

## What changed

- Original blank and artwork files remain unchanged in private R2.
- The server renderer now creates a bounded ecommerce mockup, with a maximum long edge of 2400 pixels by default.
- Artwork is resized to its actual placement size before the compositor expands it into pixels.
- Sharp runs with one worker and a small cache inside the Exact Clean function.
- PNG compression is balanced for lower peak memory and faster completion.
- Non-JSON Netlify failures now display their HTTP status and the function-log name.

No SQL migration is required. No new environment variable is required.

An optional `MOCKUP_EXACT_MAX_DIMENSION` variable may be set between 1200 and 3200. Leave it unset to use the recommended 2400-pixel default.

## Install from Terminal

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-mockup-exact-memory-hotfix-v1.0.7.zip"

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
git switch -c feature/mockup-exact-memory-v1.0.7
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add -A
git commit -m "Reduce Exact Clean mockup memory usage v1.0.7"
git push -u origin feature/mockup-exact-memory-v1.0.7
```

Do not continue if `npm run check` fails.

## Pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-exact-memory-v1.0.7?expand=1

Wait for GitHub and Netlify checks to pass, merge the pull request, and wait for the production deployment.

## Verify

1. Open the same Mockup Studio project that previously failed.
2. Open **5. Generate**.
3. Click **Exact Clean** on the same placement.
4. Confirm the output appears.
5. In Netlify, open the `mockup-generate-exact` invocation.
6. Confirm it completes without `Runtime.OutOfMemory` and uses substantially less than 1024 MB.
7. Test **Exact + Caption** once.

If the invocation still approaches 1024 MB, set `MOCKUP_EXACT_MAX_DIMENSION=1800` in Netlify for Functions and Runtime, redeploy, and retry.

