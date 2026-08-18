# Deploy Mockup Studio 0.7.8

Version 0.7.8 is a cumulative source update containing the v0.7.6 background variation repair, v0.7.7 WooCommerce response normalization, and v0.7.8 white-ink protection. Do not run SQL and do not change Netlify environment variables.

## Install the update

Download `mockup-studio-v0.7.8-white-ink-protection.zip` into the Mac Downloads folder. Then run:

```bash
PATCH_ZIP="$HOME/Downloads/mockup-studio-v0.7.8-white-ink-protection.zip"
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

The last command must print `0.7.8`. Existing lint warnings are acceptable; the check must finish without errors.

## Commit and push

```bash
cd "$HOME/inventory-app"
git add -A
git commit -m "Protect opaque white artwork in mockups v0.7.8"
git push origin feature/mockup-studio-v0.7.0
```

Create a pull request from `feature/mockup-studio-v0.7.0` into `main`, wait for its checks, merge it, and wait for the Netlify production deployment to show **Published**.

## Regenerate the affected South Colby mockup

1. Refresh the deployed application with `Command + Shift + R`.
2. Open the existing Mockup Studio project.
3. In **3. Artwork**, inspect the artwork preview. If the South Colby text is already transparent in the uploaded source, upload a corrected file containing opaque white text.
4. In **4. Placements**, edit the affected placement.
5. Confirm **Protect visible white as opaque ink** is checked.
6. The Blend mode will show **Normal — opaque print** and remain disabled while protection is on.
7. Save the placement. Use **Copy to all** again if the artwork is placed on several blank colors.
8. In **5. Generate**, create a new **Exact Clean** mockup first. Confirm the South Colby text is solid white.
9. Optionally run **AI Assist** and review its result. Exact Clean is the guaranteed pixel-preserving choice; AI output must still be reviewed.
10. Delete or deselect the old incorrect mockups and select the corrected outputs for WooCommerce.

Already-created WooCommerce images will not be replaced until the corrected outputs are selected and the existing WooCommerce draft is updated.

