# Skilled Crafting Inventory App 0.6.23 Deployment

This version adds a purchasing-report toggle to non-inventory pull-sheet
lines. One self-contained Supabase migration is required. The replacement
migration also creates the non-inventory rules table when it is missing.

## Step 1 — Run the Supabase migration

In Supabase SQL Editor, run:

```text
07_NON_INVENTORY_PURCHASING_TOGGLE.sql
```

The verification result should show:

```text
rules_table_installed = true
job_item_toggle_installed = true
mark_function_installed = true
apply_job_function_installed = true
apply_open_jobs_function_installed = true
```

The migration creates the rules table when needed and adds:

```text
job_items.include_on_purchasing_report
non_inventory_product_rules.include_on_purchasing_report
```

Existing records default to Included, preserving current behavior until you
turn the option off.

## Step 2 — Install and validate the application

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.23
npm ci
npm run check
```

The build must end with:

```text
PASS: Required production bundle features are present.
```

## Step 3 — Build with Netlify's production environment

```bash
rm -rf dist
npx netlify build --context production
```

## Step 4 — Preview deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

## Step 5 — Test the reported workflow

1. Open the affected manual-order pull sheet.
2. Find the line already marked non-inventory.
3. Turn off **Include on Purchasing Report**.
4. Confirm the line says **Excluded from the Purchasing Report**.
5. Refresh the Purchasing Report.
6. Confirm that order/pull-sheet demand is gone.
7. Confirm unrelated demand for the same blank remains.
8. Turn the toggle back on and confirm the demand returns.

For a new line:

1. Select **Mark Non-Inventory**.
2. Enter the reason.
3. Uncheck **Include this item on the Purchasing Report**.
4. Save.
5. Confirm the line is non-inventory and excluded from purchasing.

## Step 6 — Production deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
