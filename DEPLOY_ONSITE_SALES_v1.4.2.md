# Skilled Crafting v1.4.2 — Cut-and-Paste Deployment Guide

This patch is designed to overlay the current **v1.4.1** repository. It does not add, remove, or adjust physical inventory quantities during deployment.

## What this fixes

1. WooCommerce category selection no longer fails with `Invalid parameter(s): orderby`.
2. Selecting a WooCommerce category automatically builds the **Logo / Graphic** list from published products in that category.
3. Physical blanks are selected with **Type → Brand → Style → Color → Size**, and every selector is limited to inventory with positive availability after reservations.
4. Mockup Studio now stores an **Item Type** for each Style. This is also the preferred repair path for older Mockup Studio drafts that previously failed because no blank product existed.

---

## Step 1 — Put the patch ZIP in Downloads

Download:

`inventory-app-onsite-sales-v1.4.2-patch.zip`

into your Mac **Downloads** folder.

## Step 2 — Apply the application patch

Paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-onsite-sales-v1.4.2-patch.zip"

cd "$REPO_DIR" || exit 1

git status --short

test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; exit 1; }

git fetch origin
git switch main
git pull --ff-only origin main

git switch -c feature/onsite-sales-v1.4.2
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check
```

**STOP if `npm run check` does not finish successfully.** Do not deploy a failed build.

## Step 3 — Run the Supabase migration

Open **Supabase → SQL Editor → New query**.

Open this patched file and run the entire file:

```text
deployment/sql/52_ONSITE_SALES_CASCADING_PICKER.sql
```

Expected result: `Success. No rows returned`.

This migration:

- creates `sc_blank_item_types`;
- adds `product_types.sc_item_type_id`;
- seeds the standard item types;
- creates `sc_onsite_inventory_search_v2`;
- makes only conservative automatic classifications where the Style name itself clearly says Tee, Hoodie, Bag, etc.;
- does **not** modify inventory quantities.

Then run the read-only verification file:

```text
deployment/sql/53_VERIFY_ONSITE_SALES_CASCADING_PICKER.sql
```

The final result set may list styles as **unclassified**. That is not a deployment failure. Numeric styles such as `18500` are deliberately not guessed.

## Step 4 — Commit and push

After `npm run check` and both SQL files succeed, paste:

```bash
cd "$HOME/inventory-app" || exit 1

git add -A
git status --short
git commit -m "Add cascading onsite sales picker v1.4.2"
git push -u origin feature/onsite-sales-v1.4.2
```

Open GitHub and create a pull request from:

`feature/onsite-sales-v1.4.2` → `main`

Merge only after GitHub checks pass.

## Step 5 — Confirm Netlify

1. Open Netlify → your inventory app → **Deploys**.
2. Confirm the deployment from the merged `main` commit says **Published**.
3. Open the inventory app in a private/incognito browser window.
4. Confirm the application version is **1.4.2**.

No new Netlify environment variables are required.

## Step 6 — Repair older Mockup Studio drafts with missing blanks

For each affected older project:

1. Open **Mockup Studio** and the original project.
2. Open **9. WooCommerce**.
3. Confirm Brand and Style.
4. In **Blank inventory catalog**, choose the new **Item Type** such as Hoodie, Tee, Bag, etc.
5. Confirm Colors and Sizes.
6. Leave **Create missing blank products and save variation mappings** enabled.
7. Enter the existing WooCommerce draft/product ID in **Existing Woo product ID**.
8. Click **Update WooCommerce Draft**.
9. Run **WooCommerce Sync**.
10. Open **Product Integrity Center → Run Diagnostics** and verify the Woo variations now have active blank mappings.

This is better than opening the draft directly in WordPress and clicking Update. The Mockup Studio update path runs the Supabase blank creation/reuse and mapping logic. New blank catalog rows are created at **zero on hand**; receiving quantities remain unchanged.

If an old Woo product no longer has a usable Mockup Studio project, repair it through **Product Integrity → Product-to-Blank Mappings** instead.

## Step 7 — Test On-site Sales

Open **Production → On-site Sales**.

Test in this order:

1. Choose a WooCommerce category.
2. Verify there is no `orderby` error.
3. Verify **Logo / Graphic** contains the combined logo/design options from published products in that category.
4. Choose **Type**.
5. Verify Brand narrows to brands with available inventory in that Type.
6. Choose Brand → Style → Color → Size.
7. Confirm the selected SKU and available quantity appear.
8. Do not complete a test item unless you intend to deduct one blank.

For a controlled live test, enter `DEPLOYMENT TEST` as the customer, complete one known blank, then receive that exact blank back into its original bin with the note:

`Reverse v1.4.2 deployment test`

## About Unclassified styles

Legacy numeric/catalog Styles may initially appear under **Unclassified**. The safest way to classify a style that came from Mockup Studio is to update one of its Woo drafts using the steps above. The Item Type is stored on the Style itself, so every color and size for that Style immediately moves into the correct Type in On-site Sales.

Do not classify an uncertain Style by guessing solely from its number.
