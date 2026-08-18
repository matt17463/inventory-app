# Validation Results — 0.6.23

## Static application tests

```text
TAP version 13
# Subtest: all navigation paths have active routes
ok 1 - all navigation paths have active routes
  ---
  duration_ms: 1.288596
  type: 'test'
  ...
# Subtest: employee routes use a real not-found page
ok 2 - employee routes use a real not-found page
  ---
  duration_ms: 0.219587
  type: 'test'
  ...
# Subtest: legacy create-product route is a safe redirect
ok 3 - legacy create-product route is a safe redirect
  ---
  duration_ms: 0.130294
  type: 'test'
  ...
# Subtest: public customer portal remains outside AuthGate
ok 4 - public customer portal remains outside AuthGate
  ---
  duration_ms: 0.140149
  type: 'test'
  ...
# Subtest: known stale deployable files are absent
ok 5 - known stale deployable files are absent
  ---
  duration_ms: 0.254619
  type: 'test'
  ...
# Subtest: fallback navigation does not contain removed bin-contents route
ok 6 - fallback navigation does not contain removed bin-contents route
  ---
  duration_ms: 0.143634
  type: 'test'
  ...
# Subtest: out-of-stock pull sheet lines use the Pending Stock bin safely
ok 7 - out-of-stock pull sheet lines use the Pending Stock bin safely
  ---
  duration_ms: 0.406365
  type: 'test'
  ...
# Subtest: purchasing report counts Pending Stock demand
ok 8 - purchasing report counts Pending Stock demand
  ---
  duration_ms: 1.563145
  type: 'test'
  ...
# Subtest: purchase order screens use the purchasing report source of truth
ok 9 - purchase order screens use the purchasing report source of truth
  ---
  duration_ms: 0.82691
  type: 'test'
  ...
# Subtest: physical Unassigned inventory clears stale Pending Stock demand
ok 10 - physical Unassigned inventory clears stale Pending Stock demand
  ---
  duration_ms: 0.767321
  type: 'test'
  ...
# Subtest: graphical interface themes are display-only and fully wired
ok 11 - graphical interface themes are display-only and fully wired
  ---
  duration_ms: 1.14927
  type: 'test'
  ...
# Subtest: non-inventory lines can be included in or excluded from purchasing
ok 12 - non-inventory lines can be included in or excluded from purchasing
  ---
  duration_ms: 0.910314
  type: 'test'
  ...
1..12
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 54.979589
```

## Security helper tests

```text
TAP version 13
# Subtest: WooCommerce HMAC matches SHA-256 base64
ok 1 - WooCommerce HMAC matches SHA-256 base64
  ---
  duration_ms: 0.955591
  type: 'test'
  ...
# Subtest: timing-safe comparison rejects unequal values and accepts equal values
ok 2 - timing-safe comparison rejects unequal values and accepts equal values
  ---
  duration_ms: 0.134641
  type: 'test'
  ...
# Subtest: raw body preserves base64 encoded webhook payload
ok 3 - raw body preserves base64 encoded webhook payload
  ---
  duration_ms: 0.148681
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
# duration_ms 45.18592
```

## Netlify ESM validation

```text
Validated 12 Netlify JavaScript files as ESM.
```

## JavaScript / JSX parsing

```text
Parsed 134 JavaScript/JSX files successfully.
```

## Result

- All application contract tests passed.
- All security helper tests passed.
- Netlify function ESM validation passed.
- All JavaScript and JSX source files parsed successfully.
- The required database migration and feature files are present.

Run `npm ci` and `npm run check` on the deployment Mac to complete dependency,
ESLint, production Vite build, and finished-bundle verification.
