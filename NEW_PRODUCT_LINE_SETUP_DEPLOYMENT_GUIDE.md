# New Product Line Setup v1.3.0

This release adds an admin/manager workflow for defining an entire blank product line before creating or syncing finished WooCommerce products.

## What it does

- Creates every selected Color × Size blank definition in one guarded operation.
- Starts every newly created blank at **zero on hand**; it creates no receiving or inventory-movement records.
- Reuses one exact active blank instead of creating a duplicate.
- Blocks the entire operation when it finds multiple active matches, an archived match, or a conflicting generated SKU.
- Links already-synced WooCommerce `products` rows with the exact Brand + Style + Color + Size identity.
- Uses the existing mapping lifecycle to remember Woo variation/SKU mappings and repair eligible unpaired pull-sheet lines.
- Saves an audit history of each setup.

## Phase 1 — Apply the application files

Download `inventory-app-new-product-line-setup-v1.3.0.zip` into Downloads. Then paste this block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-new-product-line-setup-v1.3.0.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch ZIP not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
git status --short
```

If `git status --short` prints files you did not intend to commit, stop and preserve those changes first. If it is clean, paste:

```bash
cd "$HOME/inventory-app"
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/new-product-line-setup-v1.3.0
unzip -o "$HOME/Downloads/inventory-app-new-product-line-setup-v1.3.0.zip" -d "$HOME/inventory-app"
npm ci
npm run check
git add -A
git commit -m "Add New Product Line Setup v1.3.0"
git push -u origin feature/new-product-line-setup-v1.3.0
```

Open the pull request:

https://github.com/matt17463/inventory-app/compare/main...feature/new-product-line-setup-v1.3.0?expand=1

Do not merge until the preview build succeeds and Phase 2 is complete.

## Phase 2 — Install the Supabase SQL

In Supabase, open **SQL Editor → New query**. Open this file from the patch and paste its complete contents into the editor:

```text
deployment/sql/46_NEW_PRODUCT_LINE_SETUP.sql
```

Click **Run** once. The migration is additive and safe to rerun. It requires the application's existing migrations 28, 40, and 44. If Supabase reports a missing prerequisite, run the named existing migration first, then rerun 46.

Next, open and run:

```text
deployment/sql/47_VERIFY_NEW_PRODUCT_LINE_SETUP.sql
```

Expected results:

- Every row in the first result has `passed = true`.
- `anon_preview_blocked = true`.
- `browser_apply_blocked = true`.
- `server_apply_ready = true`.

The final count result may contain zeros before the wizard is used; that is normal.

## Phase 3 — Merge and deploy

1. Confirm the GitHub checks and Netlify deploy preview are green.
2. Merge the pull request into `main`.
3. In Netlify, confirm the production deploy for `main` succeeds.
4. No new Netlify environment variables are required.
5. Hard-refresh the application and confirm `package.json` version 1.3.0 was deployed.

## Phase 4 — Verify with a small product line

1. Open **Inventory → New Product Line Setup**.
2. Enter `Gildan 6400 setup test`.
3. Select Brand `Gildan` and Style `6400`.
4. Select Color `Red` and only one or two sizes for the first test.
5. Enter the real unit cost, or enter `0.00` and leave **Mark these blanks for cost review** checked.
6. Click **Preview product line**.
7. Confirm each row says either `create` or `existing`. Do not proceed if any row is blocked.
8. Check the confirmation box and click **Create and link product line**.
9. Confirm the result explicitly says no inventory movement was created.
10. Run **Tools & Admin → WooCommerce Sync**.
11. Open **Tools & Admin → Product-to-Blank Mappings**, run the backfill/review, and confirm the Woo variations are mapped.
12. Reopen the affected pull sheet and confirm eligible unpaired lines now show the correct blank.

## Normal workflow for future product lines

1. Create or confirm Brand, Style, active Colors, and Sizes in the application.
2. Run **New Product Line Setup** for the complete blank matrix.
3. Create the variable finished product in WooCommerce or Mockup Studio using the exact same attributes.
4. Run WooCommerce Sync.
5. Review Product-to-Blank Mappings before accepting customer orders.
6. Receive physical blanks through Add Item to Bin or supplier confirmation import when stock arrives.

WooCommerce finished products do not create blank inventory definitions automatically. This deliberate separation prevents a decorated product, typo, or near-match from silently creating duplicate physical inventory.

## Handling a blocked preview

| Status | Meaning | Resolution |
| --- | --- | --- |
| `ambiguous_active` | More than one active blank has the same full identity | Resolve duplicates in Product Integrity Center |
| `archived_match` | The combination already exists as an archived blank | Restore it or use Product-to-Blank Mappings to establish a replacement |
| `sku_conflict` | The generated SKU belongs to a different product identity | Correct the lookup codes or existing blank SKU |
| `existing` | One exact active blank exists | Safe; it will be reused |
| `create` | No matching definition exists | Safe; a zero-on-hand blank will be created |

## Recovery

If the application deploy fails, do not merge the pull request. If it was already merged, revert the merge commit in GitHub and let Netlify redeploy. The SQL is additive; do not drop its tables or columns after real setup records have been created. A failed Apply operation is transactional and rolls back the whole product-line creation.

## Validation completed before packaging

- 49 Netlify JavaScript functions passed ESM validation.
- All existing application tests passed.
- New Product Line Setup safety tests passed.
- ESLint passed.
- Vite production build and required-feature verification passed.
