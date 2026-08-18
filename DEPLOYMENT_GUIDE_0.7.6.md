# Deploy Mockup Studio 0.7.6

This is a source-only update. Do not run any SQL for version 0.7.6.

## 1. Back up the current source

Open Terminal and run:

```bash
cd "$HOME/inventory-app"
git status
git branch --show-current
git pull --ff-only origin feature/mockup-studio-v0.7.0
```

If `git status` reports local changes, stop before copying the update and preserve those changes first.

## 2. Apply the update ZIP

Download `mockup-studio-v0.7.6-variation-completion-patch.zip` into your Downloads folder, then run:

```bash
PATCH_ZIP="$HOME/Downloads/mockup-studio-v0.7.6-variation-completion-patch.zip"
REPO_DIR="$HOME/inventory-app"

test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; exit 1; }
test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; exit 1; }

ditto -x -k "$PATCH_ZIP" "$REPO_DIR"
cd "$REPO_DIR"
npm install
npm run check
node -p "require('./package.json').version"
```

The final command must print `0.7.6`. The complete check must finish without errors. Existing lint warnings may still be displayed.

## 3. Commit and push

```bash
cd "$HOME/inventory-app"
git status
git add package.json package-lock.json netlify.toml src/MockupStudio.jsx src/lib/mockupStudioApi.js netlify/functions/mockup-publish-woocommerce.js scripts/tests/mockup-studio.test.mjs RELEASE_NOTES_0.7.6.md DEPLOYMENT_GUIDE_0.7.6.md
git commit -m "Complete large WooCommerce variation exports v0.7.6"
git push origin feature/mockup-studio-v0.7.0
```

Open the existing pull request on GitHub. Confirm that the new commit appears, resolve any conflicts if GitHub reports them, wait for checks, and merge it into `main`.

## 4. Verify the Netlify deployment

In Netlify, open **Deploys** and select the newest production deploy. Confirm:

- The deploy is published from the new merge commit.
- The build log shows application version `0.7.6` or the v0.7.6 commit.
- The Functions list includes `mockup-publish-woocommerce` as a background function.

No environment-variable changes are needed for this update.

## 5. Repair the existing partial WooCommerce draft

1. Open the same Mockup Studio project.
2. Go to **9. WooCommerce**.
3. Confirm **Existing Woo product ID** contains the ID of the partial WooCommerce draft. If it is blank, copy the numeric product ID from WooCommerce and enter it. Do not leave this blank, or a second product may be created.
4. Keep the same Colors, Sizes, Logo options, mockup mappings, and excluded combinations.
5. Confirm the displayed planned variation count is correct.
6. Click **Update WooCommerce Draft** once.
7. Leave the page open. Progress will show variation operations in groups, such as `25 of 108`.
8. Wait for the completed message before clicking the button again.

The update first creates combinations that are missing from WooCommerce. Existing combinations are then refreshed, and excluded app-owned combinations are made private.

## 6. Verify every variation

Calculate the expected count:

```text
included Color + Logo combinations × number of Sizes
```

For example, 9 included Color + Logo combinations and 12 sizes should produce 108 variations.

In WordPress, open **Products**, edit the draft, and open **Product data > Variations**. Confirm:

- The total equals the expected count.
- Every intended size appears for every included Color + Logo combination.
- Excluded Color + Logo combinations are unavailable.
- Variation images match the intended Color + Logo combination.
- The product remains a draft until testing is complete.

If the update reports a WooCommerce connection failure, wait briefly and click **Update WooCommerce Draft** again. Keep the same Existing Woo product ID; the retry will fill missing combinations rather than duplicate completed ones.

