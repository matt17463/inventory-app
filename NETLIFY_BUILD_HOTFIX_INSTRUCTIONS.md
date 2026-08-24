# Netlify build hotfix for Operations Integrity v1.0.0

This hotfix adds the build helper omitted from the original patch archive. It also includes the matching build-verification and Netlify-function validation scripts.

Apply it to the existing `feature/operations-integrity-v1.0.0` branch before merging pull request #25.

```bash
REPO_DIR="$HOME/inventory-app"
HOTFIX_ZIP="$HOME/Downloads/inventory-app-v1.0.0-netlify-build-hotfix.zip"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Repository not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$HOTFIX_ZIP" || {
  echo "STOP: Hotfix ZIP not found at $HOTFIX_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"
git switch feature/operations-integrity-v1.0.0
git pull --ff-only

unzip -o "$HOTFIX_ZIP" -d "$REPO_DIR"

test -f scripts/build_vite.mjs || {
  echo "STOP: scripts/build_vite.mjs is still missing"
  return 1 2>/dev/null || exit 1
}

npm ci
npm run build

git add scripts/build_vite.mjs \
  scripts/verify_build_features.mjs \
  scripts/validate_netlify_esm.mjs

git commit -m "Add missing Netlify build helper"
git push
```

After the push, GitHub and Netlify automatically rerun the pull-request checks. Do not merge until the deployment-preview checks are green.
