# Mockup Studio v0.7.3 hotfix deployment

This hotfix repairs **Copy to all** when a saved artwork placement must be applied to multiple blank photos. Install it after v0.7.2.

No Supabase SQL or new Netlify environment variables are required.

## Install and test

Download `mockup-studio-v0.7.3-copy-to-all-hotfix.zip` to the Mac Downloads folder, then run:

```bash
ZIP_FILE="$HOME/Downloads/mockup-studio-v0.7.3-copy-to-all-hotfix.zip"
REPO_DIR="$HOME/inventory-app"

test -f "$ZIP_FILE" || { echo "STOP: Hotfix ZIP was not found at $ZIP_FILE"; exit 1; }
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
rsync -av "$PATCH_TEMP/mockup-studio-v0.7.3-copy-to-all-hotfix/files/" "$REPO_DIR/" || exit 1

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
  scripts/tests/mockup-studio.test.mjs \
  RELEASE_NOTES_0.7.3.md \
  DEPLOYMENT_GUIDE_0.7.3.md

git commit -m "Fix Mockup Studio copy to all placements v0.7.3"
git push origin feature/mockup-studio-v0.7.0
```

Create a pull request from `feature/mockup-studio-v0.7.0` into `main`, wait for its checks, and merge it. Netlify will then deploy the updated `main` branch.

## Verify the repair

1. Open a project with three blank photos.
2. Open **4. Placements**.
3. Save one placement for one logo on the first blank.
4. Click **Copy to all** on that saved placement.
5. Confirm the message says it copied to `2 additional blank photos` and that `3 total blank placements` are ready.
6. Open **5. Generate** and confirm that the same artwork now has three generation cards, one for each blank color.
7. Repeat **Copy to all** once for each additional logo.

With three blanks and three logos, the final Saved Placements count should be nine.
