# Skilled Crafting Inventory v1.0.0 Deployment Guide

This release is a cumulative application upgrade based on v0.9.0. It adds the Operations Integrity workspace, guarded server-side product and pull-sheet mutations, saved supplier receiving drafts, identity memory, duplicate review cases, reconciliation, integration job monitoring, team-store workflow tracking, and a clean lint baseline.

The SQL is additive. It does not merge or delete products, change inventory quantities, rewrite inventory movements, or change the private Cloudflare R2 configuration.

## Before you start

Use this order:

1. Confirm your production employee role.
2. Run the two SQL files.
3. Apply the application package on a new Git branch.
4. Run the complete check.
5. Push and open the pull request.
6. Merge, wait for Netlify, then run the smoke test.

Do not deploy the v1.0 application code before confirming that your own account has an active `admin`, `manager`, or `operator` row in `sc_app_user_roles`. The new AuthGate verifies this role.

## Phase 1 — Confirm employee access

In Supabase, open **SQL Editor**, paste this query, and click **Run**:

```sql
select
  u.id,
  u.email,
  r.role,
  r.is_active
from auth.users u
left join public.sc_app_user_roles r on r.user_id = u.id
order by u.email;
```

Your account should show `admin`, `manager`, or `operator` and `is_active = true`.

If your account is missing, copy its UUID from the first column, replace `PASTE-YOUR-USER-UUID-HERE`, and run:

```sql
insert into public.sc_app_user_roles (user_id, role, is_active)
values ('PASTE-YOUR-USER-UUID-HERE'::uuid, 'admin', true)
on conflict (user_id) do update
set role = excluded.role,
    is_active = excluded.is_active;
```

## Phase 2 — Install the database changes

Run these files separately in Supabase SQL Editor, in this order:

1. `deployment/sql/28_APPLICATION_INTEGRITY_PLATFORM.sql`
2. `deployment/sql/29_VERIFY_APPLICATION_INTEGRITY_PLATFORM.sql`

If your database does not already have the v0.9 diagnostics, run `deployment/sql/27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql` before file 28.

The verification result should show `installed = true` for every object. The final creation preview is read-only and should return `create_allowed`; it does not create the verification product.

## Phase 3 — Check Netlify variables

No new Netlify variables are required. Confirm these existing server variables are present:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SC_ALLOWED_ORIGINS
```

`SC_ALLOWED_ORIGINS` must include the exact application origin:

```text
https://inventory.skilledcrafting.com
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and marked as a secret. Never create a `VITE_SUPABASE_SERVICE_ROLE_KEY` variable.

## Phase 4 — Apply the patch in Terminal

Download `inventory-app-v1.0.0-operations-integrity-patch.zip` to your Mac Downloads folder. Then paste this complete block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-v1.0.0-operations-integrity-patch.zip"
BRANCH="feature/operations-integrity-v1.0.0"

test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

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

git status
git add -A
git commit -m "Add Operations Integrity platform v1.0.0"
git push -u origin "$BRANCH"
```

The check must finish with tests, lint, and production build passing. Warnings from npm about its local proxy configuration are not application failures.

## Phase 5 — Open the pull request

Open this direct link:

[Create the v1.0.0 pull request](https://github.com/matt17463/inventory-app/compare/main...feature/operations-integrity-v1.0.0?expand=1)

Set the title to:

```text
Add Operations Integrity platform v1.0.0
```

Wait for GitHub and Netlify checks. Resolve any conflict by bringing current `main` into the feature branch; do not select “ours” or “theirs” for all files without reviewing them.

## Phase 6 — Merge and verify Netlify

After the pull request checks pass:

1. Click **Merge pull request**.
2. Open Netlify.
3. Confirm the production deploy is for `main` and includes the merge commit.
4. Confirm the deploy says **Published**.

This unauthenticated test should return HTTP 401. That proves the function exists and correctly rejects anonymous callers:

```bash
curl -i -X POST \
  -H 'Content-Type: application/json' \
  --data '{"action":"health"}' \
  'https://inventory.skilledcrafting.com/.netlify/functions/application-integrity'
```

Expected status:

```text
HTTP/2 401
```

## Phase 7 — Application smoke test

Sign in to the application and complete these checks:

1. The sign-out button shows your application role.
2. Open **Tools & Admin → Operations Integrity**.
3. Open **Product Identity** and search a known SKU. The existing blank should appear.
4. Run **Preview Product Creation** with that SKU. It should say `use existing`, not `create allowed`.
5. Open **Duplicate Workbench**. Select two test candidates only if they truly require review, choose a proposed survivor, and create a case. Confirm no product or inventory quantity changes.
6. Open **Add Item to Bin**, parse a supplier PDF, and return to **Operations Integrity → Receiving Inbox**. The parsed confirmation should appear in `review` status before receiving.
7. Use the receiving search, **Show review rows only**, and **Apply to Selected** controls.
8. Open **Reconciliation**. Negative quantities must appear as purchasing demand, not as an instruction to edit stock.
9. Open **Integration Jobs** and confirm current Mockup Studio/color/export jobs appear when their source tables contain rows.
10. Create a test Team Store workflow and move it through one stage.
11. Open an existing pull sheet, change one line status, refresh, and confirm the change is preserved and an audit row is added to `sc_core_mutation_audit`.

## Phase 8 — Read-only verification queries

Run in Supabase after the smoke test:

```sql
select action, entity_type, entity_id_text, reason, created_at
from public.sc_core_mutation_audit
order by created_at desc
limit 25;

select status, count(*)
from public.sc_product_review_cases
group by status
order by status;

select status, count(*)
from public.sc_supplier_receiving_imports
group by status
order by status;
```

## Rollback

If the application has a problem, revert the v1.0 merge commit in GitHub and let Netlify redeploy. The additive v1.0 database tables and functions can remain installed; older code does not use them.

Do not drop the v1.0 tables after employees have created identity rules, receiving jobs, duplicate cases, or team-store workflows unless you have exported those records and intentionally approved their deletion.

## Safety behavior to remember

- Duplicate candidates are reviewed, never silently merged.
- Removing a pull-sheet line now marks it cancelled so its history remains.
- Core blank-product and pull-sheet changes pass through an authenticated Netlify function and create audit records.
- Negative inventory remains purchasing demand. Do not manually set it to zero.
- Every received or transferred physical item still requires a bin.
- R2 remains private and all R2 credentials remain server-only.
