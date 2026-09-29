# Deploy Supplier Pairing Hardening v1.4.23

## Purpose

v1.4.23 prevents supplier receiving from silently trusting stale supplier-SKU mappings when the incoming supplier identity disagrees with the mapped blank.

This release was driven by a two-week receiving audit that found S&S Activewear Gildan 18500B Black Youth M receipts being posted to the 18500B Black YS blank.

## Changes

- Prioritize audience-specific size codes before generic size codes:
  - Youth M -> YM before M
  - Adult M -> AM before M
  - Womens M -> WM before M
  - OSFA / One Size -> canonical one-size choices
- Validate saved supplier mappings against resolved brand, style, color, and size.
- Treat approved canonical color aliases as equivalent during validation.
- Reject stale saved supplier mappings when a reliable incoming identity conflicts.
- Re-resolve rejected mappings using brand + style + color + size.
- Keep corrected mapping-conflict rows in Review until an operator manually confirms an identity field.
- Show the mapping-conflict reason in Supplier Receiving.
- Add regression tests for the 18500B Black Youth M -> YS failure pattern.
- Version bump to 1.4.23.

## Database

No Supabase migration is required for v1.4.23.

The historical 18500B inventory and pull-sheet corrections were handled separately before this deployment.

## Files changed

- netlify/functions/_shared/supplierConfirmationParser.js
- netlify/functions/supplier-confirmation-parse.js
- src/SupplierConfirmationReceiving.jsx
- scripts/tests/supplier-confirmation-parser.test.mjs
- package.json
- package-lock.json

## Deployment

Run from Terminal:

```bash
cd "$HOME/inventory-app" || exit 1

echo "===================================================="
echo "FETCH v1.4.23 FEATURE BRANCH"
echo "===================================================="

git fetch origin || exit 1

git checkout feature/supplier-pairing-hardening-v1.4.23 || exit 1
git pull --ff-only origin feature/supplier-pairing-hardening-v1.4.23 || exit 1

echo
echo "=== VERSION ==="
node -p "require('./package.json').version"

echo
echo "=== FOCUSED SUPPLIER RECEIVING TESTS ==="
npm run test:supplier-receiving || exit 1

echo
echo "=== FULL APPLICATION CHECK ==="
npm run check || exit 1

echo
echo "=== DIFF CHECK ==="
git diff --check || exit 1

echo
echo "=== STATUS ==="
git status --short

echo
echo "===================================================="
echo "v1.4.23 VALIDATION PASSED"
echo "DO NOT MERGE UNTIL THE SUPPLIER RECEIVING SMOKE TEST IS COMPLETE."
echo "===================================================="
```

## Supplier receiving smoke test

After the local checks pass:

1. Start or deploy the feature branch as you normally do.
2. Open Supplier Receiving.
3. Re-read a recent S&S confirmation containing Gildan 18500B Black Youth M.
4. Confirm the line resolves to the canonical YM blank, not YS.
5. Confirm a deliberately conflicting saved supplier mapping is shown as Review and cannot be received until an identity field is manually confirmed.
6. Confirm an approved color alias still resolves normally without a false conflict.
7. Do not receive duplicate inventory during the smoke test.

## Merge after validation

When all tests and the smoke test pass:

```bash
cd "$HOME/inventory-app" || exit 1

git checkout main || exit 1
git pull --ff-only origin main || exit 1

git merge --no-ff feature/supplier-pairing-hardening-v1.4.23 \
  -m "Merge supplier pairing hardening v1.4.23" || exit 1

git push origin main || exit 1

echo
echo "===================================================="
echo "v1.4.23 MERGED AND PUSHED TO MAIN"
echo "===================================================="
```

## Expected behavior after deployment

A supplier line such as:

```text
Supplier: S&S Activewear
Style: 18500B
Color: Black
Audience: Youth
Size: M
```

must prefer the canonical youth-medium size (YM).

If the remembered supplier SKU points to YS, the saved mapping is rejected and the importer attempts to re-resolve the line by brand, style, color, and size.

If a corrected blank is found, the row remains in Review and displays the conflict until the operator confirms an identity field.

This prevents stale supplier mappings from silently posting inventory into a different style, color, brand, or size.
