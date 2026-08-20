# Supplier Confirmation Receiving v0.8.0 — Deployment Guide

This update adds S&S Activewear and Momentec PDF receiving to **Inventory → Add Items to Bin**.

## What is included

- Text-based parsing of the two supplied confirmation formats; no OpenAI credits are used.
- Exact saved vendor-SKU matching, Supplier Catalog matching, and Brand/Style/Color/Size matching.
- Green matched, yellow review, and red unmatched rows.
- Manual field correction and optional creation of missing blank products.
- Default bin, per-line bin, actual received quantity, unit cost, and receipt notes.
- Duplicate-order protection and partial receiving.
- Saved vendor-SKU mappings for faster future receipts.
- Receiving history, private original-PDF storage, signed PDF access, and guarded rollback.

## Before you begin

The commands below assume:

- Repository: `$HOME/inventory-app`
- Branch: `feature/mockup-studio-v0.7.0`
- Patch ZIP: `$HOME/Downloads/inventory-app-v0.8.0-supplier-confirmation-receiving.zip`

The ZIP overlays the application; it does not delete unrelated files.

## 1. Back up and install the source update

Open Terminal and paste:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-v0.8.0-supplier-confirmation-receiving.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; exit 1; }

cd "$REPO_DIR"
git status
git branch --show-current
git tag "backup-before-v0.8.0-$(date +%Y%m%d-%H%M%S)"
ditto -x -k "$PATCH_ZIP" "$REPO_DIR"
npm install
npm run check
```

Expected result: the check finishes successfully. A bundle-size warning is informational.

## 2. Install the database update

1. Open Supabase.
2. Select the application project.
3. Open **SQL Editor**.
4. Click **New query**.
5. In Finder, open:
   `inventory-app/deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql`
6. Copy the entire file into Supabase SQL Editor.
7. Click **Run** once.

The final result row must show all three values as `true`:

- `imports_ready`
- `receipts_ready`
- `private_pdf_storage_ready`

The SQL is safe to run again if you are unsure whether it completed.

## 3. Commit and push

```bash
cd "$HOME/inventory-app"
git add -A
git commit -m "Add supplier confirmation receiving v0.8.0"
git push -u origin feature/mockup-studio-v0.7.0
```

If Git says `nothing to commit`, verify `node -p "require('./package.json').version"` returns `0.8.0`.

## 4. Create or update the pull request

Open:

<https://github.com/matt17463/inventory-app/compare/main...feature/mockup-studio-v0.7.0?expand=1>

Use title: `Add supplier confirmation receiving v0.8.0`

Merge the pull request after checks pass. If Netlify deploys the feature branch directly, pushing the branch may also start a deploy preview.

## 5. Verify Netlify

1. Open Netlify → the inventory application → **Deploys**.
2. Open the newest production deploy.
3. Confirm its commit matches the merge commit and status says **Published**.
4. Open the application and hard refresh with `Command + Shift + R`.
5. Open **Inventory → Add Items to Bin**.
6. Confirm **Import Supplier Order Confirmation** appears above the manual receiving form.

No new Netlify environment variables are required. Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used by the secured server functions.

## 6. Safe smoke test

1. Set a default receiving bin.
2. Upload one of the supplied PDFs and click **Read Confirmation**.
3. Confirm the totals:

   - S&S order `75436493`: 25 lines, 52 units, $380.10.
   - Momentec order `0054780121`: 14 lines, 86 units, $335.40.

4. Review yellow/red rows. Select Brand, Style, Color, and Size as needed.
5. To avoid changing inventory during the first test, set all **Receive now** quantities to `0`.
6. For a live test, select only one known item and set **Receive now** to `1`.
7. Click **Receive 1 Selected Unit**.
8. Confirm that bin inventory increased by one.
9. Expand **Supplier receiving history** and confirm the order and receipt appear.
10. If this was only a test, use **Rollback 1 unit**. Rollback is blocked if that stock has already been moved or consumed.

## Troubleshooting

### “Supplier receiving SQL is not installed”

Run `deployment/sql/19_SUPPLIER_CONFIRMATION_RECEIVING.sql` in Supabase and verify the three final values are `true`.

### PDF section is not visible

Confirm package version and commit:

```bash
cd "$HOME/inventory-app"
node -p "require('./package.json').version"
git log -1 --oneline
```

Then confirm Netlify published that commit and hard refresh the browser.

### A row is yellow or red

Choose the correct Brand, Style, Color, and Size. Leave **Remember** checked; after the receipt is saved, the same supplier SKU will map automatically next time.

### Previously received order

This is expected duplicate protection. The screen shows previously received and remaining quantities. Receive only the units physically arriving now.

### Rollback is blocked

The received units are no longer available in that bin. Restore/move the stock back first, or make a reviewed inventory adjustment instead.
