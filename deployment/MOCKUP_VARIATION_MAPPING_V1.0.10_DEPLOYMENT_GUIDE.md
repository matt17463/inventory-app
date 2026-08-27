# Deploy Mockup Variation Mapping Hotfix v1.0.10

This hotfix fixes a saved variation mockup that appears paired in Mockup Studio but is rejected during WooCommerce export. It specifically handles punctuation and HTML differences such as `&` versus `and`, parentheses, apostrophes, accents, and repeated-upload suffixes such as `(1)`.

It repairs existing saved mappings when they are loaded or exported. You do not need to remove and reselect the Grey / EPO Orcas Black & White (1) mockup.

There is no SQL migration and there are no new Netlify environment variables.

## 1. Apply the hotfix

Copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-mockup-variation-mapping-v1.0.10.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Hotfix ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"

if test -n "$(git status --porcelain)"; then
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status --short
  return 1 2>/dev/null || exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main

if git show-ref --verify --quiet refs/heads/feature/mockup-variation-mapping-v1.0.10; then
  git switch feature/mockup-variation-mapping-v1.0.10
else
  git switch -c feature/mockup-variation-mapping-v1.0.10
fi

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

node -p "require('./package.json').version"
git status --short
```

The version command must print `1.0.10`.

If Terminal stops because it finds unrelated untracked files, preserve them and repeat the block:

```bash
cd "$HOME/inventory-app"
git stash push --include-untracked -m "Before Mockup variation mapping v1.0.10"
```

## 2. Validate, commit, and push

```bash
cd "$HOME/inventory-app"
npm ci
npm run check

git add -A
git commit -m "Fix saved Mockup Studio variation mappings v1.0.10"
git push -u origin feature/mockup-variation-mapping-v1.0.10
```

Do not continue if `npm run check` fails.

## 3. Open and merge the pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-variation-mapping-v1.0.10?expand=1

Use the title:

`Fix saved Mockup Studio variation mappings v1.0.10`

Wait for the GitHub and Netlify checks to pass, then merge into `main`.

## 4. Confirm the production deploy

1. In Netlify, open **Deploys**.
2. Confirm the newest **Production: main** deploy is published.
3. Open Mockup Studio in a private/incognito window, or hard-refresh the existing tab.
4. Open the **EPO ES Gildan Tee** project and go to **9. WooCommerce**.
5. Confirm **Grey / EPO Orcas Black & White (1)** still shows its selected mockup.
6. Create or update the WooCommerce draft.
7. Verify that the Grey / EPO Orcas Black & White (1) variations have the selected image.

The exporter also repairs old keys on the server, so a browser with the previous form data cannot trigger the same false “Choose a variation mockup” error.

## 5. Avoid a duplicate draft

If the failed attempt already created a WooCommerce draft, the project should reuse its stored WooCommerce product ID. Check WooCommerce before starting again.

If the project no longer shows that ID but a partial draft exists, enter the existing draft's numeric product ID in **Existing WooCommerce product ID** before retrying. Do not create another product with the same name.

## Rollback

This release changes only application code and tests. To roll back, revert the v1.0.10 pull request and let Netlify redeploy `main`. No database rollback is required.
