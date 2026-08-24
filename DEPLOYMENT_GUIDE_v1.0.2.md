# Skilled Crafting Inventory v1.0.2 — UUID Resolve Case Fix

This cumulative patch replaces v1.0.1. It fixes the Resolve Case workflow for the production schema, where `blank_products.id` is UUID rather than bigint.

## What the failed SQL changed

Nothing should have been committed. Migration 30 runs inside `begin`/`commit`, so the foreign-key error rolled the transaction back. Do not rerun the v1.0.1 SQL or deploy the v1.0.1 ZIP.

The corrected migration also detects an empty, wrong-type `sc_canonical_blank_product_id` column from any partial manual attempt and converts it safely to UUID. If that wrong-type column unexpectedly contains values, the migration stops instead of guessing.

## Phase 1 — Confirm prerequisites

In Supabase SQL Editor, run:

```sql
select
  to_regprocedure('public.sc_identity_norm_v1(text)') is not null as migration_27_ready,
  (select data_type from information_schema.columns
    where table_schema = 'public'
      and table_name = 'blank_products'
      and column_name = 'id') as blank_product_id_type;
```

Expected:

- `migration_27_ready` = `true`
- `blank_product_id_type` = `uuid`

Stop if either result differs.

## Phase 2 — Back up Supabase

Create a current database backup before installing the migration or resolving the first duplicate case.

## Phase 3 — Install the corrected SQL

1. Open Supabase → SQL Editor → New query.
2. Paste the complete corrected `deployment/sql/30_RESOLVE_PRODUCT_REVIEW_CASES.sql` from the v1.0.2 package.
3. Click Run once.
4. Open another new query.
5. Paste `deployment/sql/31_VERIFY_RESOLVE_PRODUCT_REVIEW_CASES.sql`.
6. Click Run.
7. Confirm every `installed` result is `true`, including:
   - UUID canonical product link
   - UUID guarded blank update
   - legacy bigint guarded update removed
8. Confirm `invalid_archive_links` is `0`.

Run SQL before deploying the application source because the updated searches use `sc_is_archived`.

## Phase 4 — Apply the source patch on the existing PR branch

Download `inventory-app-v1.0.2-resolve-case-uuid-fix-patch.zip` into Downloads, then copy and paste this complete block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-v1.0.2-resolve-case-uuid-fix-patch.zip"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Repository not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: Patch ZIP not found at $PATCH_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"
git switch feature/operations-integrity-v1.0.0
git pull --ff-only

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add -A
git commit -m "Fix UUID Resolve Case workflow v1.0.2"
git push
```

This updates the existing pull request. Do not create another PR:

https://github.com/matt17463/inventory-app/pull/25

## Phase 5 — Validate and merge

1. Wait for GitHub validation and the Netlify deploy preview to become green.
2. Open the deploy preview and confirm the footer/application version is `1.0.2` if the version is displayed.
3. Open Operations Integrity → Duplicate Workbench.
4. Preview a genuine duplicate case but do not apply it yet.
5. Confirm UUID product IDs appear and the dependency counts load.
6. Merge PR #25 only after checks and preview pass.
7. Confirm production Netlify deploys the merged `main` commit.

No new Netlify environment variables are required.

## Phase 6 — First controlled resolution

1. Use a low-risk, verified duplicate pair.
2. Select the correct survivor.
3. Preview the resolution.
4. Compare product details, inventory ledger totals, and every reference count.
5. Enter the exact confirmation phrase and apply.
6. Confirm the duplicate is archived, references now point to the survivor, and inventory movement quantities are unchanged.
7. Verify bin totals, pull sheets, reservations, receiving mappings, mockups, and WooCommerce-linked records.

## Troubleshooting

- If SQL reports `bigint and uuid are incompatible`, an old v1.0.1 SQL file was used. Run the v1.0.2 file.
- If verification says the UUID guarded update is false, migration 30 did not complete; do not deploy the source yet.
- If migration 30 says the wrong-type canonical column contains data, stop. Do not delete or cast those values manually.
- If `npm run check` fails, do not commit or push. Copy the first actual error shown above the final summary.

## Rollback guidance

Source changes can be reverted through Git. Migration 30 is additive and should normally remain installed. Never reverse a completed resolution by editing inventory quantities. Use the backup plus `sc_product_resolution_runs` and `sc_core_mutation_audit` for a controlled repair.
