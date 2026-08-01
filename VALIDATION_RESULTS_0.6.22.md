# Validation Results — 0.6.22

## Application contract tests

```text
TAP version 13
# Subtest: all navigation paths have active routes
ok 1 - all navigation paths have active routes
  ---
  duration_ms: 1.710244
  type: 'test'
  ...
# Subtest: employee routes use a real not-found page
ok 2 - employee routes use a real not-found page
  ---
  duration_ms: 0.223893
  type: 'test'
  ...
# Subtest: legacy create-product route is a safe redirect
ok 3 - legacy create-product route is a safe redirect
  ---
  duration_ms: 0.130535
  type: 'test'
  ...
# Subtest: public customer portal remains outside AuthGate
ok 4 - public customer portal remains outside AuthGate
  ---
  duration_ms: 0.137975
  type: 'test'
  ...
# Subtest: known stale deployable files are absent
ok 5 - known stale deployable files are absent
  ---
  duration_ms: 0.251404
  type: 'test'
  ...
# Subtest: fallback navigation does not contain removed bin-contents route
ok 6 - fallback navigation does not contain removed bin-contents route
  ---
  duration_ms: 0.143664
  type: 'test'
  ...
# Subtest: out-of-stock pull sheet lines use the Pending Stock bin safely
ok 7 - out-of-stock pull sheet lines use the Pending Stock bin safely
  ---
  duration_ms: 0.404202
  type: 'test'
  ...
# Subtest: purchasing report counts Pending Stock demand
ok 8 - purchasing report counts Pending Stock demand
  ---
  duration_ms: 0.428217
  type: 'test'
  ...
# Subtest: purchase order screens use the purchasing report source of truth
ok 9 - purchase order screens use the purchasing report source of truth
  ---
  duration_ms: 1.655403
  type: 'test'
  ...
# Subtest: physical Unassigned inventory clears stale Pending Stock demand
ok 10 - physical Unassigned inventory clears stale Pending Stock demand
  ---
  duration_ms: 0.737677
  type: 'test'
  ...
# Subtest: graphical interface themes are display-only and fully wired
ok 11 - graphical interface themes are display-only and fully wired
  ---
  duration_ms: 1.596395
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 52.574051
```

## Security helper tests

```text
TAP version 13
# Subtest: WooCommerce HMAC matches SHA-256 base64
ok 1 - WooCommerce HMAC matches SHA-256 base64
  ---
  duration_ms: 1.047899
  type: 'test'
  ...
# Subtest: timing-safe comparison rejects unequal values and accepts equal values
ok 2 - timing-safe comparison rejects unequal values and accepts equal values
  ---
  duration_ms: 0.131586
  type: 'test'
  ...
# Subtest: raw body preserves base64 encoded webhook payload
ok 3 - raw body preserves base64 encoded webhook payload
  ---
  duration_ms: 0.146078
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 49.524704
```

## Netlify ESM validation

```text
Validated 12 Netlify JavaScript files as ESM.
```

## JavaScript and JSX parsing

```text
Parsed 114 JavaScript/JSX source files successfully.
```

## Scope verification

The only source files changed from 0.6.21 are:

```text
Files /mnt/data/inventory-app-main-complete-corrected-v0.6.21/src/ThemeSettings.jsx and /mnt/data/inventory-app-main-complete-corrected-v0.6.22/src/ThemeSettings.jsx differ
Files /mnt/data/inventory-app-main-complete-corrected-v0.6.21/src/themePresets.js and /mnt/data/inventory-app-main-complete-corrected-v0.6.22/src/themePresets.js differ
Files /mnt/data/inventory-app-main-complete-corrected-v0.6.21/src/themes.css and /mnt/data/inventory-app-main-complete-corrected-v0.6.22/src/themes.css differ
Files /mnt/data/inventory-app-main-complete-corrected-v0.6.21/src/ui/ThemeProvider.jsx and /mnt/data/inventory-app-main-complete-corrected-v0.6.22/src/ui/ThemeProvider.jsx differ
```

Inventory, pull-sheet, purchasing, purchase-order, WooCommerce, Supabase,
Netlify function, route, permission, and SQL implementation files were not
modified.

## Dependency build

The container's npm installation did not complete within the available
registry window. Run `npm ci` and `npm run check` on the deployment Mac. Do not
deploy unless the build verifier ends with:

```text
PASS: Required production bundle features are present.
```
