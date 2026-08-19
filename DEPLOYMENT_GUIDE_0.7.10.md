# Deploy Mockup Studio 0.7.10

Version 0.7.10 is a cumulative source update. It includes all previous Mockup Studio fixes and the reliable background export update for products with 400 or more variations. Do not run SQL and do not change Netlify environment variables.

## 1. Install the patch

Download `mockup-studio-v0.7.10-large-variation-background-export.zip` into the Mac Downloads folder. Then paste this entire block into Terminal:

```bash
PATCH_ZIP="$HOME/Downloads/mockup-studio-v0.7.10-large-variation-background-export.zip"
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

The last command must print `0.7.10`. Existing lint warnings are acceptable; `npm run check` must finish without errors.

## 2. Commit and push

```bash
cd "$HOME/inventory-app"
git add -A
git commit -m "Fix large WooCommerce variation exports v0.7.10"
git push origin feature/mockup-studio-v0.7.0
```

Open the pull request:

https://github.com/matt17463/inventory-app/compare/main...feature/mockup-studio-v0.7.0?expand=1

Merge the pull request after its checks pass. Then wait for Netlify's production deployment to show **Published**.

## 3. Verify the deployed function

1. Open Netlify and select the inventory application site.
2. Open **Deploys**, then open the newest production deploy.
3. Confirm the deployed commit contains `0.7.10`.
4. Open **Functions**.
5. Confirm `mockup-publish-woocommerce-background` is listed.
6. Its invocation should receive an immediate `202` response and continue in the background.

## 4. Resume the existing WooCommerce draft

Do not delete the draft that was already created.

1. Open the same Mockup Studio project.
2. Go to **9. WooCommerce**.
3. Confirm **Existing Woo product ID** contains the ID of the draft that has no variations. If it is blank, copy the numeric product ID from the WooCommerce edit-page address and paste it there.
4. Leave product status set to **Draft**.
5. Confirm the selected colors, sizes, logos, variation mappings, price, and shipping values.
6. Click the button to create/update the WooCommerce product once.
7. Keep the page open to view progress. The product draft exists immediately; the variations will appear in batches while the background job continues.

For example, a 420-variation product normally requires nine write batches. Do not click the export button a second time while the first job shows progress.

## 5. Verify completion

1. Wait for the application to report that the export completed.
2. Open the draft in WooCommerce.
3. Open **Product data > Variations**.
4. Confirm the total number of variations matches the included Color × Size × Logo combinations.
5. Spot-check the first, middle, and last sizes and confirm their image, price, and attributes.

If the job is interrupted, click the update button one more time on the same project. Version 0.7.10 reuses the saved WooCommerce product ID and creates missing variations first; it does not intentionally create a duplicate parent product.

## Troubleshooting query

To inspect the newest export in Supabase, run:

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

During a healthy large export, `status` changes from `queued` to `processing`, and `response_payload` reports the number of variation operations processed. When finished, `status` is `completed`.
