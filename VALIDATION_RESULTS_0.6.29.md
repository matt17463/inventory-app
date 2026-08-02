# Validation Results — v0.6.29

| Check | Result |
|---|---|
| Netlify JavaScript ESM validation | Passed — 12 files |
| Static application contracts | Passed — 18 tests |
| Security helper tests | Passed — 3 tests |
| Pull-sheet row-dialog regression contract | Passed |
| ESLint | Passed — 0 errors, 39 pre-existing warnings |
| Vite production build | Passed — 171 modules transformed |
| Production bundle feature verification | Passed |
| Package version | 0.6.29 |
| Supabase migration required | No |

The new regression contract verifies that:

- non-inventory settings are keyed to the selected pull-sheet line;
- blank-pairing override is keyed to the selected pull-sheet line;
- PullSheetView contains no page-level modal backdrop or modal card;
- bin receiving history is rendered beneath its selected row;
- bin history is no longer a page-bottom dialog.

The production build emitted the existing large-chunk advisory. This is a performance warning, not a failed build.

