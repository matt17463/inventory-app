# Skilled Crafting Inventory App — Product Color Manager v1.4.20

This extends the merged v1.4.19 Product Color Replacement feature with a second workflow: **Add New Color**.

## Replace existing color
The existing guarded replacement workflow remains:
- existing Woo variation IDs stay intact;
- existing SKU, price, Size, Logo, and variation image assignments stay intact;
- the Color attribute and physical blank mapping change;
- active pull-sheet lines can be repaired.

## Add new color
The new workflow:
1. Choose an existing Woo product.
2. Select an existing **template color**.
3. Select the **new Woo Color term**.
4. The app copies the active Size × Logo matrix from the template color.
5. It resolves a unique physical blank in the new color for every size.
6. It shows blockers before any mutation.
7. Upload **one garment/mockup image per Logo combination**.
8. Every size for that logo reuses the same uploaded image.
9. The new color is added to the parent product.
10. Missing new-color variations are created in Woo in batches.
11. Template variation pricing and shipping/tax settings are copied.
12. New SKUs are generated deterministically.
13. New Woo variation-ID and SKU mappings are saved to the correct blank.
14. Partial runs are resumable; already-created combinations are detected and their durable blank mappings/metadata are re-verified instead of duplicated.
15. Run WooCommerce Sync once after completion so the new Woo variations populate the local `products` table.

## Image handling
Uploads go directly from the browser to the existing R2 account using authenticated presigned PUT URLs. WooCommerce imports each uploaded image into its Media Library, and the tool records the resulting Woo image ID by New Color + Logo slot. This allows a retry to reuse images already imported.

Accepted image types: PNG, JPEG, WebP. Maximum 50 MB each.

## Important safety rules
- The Woo Color term must already exist.
- The corresponding internal `colors` record must exist.
- Every required physical blank must already exist; the tool never invents blank products or inventory quantities.
- A template variation must already have a unique durable blank mapping.
- Existing target combinations are skipped instead of duplicated.
- No inventory movements are created or modified.
- No Supabase SQL migration is required.

## Install from merged main
v1.4.19 is already merged. Start a fresh v1.4.20 feature branch from current `main`.

After extracting the ZIP into the repository:

```bash
cd "$HOME/inventory-app" || exit 1

git switch main
git pull --ff-only origin main
git status --short

git switch -c feature/product-color-manager-v1.4.20

python3 scripts/apply_product_color_manager_v1_4_20.py

npm run test:product-color-replacement
npm run check

git diff --check
git status --short
git diff --stat
```

Stop before commit/push and review the output.

## Expected new/changed feature files
- `src/ProductColorReplacement.jsx`
- `src/lib/productColorReplacementApi.js`
- `netlify/functions/product-color-replacement.js`
- `scripts/tests/product-color-replacement.test.mjs`
- `scripts/apply_product_color_manager_v1_4_20.py`
- `deployment/DEPLOY_PRODUCT_COLOR_MANAGER_v1.4.20.md`
- `deployment/PRODUCT_COLOR_MANAGER_v1.4.20_MANIFEST.json`
- `package.json`
- `src/navigationConfig.js`
- `src/App.jsx` only if the route/import was not already installed.
