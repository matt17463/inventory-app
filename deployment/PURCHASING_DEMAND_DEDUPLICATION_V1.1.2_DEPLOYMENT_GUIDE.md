# Purchasing Demand Deduplication v1.1.2

This update fixes Current Shortages counting a pull-sheet line twice when the
line is assigned to Pending Stock and is also represented by an active
inventory reservation.

The Pullsheet 195 diagnostic established the exact failure:

- Manual invoice QB-1171, line 1104: quantity 3
- Pullsheet item 906: quantity 3
- Active reservation: quantity 3
- Database shortage: quantity 3
- Browser Pending Stock addition: quantity 3
- Incorrect displayed result: quantity 6

This update does not change any order quantities, pull-sheet rows,
reservations, inventory counts, or historical records.

## Files included

- `src/lib/purchasingDemandSources.js`
- `src/lib/inventoryApi.js`
- `scripts/tests/purchasing-demand-deduplication.test.mjs`
- `deployment/sql/38_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql`
- `deployment/sql/39_VERIFY_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql`
- `package.json`
- `package-lock.json`

## Step 1 — Put the patch in Downloads

Download this file to the Mac Downloads folder:

`inventory-app-purchasing-demand-deduplication-v1.1.2.zip`

## Step 2 — Apply the patch locally

Copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-purchasing-demand-deduplication-v1.1.2.zip"
BRANCH="feature/purchasing-demand-dedup-v1.1.2"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Git repository not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: Patch ZIP not found at $PATCH_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c "$BRANCH"

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

node -p "require('./package.json').version"
npm ci
npm run check
```

The version command must print `1.1.2`. The check must finish with no failing
tests, lint errors, or build errors.

Do not continue if either command fails.

## Step 3 — Install the Supabase migration

1. Open Supabase.
2. Select the Skilled Crafting project.
3. Open **SQL Editor**.
4. Open this local file in a text editor:

   `deployment/sql/38_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql`

5. Copy the complete contents into a new Supabase query.
6. Click **Run**.

The migration creates an additive compatibility view. It does not update or
delete operational data.

## Step 4 — Verify the SQL

Open and run:

`deployment/sql/39_VERIFY_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql`

The first result must show:

- `compatibility_view_installed = true`
- `authenticated_can_read = true`

For Pullsheet 195 / Gildan 18500 Purple YM, the next results should show:

- `demand_source_count = 1`
- `demand_total_quantity = 3`
- `job_item_id = 906`
- source `quantity = 3`
- `active_reservation_rows = 1`
- `active_reserved_quantity = 3`

## Step 5 — Commit and push

After the SQL verification succeeds, copy and paste:

```bash
cd "$HOME/inventory-app"

git add \
  package.json \
  package-lock.json \
  src/lib/inventoryApi.js \
  src/lib/purchasingDemandSources.js \
  scripts/tests/purchasing-demand-deduplication.test.mjs \
  deployment/sql/38_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql \
  deployment/sql/39_VERIFY_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql \
  deployment/PURCHASING_DEMAND_DEDUPLICATION_V1.1.2_DEPLOYMENT_GUIDE.md \
  deployment/PURCHASING_DEMAND_DEDUPLICATION_V1.1.2_MANIFEST.md

git commit -m "Fix Pending Stock purchasing double count v1.1.2"
git push -u origin feature/purchasing-demand-dedup-v1.1.2
```

## Step 6 — Open and merge the pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/purchasing-demand-dedup-v1.1.2?expand=1

Create the pull request, wait for the checks to pass, and merge it into
`main`.

## Step 7 — Confirm Netlify deployment

1. Open the production Netlify project.
2. Confirm the newest production deployment is from `main`.
3. Confirm the deployment status is **Published**.
4. Confirm the deployed commit is the merged v1.1.2 commit.

No new Netlify environment variables are required.

## Step 8 — Verify Current Shortages

1. Open `https://inventory.skilledcrafting.com`.
2. Hard refresh the page with **Command + Shift + R**.
3. Open **Purchasing**.
4. Open **Current Shortages**.
5. Search for `GILDAN-18500-PURPLE-YM`.

Before changing QB-1171, the expected shortage is **3**, not 6.

The other Purple Gildan 18500 lines should likewise stop doubling:

| Size | Saved quantity | Expected shortage with zero on hand |
| --- | ---: | ---: |
| YS | 2 | 2 |
| YM | 3 | 3 |
| YL | 2 | 2 |
| AS | 1 | 1 |
| AM | 2 | 2 |
| AXL | 1 | 1 |

## Step 9 — Correct QB-1171 only if YM should be 2

The diagnostic shows the saved manual invoice quantity is currently 3. If the
customer order should actually contain 2 YM hoodies:

1. Open **Manual Invoiced Orders**.
2. Open invoice **QB-1171**.
3. Change the Purple Gildan 18500 YM line from 3 to 2.
4. Save the order.
5. Click **Sync Pull Sheet**.
6. Open Pullsheet 195 and confirm the YM quantity is 2.
7. Return to Current Shortages and confirm YM is 2 when on-hand inventory is 0.

Do not manually edit only the reservation or only the pull-sheet row in SQL.
The manual invoice is the source record and must be synchronized through the
application.

## Rollback

If the application deployment must be rolled back, revert the pull request in
GitHub and let Netlify redeploy `main`.

The SQL view is additive and can safely remain installed. If it must be
removed, run:

```sql
drop view if exists public.sc_purchasing_demand_sources_v2;
```

Removing this view does not change orders, pull sheets, reservations, or
inventory.
