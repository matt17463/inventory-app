# Deploy Mockup Studio Reliability Repair v1.0.9

This guide assumes the repository is at `$HOME/inventory-app`, the repair ZIP is in Downloads, GitHub is `matt17463/inventory-app`, and Netlify deploys `main` automatically.

The migration is additive and does not delete Mockup Studio projects, images, WooCommerce products, or variations.

## 1. Confirm the current WooCommerce fix

The WooCommerce REST endpoint is now healthy after the SiteGround cache flush. Keep `/wp-json/wc/v3/*` excluded from page caching, CDN transformations, and security tools that replace JSON responses. A normal authenticated request may return data; an unauthenticated request should return WooCommerce JSON with HTTP 401, not an HTML page.

No Netlify environment variables need to be added for v1.0.9. Do not paste secrets into source files or GitHub.

## 2. Prepare a clean Git branch and apply the ZIP

Copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-mockup-studio-reliability-v1.0.9.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Repair ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"

if test -n "$(git status --porcelain)"; then
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status --short
  return 1 2>/dev/null || exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main

if git show-ref --verify --quiet refs/heads/feature/mockup-studio-reliability-v1.0.9; then
  git switch feature/mockup-studio-reliability-v1.0.9
else
  git switch -c feature/mockup-studio-reliability-v1.0.9
fi

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

node -p "require('./package.json').version"
git status --short
```

The version command must print `1.0.9`.

If the command stops because of an untracked guide from an earlier update, preserve it with this recoverable command, then repeat the block above:

```bash
cd "$HOME/inventory-app"
git stash push --include-untracked -m "Before Mockup Studio v1.0.9"
```

## 3. Install and validate locally

```bash
cd "$HOME/inventory-app"
npm ci
npm run check
```

Do not continue unless `npm run check` finishes successfully.

## 4. Run the required Supabase migration

1. Open Supabase.
2. Select the inventory project.
3. Open **SQL Editor** and create a new query.
4. Open `deployment/sql/34_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql` from the updated repository.
5. Copy the entire file into the SQL Editor and click **Run** once.
6. Create another new query.
7. Copy and run `deployment/sql/35_VERIFY_MOCKUP_STUDIO_RELIABILITY_SECURITY.sql`.

Expected verification results:

| check_name | expected result |
|---|---:|
| active_employee_function | true |
| internal_review_function | true |
| customer_review_function | true |
| production_ready_function | true |
| cleanup_queue | true |
| legacy_open_policy_count | 0 |
| active_employee_policy_count | 12 |

If any result differs, stop before deploying and retain the exact Supabase error.

## 5. Commit and push

```bash
cd "$HOME/inventory-app"

git add -A
git commit -m "Repair Mockup Studio reliability and WooCommerce export v1.0.9"
git push -u origin feature/mockup-studio-reliability-v1.0.9
```

Open this pull-request page:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-studio-reliability-v1.0.9?expand=1

Use the title:

`Repair Mockup Studio reliability and WooCommerce export v1.0.9`

Wait for GitHub and Netlify preview checks to pass, then merge the pull request into `main`.

## 6. Verify the production deployment

1. Open the Netlify project for `inventory.skilledcrafting.com`.
2. Open **Deploys**.
3. Confirm the newest **Production: main** deploy is published and matches the merge commit.
4. Open `https://inventory.skilledcrafting.com/mockup-studio` in a private/incognito browser window.
5. Hard-refresh once if the prior JavaScript bundle is cached.

No environment-variable import is required for this release. Existing values must remain configured for Functions and Production:

- `SUPABASE_URL` — base URL only, such as `https://PROJECT.supabase.co` (do not append `/rest/v1/`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `WOO_SITE_URL=https://skilledcrafting.com`
- `WC_CONSUMER_KEY`
- `WC_CONSUMER_SECRET`
- existing R2 variables
- `OPENAI_API_KEY` for AI Assist

## 7. Production smoke test

Use a new disposable Mockup Studio project:

1. Upload one small blank photo and one transparent PNG logo.
2. Create a placement with a physical print width.
3. Run **Exact Clean**. It should queue, finish in the background, and display a preview.
4. Run **AI Assist** only if desired; it uses paid OpenAI image generation.
5. On Approval, click **Approve & Select**. Selection and approval should both be visible.
6. Change a caption font, size, color, background, alignment, or padding. WooCommerce export should require regeneration before using those stale pixels.
7. In WooCommerce, click **Retry WooCommerce Connection**. It should report a successful verified connection.
8. Export a draft with two or three deliberately selected variations.
9. In WooCommerce, verify the draft, exact variation count, variation images, main image, gallery, price, attributes, shipping data, tags, and categories.
10. Re-run the export. It must update the same draft without duplicating variations.
11. Confirm unrelated pre-existing gallery images are preserved when updating an existing product.
12. Delete an unwanted mockup, then use **Retry Deferred File Cleanup** in the Storage section.
13. Open the production packet and use **Validate & Mark Production Ready**. The database should reject incomplete or unapproved work.
14. Delete the disposable WooCommerce draft after testing.

## 8. What to collect if a problem remains

Do not repeatedly click an action. Record:

- the visible error message;
- Netlify function name, timestamp, request ID, and full error;
- the project ID and WooCommerce draft product ID;
- browser Network status and response body;
- the output of the read-only SQL verification file.

The new error messages intentionally include the failing REST resource and response diagnostics while omitting WooCommerce credentials.

## 9. Rollback

The SQL migration is backward-compatible with the previous application release, so an urgent rollback normally requires reverting only the GitHub pull request and allowing Netlify to redeploy `main`. Do not delete the new cleanup table or restore the former open RLS policies as a routine rollback.
