# Skilled Crafting Inventory App 0.6.18 Deployment

This release renames the special shortage bin to **Pending Stock** and makes
those pull-sheet quantities appear on the purchasing report.

## Step 1 — Rename the saved bin

In Supabase SQL Editor, run:

```text
06_RENAME_UNASSIGNED_BIN_TO_PENDING_STOCK.sql
```

The script preserves the bin ID, so existing pull-sheet assignments remain
attached to the same record.

Expected saved values:

```text
Bin code: PENDING-STOCK
Label: Pending Stock
```

## Step 2 — Install and validate the application

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.18
npm ci
npm run check
```

The build must finish with:

```text
PASS: Required production bundle features are present.
```

## Step 3 — Build with the working Netlify environment

```bash
rm -rf dist
npx netlify build --context production
```

## Step 4 — Preview deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

In the new preview:

1. Open a pull sheet containing an unavailable blank.
2. Confirm its bin shows **Pending Stock**.
3. Open **Purchasing → Purchasing Report**.
4. Confirm the item appears under **Current Shortages**.
5. Confirm it appears under **Recommended Orders**.
6. Confirm its row shows `Pending Stock: N`.
7. Confirm related pull-sheet links appear under Orders / Pull Sheets.

## Step 5 — Production deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```

No other database migrations are required for this release.
