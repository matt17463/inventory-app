# Skilled Crafting Inventory App v0.8.6
## Mockup Studio Cloudflare R2 migration and deployment guide

This patch moves new Mockup Studio images out of Supabase Storage and into a private Cloudflare R2 bucket. Supabase remains the database and authentication provider.

The patch is dual-provider:

- Existing Supabase images continue to work.
- New blanks, artwork, exact composites, and AI outputs use R2.
- Each active project has a resumable **Move This Project to R2** button.
- Existing local archives remain compatible.
- Customer review, production packets, deletion, AI generation, and WooCommerce export can read either provider.
- Small WebP previews are created for new images.
- Image URLs are requested only for the active workflow phase.
- Preview images use lazy browser loading.
- Artwork Requests, Reorders, and Vault files are copied into private R2 when selected for a Mockup Studio project.
- The original external URL is retained as provenance, but Mockup Studio uses the durable R2 copy afterward.

Do not remove the existing Supabase environment variables or Storage buckets. Other parts of the inventory application still use Supabase.

# Files included

- Application source updates
- `deployment/sql/24_MOCKUP_R2_STORAGE.sql`
- `deployment/sql/25_VERIFY_MOCKUP_R2_STORAGE.sql`
- `deployment/R2_CORS.json`
- `supabase/migrations/202608210200_mockup_r2_storage.sql`
- Netlify R2 storage functions
- Resumable Supabase-to-R2 project migration
- Updated local archive support
- Updated tests and dependencies
- One-time Artwork Requests/Reorders/Vault-to-R2 import with redirect and file-size protection

# Important migration behavior

Moving an existing file from Supabase to R2 requires one final download from Supabase. That download counts as Supabase egress. The application then:

1. Uploads the original to R2.
2. Verifies the R2 object size.
3. Creates and verifies a WebP preview when supported.
4. Updates the Supabase database record to point to R2.
5. Deletes the old Supabase Storage copy.
6. Saves each completed file before processing the next batch.

If the operation stops, run it again. Completed files will not be copied again.

Do not migrate a project that is locally archived. Restore it first, then migrate it if it needs to remain active online.

# Phase 1 — Create the Cloudflare R2 bucket

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Select **R2 Object Storage**.
3. Select **Create bucket**.
4. Use this bucket name:

```text
skilled-crafting-mockups
```

5. Choose **Standard** storage.
6. Leave the location automatic unless Cloudflare requires another selection.
7. Create the bucket.

Use one private bucket. Do not enable public access.

# Phase 2 — Configure R2 CORS

In Cloudflare:

1. Open **R2 Object Storage**.
2. Open `skilled-crafting-mockups`.
3. Open **Settings**.
4. Find **CORS Policy**.
5. Select **Add CORS policy** or **Edit**.
6. Paste the following JSON:

```json
[
  {
    "AllowedOrigins": [
      "https://inventory.skilledcrafting.com",
      "http://localhost:5173"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT"
    ],
    "AllowedHeaders": [
      "Content-Type"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

7. Save the policy.

For testing through a Netlify Deploy Preview, add that preview's exact origin as another `AllowedOrigins` entry, for example:

```text
https://deploy-preview-12--YOUR-NETLIFY-SITE.netlify.app
```

Do not add a trailing slash to an origin.

The same JSON is included at `deployment/R2_CORS.json`.

# Phase 3 — Create the R2 API credentials

1. Return to **R2 Object Storage**.
2. Select **Manage R2 API Tokens**.
3. Select **Create API token**.
4. Name it:

```text
Skilled Crafting Mockup Studio
```

5. Grant **Object Read & Write** permission.
6. Restrict it to the `skilled-crafting-mockups` bucket.
7. Create the token.
8. Copy and temporarily save:

   - Access Key ID
   - Secret Access Key

The Secret Access Key is normally displayed only once. Do not paste either credential into GitHub, Supabase SQL, a browser variable, or a variable beginning with `VITE_`.

Also copy the Cloudflare **Account ID** from the R2 overview or Cloudflare account page.

# Phase 4 — Add the Netlify environment variables

## Recommended dashboard method

Open Netlify:

1. Select the inventory application site.
2. Open **Project configuration**.
3. Open **Environment variables**.
4. Add the following variables.
5. Give them the **Functions** scope.
6. Apply them to Production, Deploy Previews, and Branch Deploys.

| Variable | Value |
|---|---|
| `MOCKUP_STORAGE_PROVIDER` | `r2` |
| `R2_ACCOUNT_ID` | Your Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `R2_BUCKET_NAME` | `skilled-crafting-mockups` |
| `MOCKUP_PREVIEW_MAX_PIXELS` | `800` |
| `MOCKUP_PREVIEW_QUALITY` | `78` |

Mark `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as secret values.

## Optional terminal method

These commands avoid printing the R2 values, although the values may still be passed to the Netlify CLI process. Run them from the repository after the Netlify site has been linked.

```bash
cd "$HOME/inventory-app"

npx netlify-cli status
```

If the site is not linked:

```bash
cd "$HOME/inventory-app"
npx netlify-cli link
```

Set the non-secret settings:

```bash
cd "$HOME/inventory-app"

npx netlify-cli env:set MOCKUP_STORAGE_PROVIDER r2 --scope functions --context production deploy-preview branch-deploy
npx netlify-cli env:set R2_BUCKET_NAME skilled-crafting-mockups --scope functions --context production deploy-preview branch-deploy
npx netlify-cli env:set MOCKUP_PREVIEW_MAX_PIXELS 800 --scope functions --context production deploy-preview branch-deploy
npx netlify-cli env:set MOCKUP_PREVIEW_QUALITY 78 --scope functions --context production deploy-preview branch-deploy
```

Prompt for the credentials without displaying them:

```bash
cd "$HOME/inventory-app"

read -s "SC_R2_ACCOUNT_ID?Paste the Cloudflare Account ID, then press Return: "
echo
read -s "SC_R2_ACCESS_KEY?Paste the R2 Access Key ID, then press Return: "
echo
read -s "SC_R2_SECRET_KEY?Paste the R2 Secret Access Key, then press Return: "
echo

npx netlify-cli env:set R2_ACCOUNT_ID "$SC_R2_ACCOUNT_ID" --scope functions --context production deploy-preview branch-deploy --secret
npx netlify-cli env:set R2_ACCESS_KEY_ID "$SC_R2_ACCESS_KEY" --scope functions --context production deploy-preview branch-deploy --secret
npx netlify-cli env:set R2_SECRET_ACCESS_KEY "$SC_R2_SECRET_KEY" --scope functions --context production deploy-preview branch-deploy --secret

unset SC_R2_ACCOUNT_ID
unset SC_R2_ACCESS_KEY
unset SC_R2_SECRET_KEY
```

Confirm that the variable names exist:

```bash
cd "$HOME/inventory-app"
npx netlify-cli env:list --scope functions --context production
```

Environment-variable changes take effect only after a new Netlify build and deployment.

# Phase 5 — Download and install the application patch

Download `mockup-r2-artwork-v0.8.6-patch.zip` into the Mac Downloads folder.

Run this complete block:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/mockup-r2-artwork-v0.8.6-patch.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; exit 1; }

cd "$REPO_DIR"

git status --short
test -z "$(git status --porcelain)" || { echo "STOP: Your repository has uncommitted changes. Do not overwrite them."; exit 1; }

CURRENT_VERSION="$(node -p "require('./package.json').version")"
test "$CURRENT_VERSION" = "0.8.4" || { echo "STOP: Expected version 0.8.4 but found $CURRENT_VERSION"; exit 1; }

git fetch origin
git switch -c feature/mockup-r2-artwork-v0.8.6

PATCH_TEMP="$(mktemp -d)"
unzip -q "$PATCH_ZIP" -d "$PATCH_TEMP"
test -f "$PATCH_TEMP/files/package.json" || { echo "STOP: Patch contents are incomplete."; exit 1; }

rsync -av "$PATCH_TEMP/files/" "$REPO_DIR/"

node -p "require('./package.json').version"
npm ci
npm run check
```

Expected version:

```text
0.8.6
```

Expected final validation:

```text
PASS: Required production bundle features are present.
```

Existing lint warnings may still be displayed. The validation must exit successfully with no lint errors or failed tests.

# Phase 6 — Run the Supabase SQL migration

Copy the SQL migration to the Mac clipboard:

```bash
cd "$HOME/inventory-app"
pbcopy < deployment/sql/24_MOCKUP_R2_STORAGE.sql
```

Then:

1. Open Supabase.
2. Select the inventory project.
3. Open **SQL Editor**.
4. Select **New query**.
5. Press **Command-V**.
6. Select **Run**.

The SQL is safe to run more than once.

Run the verification SQL:

```bash
cd "$HOME/inventory-app"
pbcopy < deployment/sql/25_VERIFY_MOCKUP_R2_STORAGE.sql
```

Paste it into a new Supabase SQL Editor query and run it.

Expected result: every schema check says `PASS`. The second result lists each project and its current storage provider.

# Phase 7 — Commit and push the branch

```bash
cd "$HOME/inventory-app"

git status
git add -A
git commit -m "Move Mockup Studio and selected artwork to Cloudflare R2 v0.8.6"
git push -u origin feature/mockup-r2-artwork-v0.8.6
```

Open the pull request:

[Create the v0.8.6 GitHub pull request](https://github.com/matt17463/inventory-app/compare/main...feature/mockup-r2-artwork-v0.8.6?expand=1)

Use this title:

```text
Move Mockup Studio and selected artwork to Cloudflare R2 v0.8.6
```

Do not merge until the Deploy Preview passes the tests below.

# Phase 8 — Test the Netlify Deploy Preview

## Confirm R2 is connected

1. Open the Netlify Deploy Preview.
2. Sign in.
3. Open **Artwork → Mockup Studio**.
4. Open an active project.
5. Find **Cloud image storage**.
6. Confirm it says:

```text
R2 configuration: Ready
```

If it does not say Ready, inspect the Netlify function log for `mockup-storage` and confirm all seven environment variables are applied to Deploy Previews.

## Test a new upload

1. Create a small test project.
2. Upload one blank image.
3. Upload one logo.
4. Confirm both previews appear.
5. Open Cloudflare R2.
6. Open the `skilled-crafting-mockups` bucket.
7. Confirm objects exist beneath a user/project folder and beneath `previews/`.

Run this read-only SQL in Supabase:

```sql
select
  p.project_name,
  b.asset_name,
  b.storage_provider,
  b.storage_bucket,
  b.storage_path,
  b.preview_storage_provider,
  b.preview_storage_path,
  b.file_size_bytes,
  b.preview_size_bytes
from public.mockup_blank_assets b
join public.mockup_projects p on p.id = b.project_id
order by b.created_at desc
limit 10;
```

Expected: the test upload has `storage_provider = 'r2'`.

## Test an Artwork Requests/Reorders/Vault import

1. Confirm `SC_MOCKUP_ALLOWED_ASSET_HOSTS` contains every exact WordPress or CDN hostname used by approved artwork URLs. The hostname from `WOO_SITE_URL` is included automatically.
2. Open the test project's **Artwork** phase.
3. Choose a record under **Existing artwork request, reorder, or vault file**.
4. Select **Import Artwork to R2**.
5. Confirm the artwork preview appears.
6. Open the R2 bucket and confirm an original exists under the project's `artwork/imported/` folder and a WebP object exists under `previews/`.
7. Run the following read-only SQL and confirm the new row uses R2 while preserving its source URL:

```sql
select
  artwork_name,
  storage_provider,
  storage_path,
  preview_storage_path,
  source_url,
  metadata ->> 'external_imported_at' as external_imported_at
from public.mockup_artwork_assets
order by created_at desc
limit 10;
```

## Test the workflow

For the small test project:

1. Create an exact mockup.
2. Confirm the output appears.
3. Select it for the store.
4. Create a customer review link and open it.
5. Confirm the customer preview appears.
6. Create a WooCommerce **Draft**.
7. Confirm the image reaches WooCommerce.
8. Delete the WooCommerce test draft when finished.
9. Delete the Mockup Studio test project.
10. Confirm its R2 objects are removed.

# Phase 9 — Migrate existing active projects

Migrate one small project first:

1. Open an active Mockup Studio project.
2. Find **Cloud image storage**.
3. Review the number under **Supabase files remaining**.
4. Select **Move This Project to R2**.
5. Leave the page open while it processes.
6. Confirm the remaining count reaches zero.
7. Refresh the project.
8. Verify its images, placements, selected outputs, review link, and WooCommerce mappings.

The migration processes six files per call and saves each successful file. If it stops, press **Move This Project to R2** again.

Migrate other active projects one at a time. Every migrated Supabase file produces one final Supabase download, so the current billing cycle will show some additional egress. After migration, normal Mockup Studio image traffic goes to R2 instead.

Locally archived projects do not need migration unless you restore them for additional work.

# Phase 10 — Merge and production verification

After the Deploy Preview succeeds:

1. Merge the pull request into `main`.
2. Wait for the production Netlify deployment.
3. Confirm production deployed version `0.8.6`.
4. Repeat the small upload test on `https://inventory.skilledcrafting.com`.
5. Confirm the R2 bucket receives the production upload.
6. Confirm the Supabase egress graph stops increasing from normal Mockup Studio image viewing.

Supabase egress already recorded in the current billing cycle will not decrease retroactively.

# Rollback and safety

The SQL migration is additive and should not be rolled back.

If new R2 uploads must be temporarily stopped, keep v0.8.6 deployed and change:

```text
MOCKUP_STORAGE_PROVIDER=supabase
```

Then redeploy Netlify. Existing R2 images will remain readable because v0.8.6 supports both providers.

Do not roll the application code back to v0.8.4 after creating or migrating R2 assets. v0.8.4 does not know how to read R2 objects.

Never:

- Make the R2 bucket public.
- Commit R2 credentials to GitHub.
- Prefix R2 secrets with `VITE_`.
- Delete Supabase Storage buckets used by other application features.
- Delete the local archive before its checksum verification succeeds.
- Re-run local archives merely to test them; each archive downloads all current cloud files.
