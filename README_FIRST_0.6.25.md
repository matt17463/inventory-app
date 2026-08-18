# Skilled Crafting Inventory App 0.6.25 Deployment

## Confirmed issue

Manual order 14 has 53 source lines. Pull sheet 170 has 265 saved rows:
five batches of 53. The current lines are IDs 570–622; IDs 358–569 are 212
orphaned historical copies.

## Step 1 — Run the safe repair

In a new Supabase SQL Editor query, run:

```text
12_PULL_SHEET_170_SAFE_DUPLICATE_REPAIR.sql
```

This script does not delete job items. It backs up and cancels the 212
orphaned rows, releases their reservations, and adds an active-line uniqueness
guard.

Expected verification:

```text
active_job_items = 53
cancelled_duplicate_rows = 212
all_preserved_job_item_rows = 265
current_manual_mappings = 53
unique_current_mappings = 53
```

The final duplicate query should return zero rows.

## Step 2 — Build

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.25
npm ci
npm run check
```

## Step 3 — Preview

```bash
rm -rf dist
npx netlify build --context production
npx netlify deploy --dir=dist --functions=netlify/functions
```

Open pull sheet 170. It should show 53 active lines. Opening it repeatedly
must not alter the database count or create new rows.

## Step 4 — Production

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
