# Color Cleanup Background Hotfix v0.8.13

This hotfix fixes `Color cleanup failed (HTTP 504)` by moving WooCommerce color scanning and deletion out of the browser's synchronous request. The page now starts a Netlify Background Function, saves progress in Supabase, and polls a fast status endpoint.

No colors are removed by the scan. Cleanup still requires selecting eligible rows, confirming the browser prompt, and typing `ARCHIVE UNUSED COLORS`. Immediately before deletion, the background job reloads WooCommerce colors and blocks any term whose product count is no longer zero.

## What changes

- WooCommerce Color scans run as a Netlify Background Function.
- Scan results are saved in Supabase and can be refreshed without querying WooCommerce again.
- Supabase usage counts are calculated in one grouped database query.
- WooCommerce terms are rechecked once and deleted in batches of 50.
- Active inventory colors, colors used by WooCommerce, and canonical pairing colors remain protected.
- No new Netlify environment variables are required.

## Phase 1 — Run the Supabase SQL

1. Open Supabase.
2. Select the inventory project.
3. Open **SQL Editor** and choose **New query**.
4. Paste the complete contents of `deployment/sql/27_COLOR_LIFECYCLE_BACKGROUND_JOBS.sql`.
5. Select **Run**.
6. Confirm the result shows `true` for all three fields:
   - `background_jobs_ready`
   - `woo_snapshot_ready`
   - `usage_rpc_ready`

This migration is safe to run again if the browser or Supabase interrupts the first attempt.

## Phase 2 — Apply and test the patch on your Mac

Download `inventory-app-color-cleanup-background-v0.8.13.zip` into your Downloads folder. Then paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-color-cleanup-background-v0.8.13.zip"
BRANCH="feature/color-cleanup-background-v0.8.13"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c "$BRANCH"
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add \
  package.json \
  package-lock.json \
  netlify.toml \
  deployment/sql/27_COLOR_LIFECYCLE_BACKGROUND_JOBS.sql \
  netlify/functions/_shared/colorLifecycleData.js \
  netlify/functions/color-lifecycle-fast.js \
  netlify/functions/color-lifecycle-background.js \
  src/lib/colorLifecycleApi.js \
  src/ColorAliasReview.jsx \
  scripts/tests/supplier-confirmation-parser.test.mjs \
  DEPLOY_COLOR_CLEANUP_BACKGROUND_v0.8.13.md

git commit -m "Move WooCommerce color cleanup to background jobs v0.8.13"
git push -u origin "$BRANCH"
```

If Git reports that the branch already exists, replace the `git switch -c "$BRANCH"` line with:

```bash
git switch "$BRANCH"
```

## Phase 3 — Open and merge the pull request

Open:

<https://github.com/matt17463/inventory-app/compare/main...feature/color-cleanup-background-v0.8.13?expand=1>

Create the pull request, wait for checks to pass, merge it into `main`, and confirm Netlify deploys the new `main` commit successfully.

## Phase 4 — Verify the deployment

1. Open the application and sign in as an administrator.
2. Open **Color Pairings**.
3. Select **Unused Color Cleanup**.
4. Select **Scan WooCommerce Colors**.
5. The page should immediately say the scan started in the background; it should not return HTTP 504.
6. Leave the page open. It checks the saved job every three seconds.
7. When complete, confirm a last-scanned date appears and the table shows color usage.
8. Review eligible rows carefully. Used inventory colors, WooCommerce-used terms, and canonical pairing targets must not be selectable.
9. For a small test, select one clearly unused color and choose **Clean Up 1 Selected**.
10. Confirm the prompt and type `ARCHIVE UNUSED COLORS` exactly.
11. Verify the job completes and the color is no longer offered in active application color selectors.

## Troubleshooting

### The page says the background-job SQL is not installed

Run `deployment/sql/27_COLOR_LIFECYCLE_BACKGROUND_JOBS.sql` in Supabase, then reload the page.

### The job remains queued or running

In Netlify, open **Logs & metrics > Functions** and inspect `color-lifecycle-background`. Confirm the deployed `netlify.toml` contains:

```toml
[functions."color-lifecycle-background"]
  background = true
```

Netlify returns HTTP 202 when a Background Function is accepted; the actual result is stored in `sc_color_lifecycle_jobs`.

### Read-only job status query

Use this in Supabase SQL Editor:

```sql
select id, action, status, created_at, started_at, completed_at, error_message, result
from public.sc_color_lifecycle_jobs
order by created_at desc
limit 20;
```

### A cleanup stops because a color became used

That is a safety stop. Run **Scan WooCommerce Colors** again, review the refreshed list, and start a new cleanup only for rows still marked eligible.

