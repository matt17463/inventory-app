# Skilled Crafting Inventory App — Product Color Replacement v1.4.19

## What this patch adds

A new **Tools & Admin → Replace Product Color** page for correcting an existing WooCommerce variable product without manually editing 100+ variations.

The workflow:

1. Search/select an existing WooCommerce variable product.
2. Choose its current color and the replacement WooCommerce Color term.
3. Preview every affected existing variation.
4. Validate that every variation can move to a unique physical blank with the same blank Brand + Style + Size and the replacement Color.
5. Detect duplicate Color × Size × Logo/other variation combinations before mutation.
6. Update the **existing Woo variation IDs in place** in batches of 25.
7. Preserve the existing variation SKU, price, size, logo selection, and image assignment.
8. Save durable Woo variation + SKU → blank mappings using `sc_set_product_blank_mapping_v1`.
9. Update synced `products.color_id` / `blank_product_id`.
10. Optionally repair affected open pull sheets/reservations using the existing guarded Purchasing repair RPCs.
11. Remove the old Color option from the parent product after all variation updates verify successfully.

## Safety behavior

- Preview is mandatory.
- Apply requires typing `REPLACE COLOR`.
- A confirmation token prevents applying stale previews.
- The replacement is blocked when:
  - the target Woo color term is missing,
  - the internal color is missing/ambiguous,
  - a current variation lacks a durable blank mapping,
  - the replacement blank does not exist for a size/family,
  - more than one replacement blank matches,
  - or the replacement would create duplicate variation combinations.
- Existing Woo variation IDs are preserved.
- Existing variation images are preserved because the batch update deliberately omits `image`.
- Existing SKUs are preserved because the batch update deliberately omits `sku`.
- Blank mappings are written before each Woo batch. If Woo stops partway through, re-previewing the product safely shows the remaining old-color variations.
- No inventory movement quantities are created or changed.
- No new SQL migration is required.

## Install

From the repository root:

```bash
cd "$HOME/inventory-app" || exit 1

git status --short
git switch main
git pull --ff-only origin main

git switch -c feature/product-color-replacement-v1.4.19

# Extract the patch ZIP directly into ~/inventory-app first, then:
python3 scripts/apply_product_color_replacement_v1_4_19.py

npm run test:product-color-replacement
npm run check

git diff --check
git status --short
git diff --stat
```

Do **not** commit/push until both the focused test and `npm run check` pass.

## Expected files

New:
- `src/ProductColorReplacement.jsx`
- `src/lib/productColorReplacementApi.js`
- `netlify/functions/product-color-replacement.js`
- `scripts/tests/product-color-replacement.test.mjs`
- `scripts/apply_product_color_replacement_v1_4_19.py`
- `deployment/DEPLOY_PRODUCT_COLOR_REPLACEMENT_v1.4.19.md`

Modified by installer:
- `src/App.jsx`
- `src/navigationConfig.js`
- `package.json`

## After tests pass

```bash
cd "$HOME/inventory-app" || exit 1

git add \
  src/ProductColorReplacement.jsx \
  src/lib/productColorReplacementApi.js \
  netlify/functions/product-color-replacement.js \
  scripts/tests/product-color-replacement.test.mjs \
  scripts/apply_product_color_replacement_v1_4_19.py \
  deployment/DEPLOY_PRODUCT_COLOR_REPLACEMENT_v1.4.19.md \
  src/App.jsx \
  src/navigationConfig.js \
  package.json

git diff --cached --check
git status --short

git commit -m "Add guarded Woo product color replacement v1.4.19"
git push -u origin feature/product-color-replacement-v1.4.19
```

Then merge through the normal PR/deployment workflow.

## First production test

Use one product/color pair first.

1. Open **Tools & Admin → Replace Product Color**.
2. Search the product.
3. Select the old color and replacement color.
4. Click **Preview replacement**.
5. Confirm:
   - zero blockers,
   - expected variation count,
   - every row has the correct replacement blank,
   - open pull-sheet lines are expected,
   - existing variation image IDs are shown as preserved.
6. Apply.
7. In WooCommerce, spot-check several sizes/logos:
   - same variation IDs,
   - replacement color,
   - same variation images,
   - same prices/SKUs.
8. Create or inspect a future order/pull sheet and confirm the new physical blank is selected automatically.

If the preview reports missing replacement blanks, create those blank catalog records first; the tool intentionally will not invent physical inventory definitions or quantities.
