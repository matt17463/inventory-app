# Skilled Crafting Inventory App v1.4.16 R3
## Pull Sheet / Purchasing Integrity

R3 was rebuilt from the current v1.4.15 source inspection rather than from an older Purchasing layout.

The installer is fail-closed. Every modified source anchor is checked before anything is written.

## Application install

Place:

`inventory-app-pullsheet-purchasing-integrity-v1.4.16-r3.zip`

in `~/Downloads`, then run the terminal block supplied with the patch.

The installer expects:
- branch `feature/pullsheet-purchasing-integrity-v1.4.16`
- package version `1.4.15`
- clean working tree
- the inspected v1.4.15 Purchasing API architecture

Run both the targeted test and `npm run check` before SQL.

## SQL

Run:

1. `deployment/sql/63_PULLSHEET_PURCHASING_INTEGRITY.sql`
2. `deployment/sql/64_VERIFY_PULLSHEET_PURCHASING_INTEGRITY.sql`

Do not run SQL 64 until SQL 63 succeeds.

SQL 64 includes a read-only audit of Pull Sheet 272.

## Functional verification

After SQL 64 passes:

1. Open Pull Sheets and confirm a **Pull Sheet #** column is visible.
2. Open Pull Sheet 272.
3. Review any Purchasing integrity warning shown on its line.
4. If a repair warning appears, use **Reconcile Purchasing**.
5. Refresh Purchasing → Current Shortages and Recommended Orders.
6. Confirm the blank appears with the appropriate quantity.
7. Confirm running reconciliation did not change physical on-hand quantity.
8. Verify an exact new product-line mapping can populate an eligible open unpaired line without using a MANUAL placeholder SKU as a durable mapping key.

## Commit

```bash
cd "$HOME/inventory-app" || exit 1

git diff --check
npm run test:pullsheet-purchasing-integrity
npm run check

git add \
  package.json \
  package-lock.json \
  src/PullSheetList.jsx \
  src/PullSheetView.jsx \
  src/lib/inventoryApi.js \
  src/lib/pullSheetPurchasingIntegrityApi.js \
  netlify/functions/pullsheet-purchasing-integrity.js \
  deployment/sql/63_PULLSHEET_PURCHASING_INTEGRITY.sql \
  deployment/sql/64_VERIFY_PULLSHEET_PURCHASING_INTEGRITY.sql \
  scripts/tests/pullsheet-purchasing-integrity.test.mjs \
  deployment/DEPLOY_PULLSHEET_PURCHASING_INTEGRITY_v1.4.16_R3.md \
  deployment/RELEASE_NOTES_v1.4.16_R3.md \
  PATCH_MANIFEST_v1.4.16_R3.txt

git diff --cached --check
git commit -m "Reconcile pull sheet and purchasing integrity v1.4.16"
git push -u origin feature/pullsheet-purchasing-integrity-v1.4.16
```

Then open:

`https://github.com/matt17463/inventory-app/compare/main...feature/pullsheet-purchasing-integrity-v1.4.16?expand=1`

Merge only after GitHub and Netlify checks pass.
