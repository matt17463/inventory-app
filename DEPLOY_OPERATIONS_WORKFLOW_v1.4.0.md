# Skilled Crafting Operations Workflow v1.4.0 — Deployment Guide

This release combines four connected changes:

- Mobile On-site Sales with live blank availability, one-click inventory deduction, production history, and 2×3 or 4×6 thermal labels.
- Drag-and-drop master color mapping that supports separate color IDs with the same displayed name.
- Purchasing quantities recalculated from the authoritative movement ledger and active reservations.
- WooCommerce-to-blank reconciliation in Product Integrity, plus automatic blank creation during Mockup Studio Woo export.

## Before you begin

Do not deploy from a working folder with unfinished changes. The SQL is additive, but make a Supabase database backup before running it.

## Phase 1 — Install the application files

Download `inventory-app-operations-workflow-v1.4.0.zip` to Downloads. Then paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-operations-workflow-v1.4.0.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
git status --short
test -z "$(git status --porcelain)" || { echo "STOP: Commit, move, or remove the files shown above, then run this again."; return 1 2>/dev/null || exit 1; }

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/operations-workflow-v1.4.0
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check
```

Do not continue unless `npm run check` finishes successfully.

## Phase 2 — Run the Supabase SQL

Open Supabase → SQL Editor → New query. Open the following file from the patch, copy its entire contents, paste it into the SQL Editor, and click **Run**:

```text
deployment/sql/48_MOCKUP_STUDIO_AUTOMATIC_BLANKS.sql
```

Then run this file the same way:

```text
deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql
```

The second migration creates only catalog/workflow records and functions. It does not add inventory quantities or deduct anything during deployment.

Now run both verification files:

```text
deployment/sql/49_VERIFY_MOCKUP_STUDIO_AUTOMATIC_BLANKS.sql
deployment/sql/51_VERIFY_ONSITE_SALES_AND_RECONCILIATION.sql
```

The last verification query may list existing catalog issues. That is expected; it is a read-only reconciliation report.

## Phase 3 — Commit and push

Paste this block into Terminal:

```bash
cd "$HOME/inventory-app"

git add -A
git commit -m "Add onsite sales and catalog reconciliation v1.4.0"
git push -u origin feature/operations-workflow-v1.4.0
```

Open this pull-request link:

<https://github.com/matt17463/inventory-app/compare/main...feature/operations-workflow-v1.4.0?expand=1>

Create the pull request, wait for all checks to pass, then merge it into `main`.

## Phase 4 — Confirm Netlify deployment

1. Open Netlify and select the inventory application.
2. Open **Deploys**.
3. Confirm the production deploy for `main` is **Published**.
4. Open `https://inventory.skilledcrafting.com` in a private/incognito browser window.
5. Sign in and confirm the application version in `package.json` is `1.4.0` in the deploy details.

No new Netlify environment variables are required. Existing `WOO_SITE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, Supabase, and employee-auth variables must remain present.

## Phase 5 — Test On-site Sales without risking an order

1. Open **Production → On-site Sales**.
2. Choose an event WooCommerce category. The choice stays active on that device until changed.
3. Optionally choose a WooCommerce product to load its logo/design choices.
4. Search physical inventory and choose an item showing at least 1 available.
5. Enter `DEPLOYMENT TEST` as the customer and choose a label size.
6. Complete the item. This intentionally deducts one blank.
7. Print or preview the label.
8. Receive that same blank back into its source bin after the test, with the note `Reverse v1.4.0 deployment test`.

The page will refuse to use a zero-stock or fully reserved item. WooCommerce is the event menu; the physical blank ledger is the inventory authority. Inventory-only blanks can therefore be sold without creating a Woo product first.

## Phase 6 — Test the purchasing correction

1. Open **Purchasing Report** and search `INDEPENDENT-SF4600QZ-SPORT-GREY-A3XL`.
2. If the ledger has 1 on hand and active reservations total 1, it must show 0 available and 0 shortage.
3. It must not appear under Current Shortages.
4. If it still appears, run this read-only SQL and review the movement/reservation rows rather than editing a quantity directly:

```sql
select *
from public.sc_purchasing_authoritative_inventory_v3
where blank_product_id = (
  select id from public.blank_products
  where sku_base = 'INDEPENDENT-SF4600QZ-SPORT-GREY-A3XL'
  limit 1
);

select *
from public.blank_inventory_movements
where blank_product_id = (
  select id from public.blank_products
  where sku_base = 'INDEPENDENT-SF4600QZ-SPORT-GREY-A3XL'
  limit 1
)
order by created_at;

select *
from public.inventory_reservations
where blank_product_id = (
  select id from public.blank_products
  where sku_base = 'INDEPENDENT-SF4600QZ-SPORT-GREY-A3XL'
  limit 1
)
order by id;
```

## Phase 7 — Use drag-and-drop color mapping

1. Open **Tools & Admin → Color Pairings**.
2. Search a color family, such as `black`.
3. In **Canonical color to use**, click the one record that should be the master. The selected card shows its database ID.
4. Drag each unwanted duplicate/variation from the left onto the blue dashed **Master color drop zone**.
5. Review the queued list and click **Save Selected Pairings**.

The new mapping uses IDs, not only names. `Black` ID 8 can therefore map to `Black` ID 63. Existing finished-product rows are updated. Blank rows are updated only when that will not create a duplicate brand/style/color/size identity; unresolved duplicates remain visible in Product Integrity for deliberate merge/replacement.

## Phase 8 — Reconcile WooCommerce products and blanks

1. Run **WooCommerce Sync**.
2. Open **Product Integrity Center** and click **Run Diagnostics**.
3. Review the **WooCommerce ↔ blank reconciliation** table first.
4. Use **Product-to-Blank Mappings** for an archived/discontinued blank replacement.
5. Use **New Product Line Setup** only for catalog rows created outside Mockup Studio.

For a new Mockup Studio product:

1. Enter Brand, Style, Colors, and Sizes on the WooCommerce step.
2. Leave **Create missing blank catalog items** enabled.
3. Enter the unit cost or mark the cost for review.
4. Create the WooCommerce draft.

The export now creates or reuses every required blank color/size at zero on hand, records Woo variation-to-blank mappings, and leaves receiving quantities untouched. This applies to new exports. Existing unmapped Woo variations are found by Product Integrity and can be repaired with Product-to-Blank Mappings.

## Rollback

To roll back application code, revert the merge commit in GitHub and let Netlify deploy the revert. Do not delete the new database tables: they are additive audit/history records. If the On-site Sales menu must be paused, remove its navigation route in a follow-up release; existing production history remains intact.
