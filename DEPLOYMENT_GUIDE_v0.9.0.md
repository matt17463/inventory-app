# Skilled Crafting Inventory 0.9.0 Deployment Guide

This release is a cumulative application-quality upgrade built from the 0.8.14 source. It includes an upgrade-only ZIP and a complete-source ZIP.

Use the **upgrade ZIP** when your repository is already on 0.8.14. Use the **complete ZIP** only if you need to replace the full application source. Neither ZIP contains `.env`, Netlify secrets, `node_modules`, `.git`, or a prebuilt `dist` folder.

## What this deployment changes

- Adds the read-only Product Integrity Center.
- Adds one additive Supabase migration.
- Improves supplier product matching at scale.
- Replaces the vulnerable XLSX parser.
- Adds file-size, row-count, and ZIP extraction limits.
- Updates dependencies and removes known production audit findings.
- Splits application pages into route-level chunks.
- Adds a safe local/CI build wrapper.

No new Netlify environment variables are required.

## Phase 1 — Put the downloaded files in Downloads

Confirm these files are present:

```bash
ls -lh "$HOME/Downloads/inventory-app-v0.9.0-upgrade.zip" \
  "$HOME/Downloads/inventory-app-v0.9.0-complete.zip" \
  "$HOME/Downloads/27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql"
```

If you are already on application version 0.8.14, continue with the upgrade ZIP.

## Phase 2 — Verify and back up the repository

Copy and paste this complete block:

```bash
REPO_DIR="$HOME/inventory-app"
PACKAGE_ZIP="$HOME/Downloads/inventory-app-v0.9.0-upgrade.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PACKAGE_ZIP" || { echo "STOP: Upgrade ZIP not found at $PACKAGE_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
git status --short
test -z "$(git status --porcelain)" || { echo "STOP: Commit or move the files shown above before deploying."; return 1 2>/dev/null || exit 1; }

git fetch origin
git switch main
git pull --ff-only origin main

echo "Current version: $(node -p "require('./package.json').version")"
git bundle create "$HOME/Downloads/inventory-app-before-v0.9.0.bundle" --all
git tag "backup-before-v0.9.0-$(date +%Y%m%d-%H%M%S)"
git switch -c feature/application-integrity-v0.9.0
```

Expected current version: `0.8.14`. If it is lower, use the complete-source procedure in the appendix or stop and compare your branch before continuing.

## Phase 3 — Apply the application upgrade

```bash
REPO_DIR="$HOME/inventory-app"
PACKAGE_ZIP="$HOME/Downloads/inventory-app-v0.9.0-upgrade.zip"

cd "$REPO_DIR"
unzip -o "$PACKAGE_ZIP" -d "$REPO_DIR"

npm ci
npm run check
npm audit --omit=dev
node -p "require('./package.json').version"
```

Expected results:

- `npm run check` completes successfully.
- 64 tests pass.
- The bundle verifier says required features are present.
- ESLint reports zero errors. It will list 40 documented warnings.
- `npm audit --omit=dev` reports zero vulnerabilities.
- The version prints `0.9.0`.

Do not push if `npm run check` fails.

## Phase 4 — Install the Supabase migration

This migration is additive and read-only. It does not update, merge, archive, or delete application records.

1. Open Supabase.
2. Select the inventory project.
3. Open **SQL Editor**.
4. Open the downloaded `27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql` file in a text editor.
5. Copy all of it into a new Supabase query.
6. Click **Run** once.

The final result should return zero or more diagnostic summary rows. Zero rows means no current issues were found; it is not an error.

To verify later, run:

```sql
select issue_type, severity, issue_count
from public.sc_product_integrity_summary_v1();
```

Do not add manual DELETE, UPDATE, merge, or unique-index SQL based only on the diagnostic output.

## Phase 5 — Commit and push

```bash
cd "$HOME/inventory-app"

git status
git add -A
git commit -m "Add application integrity and import safeguards v0.9.0"
git push -u origin feature/application-integrity-v0.9.0
```

Open this pull-request link:

<https://github.com/matt17463/inventory-app/compare/main...feature/application-integrity-v0.9.0?expand=1>

Create the pull request, wait for the checks, and merge it into `main` only after every required check passes.

## Phase 6 — Verify Netlify

1. Open the Netlify project.
2. Open **Deploys**.
3. Confirm the newest production deploy uses the merge commit from `main`.
4. Confirm the deploy is **Published** and not a preview.
5. Open the production application in a private/incognito window.
6. Sign in normally.

No environment variables need to be imported or changed for this release.

## Phase 7 — Production smoke test

Perform these checks in order:

1. Open **Tools & Admin → Product Integrity Center**.
2. Confirm the page loads and says it is read-only.
3. Click **Run Diagnostics**.
4. Record the counts; do not merge or delete the reported records.
5. Open **Add Item to Bin** and read one known S&S or Momentec confirmation.
6. Confirm known items match and ambiguous items remain review items.
7. Confirm the color list shows active canonical colors.
8. Import a small CSV and a small XLSX in the relevant import screens.
9. Confirm a legacy XLS file receives a clear “save as XLSX or CSV” message.
10. Open Inventory, Bins, a Pull Sheet, Production Board, Purchasing, Artwork Requests, and Mockup Studio.
11. Create only a WooCommerce **draft** test product if WooCommerce verification is needed.
12. Delete the WooCommerce draft after verification.

## Rollback

If a production problem appears:

1. In Netlify, open **Deploys**.
2. Select the last known-good production deploy.
3. Choose **Publish deploy**.
4. Do not reverse the SQL migration during an incident. The added view/functions are read-only and can remain installed.
5. Save the browser and Netlify error details before making another change.

The local Git backup is:

```text
$HOME/Downloads/inventory-app-before-v0.9.0.bundle
```

## Appendix — Complete-source replacement

Use this only when the repository is not on 0.8.14 or the upgrade ZIP cannot be applied cleanly. It replaces tracked application source but preserves `.git` and does not include secrets.

```bash
REPO_DIR="$HOME/inventory-app"
PACKAGE_ZIP="$HOME/Downloads/inventory-app-v0.9.0-complete.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PACKAGE_ZIP" || { echo "STOP: Complete ZIP not found at $PACKAGE_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
test -z "$(git status --porcelain)" || { echo "STOP: Commit or move uncommitted files first."; git status; return 1 2>/dev/null || exit 1; }

git fetch origin
git switch main
git pull --ff-only origin main
git bundle create "$HOME/Downloads/inventory-app-before-v0.9.0.bundle" --all
git switch -c feature/application-integrity-v0.9.0

unzip -o "$PACKAGE_ZIP" -d "$REPO_DIR"
npm ci
npm run check
npm audit --omit=dev
```

Then continue with Phase 4.
