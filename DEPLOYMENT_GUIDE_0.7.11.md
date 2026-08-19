# Deploy Mockup Studio 0.7.11

Version 0.7.11 fixes `POST products (23: The operation was aborted due to timeout)` by creating or recovering the WooCommerce draft before importing mockup images in small batches. It is cumulative and includes the version 0.7.10 large-variation background export. Do not run SQL and do not change Netlify environment variables.

## 1. Check WooCommerce before retrying

Open **WooCommerce > Products** and search for the product name.

- If a draft exists, leave it in place. Version 0.7.11 can recover it by Mockup Studio project metadata.
- If several duplicate drafts exist, leave them temporarily. Verify which draft version 0.7.11 updates, then delete the unused duplicates afterward.
- Do not publish the product yet.

## 2. Install the update

Download `mockup-studio-v0.7.11-woocommerce-image-timeout-fix.zip` into the Mac Downloads folder. Paste this entire block into Terminal:

```bash
PATCH_ZIP="$HOME/Downloads/mockup-studio-v0.7.11-woocommerce-image-timeout-fix.zip"
REPO_DIR="$HOME/inventory-app"

test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; exit 1; }
test -d "$REPO_DIR/.git" || { echo "STOP: Git repository not found at $REPO_DIR"; exit 1; }

cd "$REPO_DIR"
git switch feature/mockup-studio-v0.7.0
git status
git pull --ff-only origin feature/mockup-studio-v0.7.0

ditto -x -k "$PATCH_ZIP" "$REPO_DIR"
npm install
npm run check
node -p "require('./package.json').version"
```

The last command must print `0.7.11`. Existing lint warnings are acceptable; `npm run check` must finish without errors.

## 3. Commit and push

```bash
cd "$HOME/inventory-app"
git add -A
git commit -m "Fix WooCommerce product image timeout v0.7.11"
git push origin feature/mockup-studio-v0.7.0
```

Open the pull request:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-studio-v0.7.0?expand=1

Merge after the checks pass, then wait for the Netlify production deploy to show **Published**.

## 4. Verify deployment

1. Open the newest production deploy in Netlify.
2. Confirm the deployed version or commit contains `0.7.11`.
3. Open **Functions** and confirm `mockup-publish-woocommerce-background` is present.
4. Refresh the inventory application using `Command + Shift + R`.

## 5. Resume the product

1. Open the same Mockup Studio project.
2. Open **9. WooCommerce**.
3. If **Existing Woo product ID** already contains the correct draft ID, leave it unchanged.
4. If it is blank but you know the draft ID, enter it. The ID is the number after `post=` in the WooCommerce product-edit address.
5. Keep the product status set to **Draft**.
6. Click the WooCommerce create/update button once.

Expected progress is:

1. Product draft created or recovered.
2. Mockup images added in batches.
3. Variations created in batches.
4. Export completed.

Do not click the export button again while progress is changing.

## 6. Confirm WooCommerce

After completion:

1. Open the updated draft in WooCommerce.
2. Confirm its main image and gallery are present.
3. Open **Product data > Variations**.
4. Confirm the total matches the included Color × Size × Logo combinations.
5. Spot-check the first, middle, and last sizes for the correct image, price, color, size, and logo.

## Troubleshooting query

Run this in Supabase to inspect the newest export:

```sql
select
  id,
  created_at,
  status,
  woo_product_id,
  response_payload,
  error_message
from public.mockup_woo_exports
order by created_at desc
limit 5;
```

During a healthy export, `response_payload.stage` moves through `product_ready`, `images`, and `variations`, followed by `status = completed`.
