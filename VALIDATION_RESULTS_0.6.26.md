# Validation Results — 0.6.26

```text
TAP version 13
# Subtest: all navigation paths have active routes
ok 1 - all navigation paths have active routes
  ---
  duration_ms: 2.276082
  type: 'test'
  ...
# Subtest: employee routes use a real not-found page
ok 2 - employee routes use a real not-found page
  ---
  duration_ms: 0.325672
  type: 'test'
  ...
# Subtest: legacy create-product route is a safe redirect
ok 3 - legacy create-product route is a safe redirect
  ---
  duration_ms: 0.19569
  type: 'test'
  ...
# Subtest: public customer portal remains outside AuthGate
ok 4 - public customer portal remains outside AuthGate
  ---
  duration_ms: 0.203201
  type: 'test'
  ...
# Subtest: known stale deployable files are absent
ok 5 - known stale deployable files are absent
  ---
  duration_ms: 0.401645
  type: 'test'
  ...
# Subtest: fallback navigation does not contain removed bin-contents route
ok 6 - fallback navigation does not contain removed bin-contents route
  ---
  duration_ms: 0.262499
  type: 'test'
  ...
# Subtest: out-of-stock pull sheet lines use the Pending Stock bin safely
ok 7 - out-of-stock pull sheet lines use the Pending Stock bin safely
  ---
  duration_ms: 0.934295
  type: 'test'
  ...
# Subtest: purchasing report counts Pending Stock demand
ok 8 - purchasing report counts Pending Stock demand
  ---
  duration_ms: 2.459443
  type: 'test'
  ...
# Subtest: purchase order screens use the purchasing report source of truth
ok 9 - purchase order screens use the purchasing report source of truth
  ---
  duration_ms: 1.751715
  type: 'test'
  ...
# Subtest: physical Unassigned inventory clears stale Pending Stock demand
ok 10 - physical Unassigned inventory clears stale Pending Stock demand
  ---
  duration_ms: 2.054384
  type: 'test'
  ...
# Subtest: graphical interface themes are display-only and fully wired
ok 11 - graphical interface themes are display-only and fully wired
  ---
  duration_ms: 3.004982
  type: 'test'
  ...
# Subtest: non-inventory lines can be included in or excluded from purchasing
ok 12 - non-inventory lines can be included in or excluded from purchasing
  ---
  duration_ms: 2.369631
  type: 'test'
  ...
# Subtest: opening a pull sheet is database read-only
ok 13 - opening a pull sheet is database read-only
  ---
  duration_ms: 0.413502
  type: 'test'
  ...
# Subtest: pull sheets hide cancelled historical duplicate rows
ok 14 - pull sheets hide cancelled historical duplicate rows
  ---
  duration_ms: 0.498999
  type: 'test'
  ...
# Subtest: pull-sheet completion is idempotent and uses the safe RPC
ok 15 - pull-sheet completion is idempotent and uses the safe RPC
  ---
  duration_ms: 1.076355
  type: 'test'
  ...
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 110.670865
```

```text
PullSheetView.jsx parsed successfully.
```

Static validation confirms:

- The live pull-sheet page uses the safe completion API.
- The live page no longer directly calls `complete_job_item`.
- The migration creates a unique completion movement per job item.
- The pull sheet 165 repair does not insert another inventory movement.

The migration has not been executed against the live Supabase database.
Run `npm ci` and `npm run check` on the deployment Mac before publishing.
