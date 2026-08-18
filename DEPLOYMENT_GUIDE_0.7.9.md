# Deploy Mockup Studio 0.7.9

Version 0.7.9 is a cumulative source update. It includes the previous WooCommerce, large-variation, and white-ink fixes. Do not run SQL and do not change Netlify environment variables.

## Install

Download `mockup-studio-v0.7.9-bulk-uploads.zip` into the Mac Downloads folder. Then run:

```bash
PATCH_ZIP="$HOME/Downloads/mockup-studio-v0.7.9-bulk-uploads.zip"
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

The last command must print `0.7.9`. Existing lint warnings are acceptable; the check must finish without errors.

## Commit and push

```bash
cd "$HOME/inventory-app"
git add -A
git commit -m "Add bulk blank and artwork uploads v0.7.9"
git push origin feature/mockup-studio-v0.7.0
```

Create a pull request from `feature/mockup-studio-v0.7.0` into `main`, wait for the checks, merge it, and wait for Netlify to show the production deployment as **Published**.

## Test blank-image bulk upload

1. Refresh the application with `Command + Shift + R`.
2. Open or create a test Mockup Studio project.
3. Open **2. Blank Photos**.
4. Set the default product type and view.
5. Click **Blank photos** and select several product images together.
6. Edit the display name and color on each queued file.
7. Click **Upload _ Blank Images**.
8. Confirm every image appears under Blank photos with its correct color, type, and view.

## Test artwork bulk upload

1. Open **3. Artwork**.
2. Leave **Do not redraw or alter this logo** and **Protect visible white as opaque printed ink** enabled when appropriate.
3. Click **Logo / graphic files** and select several files together.
4. Edit each queued artwork name.
5. Click **Upload _ Artwork Files**.
6. Confirm every logo appears in Artwork and review any preflight warnings.

If one upload fails, the successful files remain saved and only the failed item remains in the queue. Correct or remove that item, then submit the queue again.

