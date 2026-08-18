# Validation Results — 0.6.19

## JavaScript syntax checks

Passed for:

- `src/lib/inventoryApi.js`
- `scripts/verify_build_features.mjs`
- `scripts/tests/static-contract.test.mjs`

## Static contract tests

```text
TAP version 13
# Subtest: all navigation paths have active routes
ok 1 - all navigation paths have active routes
  ---
  duration_ms: 1.231353
  type: 'test'
  ...
# Subtest: employee routes use a real not-found page
ok 2 - employee routes use a real not-found page
  ---
  duration_ms: 0.167159
  type: 'test'
  ...
# Subtest: legacy create-product route is a safe redirect
ok 3 - legacy create-product route is a safe redirect
  ---
  duration_ms: 0.176373
  type: 'test'
  ...
# Subtest: public customer portal remains outside AuthGate
ok 4 - public customer portal remains outside AuthGate
  ---
  duration_ms: 0.167299
  type: 'test'
  ...
# Subtest: known stale deployable files are absent
ok 5 - known stale deployable files are absent
  ---
  duration_ms: 0.256512
  type: 'test'
  ...
# Subtest: fallback navigation does not contain removed bin-contents route
ok 6 - fallback navigation does not contain removed bin-contents route
  ---
  duration_ms: 0.142061
  type: 'test'
  ...
# Subtest: out-of-stock pull sheet lines use the Pending Stock bin safely
ok 7 - out-of-stock pull sheet lines use the Pending Stock bin safely
  ---
  duration_ms: 0.435068
  type: 'test'
  ...
# Subtest: purchasing report counts Pending Stock demand
ok 8 - purchasing report counts Pending Stock demand
  ---
  duration_ms: 0.448578
  type: 'test'
  ...
# Subtest: purchase order screens use the purchasing report source of truth
ok 9 - purchase order screens use the purchasing report source of truth
  ---
  duration_ms: 0.853791
  type: 'test'
  ...
1..9
# tests 9
# suites 0
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51.382993
```

## Result

Nine static application tests passed, including:

- Pending Stock pull-sheet behavior
- Pending Stock purchasing demand
- Purchasing Report / Purchase Order source reconciliation
- Open purchase-order coverage calculation
- Exclusion of Pending Stock from PO receiving bins

Run `npm ci` and `npm run check` on the deployment computer before publishing.
