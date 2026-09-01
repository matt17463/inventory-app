# Deploy Skilled Crafting Inventory v1.4.6 — Product Type Manager

v1.4.6 is cumulative over v1.4.5 and includes the On-site label preview/print fix.

## 1. Apply the app patch on a clean branch

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-product-type-manager-v1.4.6.zip"

cd "$REPO_DIR" || exit 1

test -d .git || { echo "STOP: Not a Git repository."; exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; exit 1; }

git status --short

test -z "$(git status --porcelain)" || {
  echo "STOP: Working tree is not clean. Commit or stash current work first."
  exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/product-type-manager-v1.4.6

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

node -p "require('./package.json').version"
npm ci
npm run check
```

Expected version: `1.4.6`.

Do not continue if `npm run check` fails.

## 2. Install SQL 56

```bash
cd "$HOME/inventory-app" || exit 1
pbcopy < deployment/sql/56_PRODUCT_TYPE_MANAGER.sql
```

In Supabase: SQL Editor → New query → paste → Run.

SQL 56 is additive. It creates the Brand + Style classification table, preserves existing classifications, and updates the On-site v2 search function to prefer Brand + Style mappings.

## 3. Verify SQL 57

```bash
cd "$HOME/inventory-app" || exit 1
pbcopy < deployment/sql/57_VERIFY_PRODUCT_TYPE_MANAGER.sql
```

Run it in a new Supabase SQL Editor query.

The first three checks must return `PASS`.

## 4. Commit and push

```bash
cd "$HOME/inventory-app" || exit 1

git add -A
git status --short
git commit -m "Add Product Type Manager v1.4.6"
git push -u origin feature/product-type-manager-v1.4.6
```

PR:
`https://github.com/matt17463/inventory-app/compare/main...feature/product-type-manager-v1.4.6?expand=1`

## 5. Smoke test after Netlify production deploy

1. Open **Tools & Admin → Product Type Manager**.
2. Default filter should show **Unclassified** Brand + Style rows.
3. Filter Brand to `Independent`.
4. Select the desired Independent styles.
5. Choose `Hoodie` (or another type).
6. Leave **Sync matching existing WooCommerce products** checked.
7. Click **Apply to selected**.
8. Confirm the success message shows Brand + Style assignments plus Woo matched/updated counts.
9. Open **On-site Sales** and confirm the selected style now appears under the assigned Type.
10. Optionally click **Scan Woo Matches** in Product Type Manager to verify the Woo parent product count.

### Creating a new type
Enter a name under **Create a new type** and click **Create Type**. The new type becomes available in the bulk assignment selector immediately.

### Woo matching rules
Woo products are synchronized only when Brand + Style can be matched explicitly using Mockup Studio metadata or Woo product Brand/Style attributes. The system does not guess from product names.
