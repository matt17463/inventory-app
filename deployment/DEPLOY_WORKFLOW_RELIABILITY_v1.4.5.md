# Skilled Crafting v1.4.5 — Deployment Guide

**Use v1.4.5 instead of v1.4.4/v1.4.3. Do not deploy those older bundles first.**

v1.4.5 includes all previously prepared workflow reliability changes and moves Artwork Request master file storage to the same private Cloudflare R2 architecture used by Mockup Studio.

## Components

1. `inventory-app-workflow-reliability-v1.4.5.zip`
2. `skilled-crafting-artwork-r2-storage-v1.1.0.zip`
3. `skilled-crafting-safe-batch-updates-v1.1.0.zip`
4. `skilled-crafting-size-upcharges-v1.0.0.zip`

Keep these existing WordPress plugins active:

- **Skilled Crafting Artwork System**
- **Skilled Crafting Artwork System – Inventory Auto Sync**

The R2 plugin is a companion, not a replacement for the main Artwork System.

---

## Phase 0 — Backups and prerequisites

1. SiteGround → create a backup named `Before Skilled Crafting v1.4.5`.
2. Confirm a current Supabase backup exists.
3. Confirm no one is uploading/replacing artwork or running a large Woo batch during deployment.
4. Confirm the private Cloudflare bucket used by Mockup Studio still exists and Mockup Studio reports R2 ready.
5. Confirm the current Artwork System **Inventory Webhook Secret** is configured. The same secret must exist in Netlify as `SC_ARTWORK_WEBHOOK_SECRET`, unless you intentionally configure a separate `SC_ARTWORK_R2_SECRET` in Netlify with the same WordPress value.
6. If SQL 54/55 was required for the earlier Mockup mapping timeout, keep that hotfix installed. v1.4.5 does not replace it.

### No new Supabase SQL

v1.4.5 requires **no new Supabase migration**.

The Artwork R2 companion creates its own two small WordPress metadata tables automatically.

### Existing Netlify R2 variables

v1.4.5 reuses the Mockup Studio variables already in Netlify:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `MOCKUP_STORAGE_PROVIDER=r2`

Do not put R2 credentials in WordPress, GitHub source, or `VITE_` variables.

---

## Phase 1 — Deploy Inventory App v1.4.5 FIRST

The WordPress R2 companion depends on the new Netlify function, so deploy the application before installing/activating the companion.

Put this file in Downloads:

`inventory-app-workflow-reliability-v1.4.5.zip`

Run:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-workflow-reliability-v1.4.5.zip"

cd "$REPO_DIR" || exit 1

test -d .git || {
  echo "STOP: $REPO_DIR is not a Git repository."
  exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: Patch ZIP not found at $PATCH_ZIP"
  exit 1
}

git status --short

test -z "$(git status --porcelain)" || {
  echo "STOP: Your working tree is not clean. Do not overwrite the files shown above."
  exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main

git switch -c feature/artwork-r2-workflow-v1.4.5

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

node -p "require('./package.json').version"

npm ci
npm run check
```

The version command must print:

```text
1.4.5
```

Do **not** commit/push if `npm run check` fails.

Then:

```bash
cd "$HOME/inventory-app" || exit 1

git status --short
git add -A
git commit -m "Move artwork requests to R2 and improve workflow reliability v1.4.5"
git push -u origin feature/artwork-r2-workflow-v1.4.5
```

Direct pull request link:

`https://github.com/matt17463/inventory-app/compare/main...feature/artwork-r2-workflow-v1.4.5?expand=1`

Merge only after GitHub checks pass. Then confirm Netlify **Production: main** is Published from the merge commit.

### Verify the new bridge before touching WordPress

In Netlify → Functions, confirm the deployed function list contains:

`artwork-r2-storage`

Do not install the R2 companion until the production deploy containing that function is Published.

---

## Phase 2 — Install Artwork R2 Storage & Review Reliability v1.1.0

Upload:

`skilled-crafting-artwork-r2-storage-v1.1.0.zip`

WordPress:

1. **Plugins → Add New Plugin → Upload Plugin**.
2. Upload the ZIP.
3. If WordPress says the prior Artwork Review Reliability companion already exists, choose **Replace current with uploaded**.
4. Activate/confirm **Skilled Crafting Artwork R2 Storage & Review Reliability v1.1.0**.
5. Keep the main **Skilled Crafting Artwork System** active.
6. Keep **Skilled Crafting Artwork System – Inventory Auto Sync** active.

Open:

**Artwork System → R2 Storage**

Expected:

- Netlify R2 bridge = **READY**
- R2 bucket = your existing private Mockup Studio bucket

If the bridge is NOT READY, stop before migrating files. The page will show the returned bridge/configuration error.

---

## Phase 3 — Migrate existing Artwork Request files

On **Artwork System → R2 Storage**, click:

**Migrate / Resume Next 25 Files**

The migration is deliberately resumable. Each file is processed as follows:

1. Resolve the WordPress Media attachment/local file.
2. Calculate SHA-256 and file size.
3. Ask Netlify only for a short-lived presigned R2 PUT URL.
4. WordPress uploads the file directly to R2; the file body does not pass through Netlify.
5. Netlify verifies R2 object size with HEAD.
6. WordPress records R2 bucket/key/hash/size.
7. The source file URL is changed to a durable WordPress proxy URL.
8. The original Media Library compatibility copy remains in place.

Repeat **Migrate / Resume Next 25 Files** until **Remaining / unresolved** reaches 0 or no longer decreases.

### If Failed is not zero

Review the Recent R2 file records. Typical safe interpretations:

- **No WordPress Media attachment could be resolved**: an old URL is not backed by a current Media Library attachment. Re-upload the file through the normal Artwork System workflow if it is still needed.
- **Local file unavailable**: the Media attachment exists but the original local file is missing/offloaded. Restore/re-upload it before retrying.
- **Unsupported artwork type**: v1.1.0 accepts PNG, JPG/JPEG, WebP, SVG and PDF.
- **Bridge error**: confirm Netlify production contains v1.4.5, the R2 variables are present, and the Artwork System secret matches Netlify.

Do not delete the old Media Library files manually.

---

## Phase 4 — Artwork Review acceptance test

Use a disposable request first.

### Existing affected request

1. Open **Artwork System → Requests**.
2. Open a request whose uploaded mockup previously did not display.
3. Confirm the staff mockup image now loads.
4. Confirm the desired mockup is marked **Show on customer review page**.
5. Generate/refresh the review link if necessary.
6. Open the review link in a private/incognito browser.
7. Confirm every customer-visible mockup displays.
8. Open one image in a new tab. The browser URL may briefly use `/wp-json/sc-artwork-r2/v1/file/...` and then redirect to a private Cloudflare R2 signed URL.

### New upload

1. Upload one disposable finished PNG/JPG/WebP under **Upload Mockup / Artwork**.
2. Allow the normal WordPress redirect to complete.
3. Return to **Artwork System → R2 Storage**.
4. Confirm a verified R2 record exists for the new mockup. If the current main-plugin action did not expose a request ID to the companion, run one migration pass; it will discover the new file.
5. Confirm the staff preview and customer review link both work.

### Approval integrity

1. On the customer review page, select one exact mockup.
2. Approve it.
3. Confirm one approval record is created and request status becomes approved.
4. Refresh the browser; a second approval must not be created.
5. Confirm the R2 companion has an approval snapshot for the selected R2 object/hash.
6. On another test request, submit Request Changes and confirm status/history update.

### DTF readiness compatibility

Run the existing DTF readiness check against an R2-migrated mockup. It must still work because v1.1.0 retains the Media Library compatibility copy.

---

## Phase 5 — Inventory handoff and Mockup Studio test

1. On an approved disposable request, use **Send to Inventory App** (or allow automatic approval handoff if enabled).
2. Confirm the Inventory App receives the request.
3. The handoff `mockups` data should retain a usable `file_url` and include R2 metadata where available:
   - `storage_provider = r2`
   - `storage_bucket`
   - `storage_path`
   - `sha256`
   - `file_size`
4. Open Mockup Studio → Artwork.
5. Select that Artwork Request mockup.
6. Click **Import Artwork to R2**.
7. Confirm it imports and displays normally in the Mockup Studio project.

The current import remains backward compatible by using the durable WordPress proxy URL. Because that proxy reads the R2 master, the source no longer depends on the old Media Library URL.

---

## Phase 6 — Install/replace the other v1.4.5 WordPress components

### Safe Batch Updates

Upload `skilled-crafting-safe-batch-updates-v1.1.0.zip`.

Required first test:

1. Select 2–3 draft/test products.
2. Change shipping class.
3. Run the verified batch.
4. Click **Verify completed job**.
5. Require zero mismatches before a large batch.

### Global Size Upcharges

Upload `skilled-crafting-size-upcharges-v1.0.0.zip`.

1. Configure size rules with the global toggle OFF.
2. Test one product.
3. Enable rules.
4. Clear storefront caches.
5. Verify variation price, cart and checkout.

---

## Phase 7 — Application smoke tests retained from v1.4.4

### On-site Sales

1. Enable Test Mode.
2. Run category → logo → type → brand → style → color → size.
3. Complete a test sale and print both label sizes as needed.
4. Confirm TEST watermark and no inventory deduction.
5. Check Phone, Tablet and Laptop layouts.
6. Turn Test Mode OFF before live selling.

### Mockup Studio

1. Delete a disposable saved placement.
2. Verify tags can be selected/deselected and **Clear all tags** works.
3. Verify all three size presets.
4. Update an existing Woo draft and confirm it is not duplicated.

### SiteGround Woo resilience

If SiteGround returns a 202/SG CAPTCHA response on a Woo GET, the application should retry bounded reads and emit timestamped diagnostics if it still fails.

---

## Phase 8 — Cache and production checks

1. Clear SiteGround Dynamic Cache once after WordPress plugin installation.
2. Open an Artwork review link in a private browser. Tokenized review pages send no-store/no-cache headers.
3. Confirm the WordPress site and Inventory App both use HTTPS.
4. Confirm Cloudflare R2 bucket remains private; do not enable public bucket access.

---

## Rollback

### Artwork R2 companion

Deactivate **Skilled Crafting Artwork R2 Storage & Review Reliability**.

Do **not** delete R2 objects or the companion metadata tables during an emergency rollback. The WordPress Media compatibility copies were intentionally retained, so the main Artwork System remains recoverable.

If migrated source rows contain R2 proxy URLs and you must run without the companion, restore the SiteGround backup created before v1.4.5 rather than manually editing hundreds of URLs.

### Inventory App

Revert the v1.4.5 pull request and allow Netlify to redeploy `main`.

### Other plugins

Deactivate Size Upcharges to stop dynamic upcharges. Safe Batch Updates deactivation does not undo product edits already verified/saved.
