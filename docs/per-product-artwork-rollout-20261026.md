# Skilled Crafting per-product artwork rollout

## Default: legacy / unpaired
Existing WooCommerce products with no approved, manager-verified `sc_client_graphic_product_bindings` row remain on the existing storefront and inventory/pull-sheet process. The new catalog review records, draft recipes, uploaded artwork and matching suggestions **do not** activate graphic capture. Do not infer approval from similar file names, SKUs, or historical order text.

## Setup in progress
Upload files to R2; review original artwork, technical preflight and customer consent. Create and refine draft recipes for each actual garment/size, verify production settings and samples. Draft associations and disabled graphic rules must not affect checkout.

## Opt-in managed product
Only for the chosen Woo parent ID, verify the exact variation map; approved graphic family, variant, size/color rules, R2 object, physical sample and manager-reviewed binding. Product-level WordPress selector config must emit canonical family UUID. Global selector/capture flags are *deployment gates*, never catalog-wide approval. A globally enabled capture flag processes only managed enrollment; never turn on the WordPress selector without validating product scoping and the real product form.

If an enrolled managed product is missing a required choice, or supplies an invalid UUID, the managed line must fail closed; do not pretend it is legacy. A line without approved enrollment stays legacy even when an old add-on supplies an invalid graphic field. Mixed-cart lines must be isolated and independently evaluated. No automatic migration of older order lines and no rewriting historical travelers.

## Release validation
1. PHPUnit/PHP plugin fixture plus Node reconciliation tests; lint and app build.
2. Verify exact Netlify publication commit and WordPress plugin version independently. Git merge does **not** update a manually installed WP plugin.
3. Confirm checkout's classic/Store API form and webhook carries canonical UUID and both Woo parent and variation IDs.
4. Confirm mixed order one approved managed product + one unpaired product: managed line resolves artwork and traveler; legacy line follows existing order/pull-sheet path, without inherited graphics.
5. Inspect capture failures, idempotent webhook retry, production traveler receipts and R2 object check.
6. Rollback WordPress selector first, then Netlify capture flag; retain historical snapshots and prior capture evidence.

**Do not enable live graphics on any product without its individual verification.** The pairing workbench and Mockup Studio are safe to deploy with both global activation flags still off.
