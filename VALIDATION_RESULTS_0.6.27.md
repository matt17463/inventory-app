# Validation Results — 0.6.27

```text
TAP version 13
# Subtest: all navigation paths have active routes
ok 1 - all navigation paths have active routes
  ---
  duration_ms: 1.290773
  type: 'test'
  ...
# Subtest: employee routes use a real not-found page
ok 2 - employee routes use a real not-found page
  ---
  duration_ms: 0.239055
  type: 'test'
  ...
# Subtest: legacy create-product route is a safe redirect
ok 3 - legacy create-product route is a safe redirect
  ---
  duration_ms: 0.131855
  type: 'test'
  ...
# Subtest: public customer portal remains outside AuthGate
ok 4 - public customer portal remains outside AuthGate
  ---
  duration_ms: 0.131866
  type: 'test'
  ...
# Subtest: known stale deployable files are absent
ok 5 - known stale deployable files are absent
  ---
  duration_ms: 0.299494
  type: 'test'
  ...
# Subtest: fallback navigation does not contain removed bin-contents route
ok 6 - fallback navigation does not contain removed bin-contents route
  ---
  duration_ms: 0.152826
  type: 'test'
  ...
# Subtest: out-of-stock pull sheet lines use the Pending Stock bin safely
ok 7 - out-of-stock pull sheet lines use the Pending Stock bin safely
  ---
  duration_ms: 0.94532
  type: 'test'
  ...
# Subtest: purchasing report counts Pending Stock demand
ok 8 - purchasing report counts Pending Stock demand
  ---
  duration_ms: 0.684094
  type: 'test'
  ...
# Subtest: purchase order screens use the purchasing report source of truth
ok 9 - purchase order screens use the purchasing report source of truth
  ---
  duration_ms: 0.802298
  type: 'test'
  ...
# Subtest: physical Unassigned inventory clears stale Pending Stock demand
ok 10 - physical Unassigned inventory clears stale Pending Stock demand
  ---
  duration_ms: 0.771834
  type: 'test'
  ...
# Subtest: graphical interface themes are display-only and fully wired
ok 11 - graphical interface themes are display-only and fully wired
  ---
  duration_ms: 1.117276
  type: 'test'
  ...
# Subtest: non-inventory lines can be included in or excluded from purchasing
ok 12 - non-inventory lines can be included in or excluded from purchasing
  ---
  duration_ms: 0.988815
  type: 'test'
  ...
# Subtest: opening a pull sheet is database read-only
ok 13 - opening a pull sheet is database read-only
  ---
  duration_ms: 0.224623
  type: 'test'
  ...
# Subtest: pull sheets hide cancelled historical duplicate rows
ok 14 - pull sheets hide cancelled historical duplicate rows
  ---
  duration_ms: 0.292984
  type: 'test'
  ...
# Subtest: pull-sheet completion is idempotent and uses the safe RPC
ok 15 - pull-sheet completion is idempotent and uses the safe RPC
  ---
  duration_ms: 0.250561
  type: 'test'
  ...
# Subtest: inventory overview searches every product SKU, name, and description
ok 16 - inventory overview searches every product SKU, name, and description
  ---
  duration_ms: 0.449426
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 56.463647
```

```text
BlankInventory.jsx parsed successfully.
```

Static validation confirms paginated catalog loading, automatic linked-SKU
search, description metadata search, and Description columns in both inventory
modes.

The full `npm ci`, ESLint run, and Vite production build must still be run on
the deployment Mac.
