# Skilled Crafting Inventory App v1.4.7
## Purchasing Report Inline Pairing Repair — Deployment Guide

This release adds **Fix Pairing** directly to Purchasing demand sources. It corrects the current pull-sheet pairing/reservation and can save a durable WooCommerce variation/SKU/product mapping for future orders.

## Files installed by the patch

- `src/Purchasing.jsx` — adds inline Fix Pairing workflow.
- `src/lib/purchasingPairingApi.js` — blank search + correction RPC client.
- `src/purchasingPairing.css` — modal/mobile styling.
- `deployment/sql/58_PURCHASING_INLINE_PAIRING_REPAIR.sql` — purchasing source metadata + atomic correction RPC.
- `deployment/sql/59_VERIFY_PURCHASING_INLINE_PAIRING_REPAIR.sql` — read-only verification.
- `scripts/tests/purchasing-pairing-inline.test.mjs` — static regression contract.
- `deployment/RELEASE_NOTES_v1.4.7.md`
- `PATCH_MANIFEST_v1.4.7.txt`

No WordPress/WooCommerce plugin change is required. No Netlify environment variables are added.

---

# 1. Start from a clean current `main`

Open Terminal and paste:

```bash
cd "$HOME/inventory-app" || exit 1

echo "BRANCH: $(git branch --show-current)"
echo "VERSION: $(node -p "require('./package.json').version")"
echo
git status --short

if [ -n "$(git status --porcelain)" ]; then
  echo
  echo "STOP: Your repository has uncommitted changes. Do not apply this patch yet."
  exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/purchasing-inline-pairing-v1.4.7
```

If any command errors, stop and resolve that error before continuing.

---

# 2. Apply the downloaded patch safely

Assuming the ZIP downloaded to your normal Downloads folder:

```bash
cd "$HOME/inventory-app" || exit 1

PACKAGE="$HOME/Downloads/inventory-app-purchasing-inline-pairing-v1.4.7.zip"

test -f "$PACKAGE" || {
  echo "STOP: Patch ZIP not found at: $PACKAGE"
  exit 1
}

PATCH_TMP="$(mktemp -d)"
unzip -q "$PACKAGE" -d "$PATCH_TMP"
PATCH_FILE="$PATCH_TMP/purchasing-inline-pairing-v1.4.7.patch"

test -f "$PATCH_FILE" || {
  echo "STOP: purchasing-inline-pairing-v1.4.7.patch was not found inside the ZIP."
  exit 1
}

git apply --check "$PATCH_FILE" || {
  echo
  echo "STOP: The patch does not match your current source tree. Nothing was changed."
  echo "Send me the output above rather than forcing the patch."
  exit 1
}

git apply "$PATCH_FILE"

npm version 1.4.7 --no-git-tag-version --allow-same-version

echo
echo "PATCHED FILES:"
git status --short
```

`git apply --check` is intentional. It prevents the v1.4.7 Purchasing replacement from overwriting a newer or materially different `Purchasing.jsx`.

---

# 3. Run the targeted regression contract

```bash
cd "$HOME/inventory-app" || exit 1
node scripts/tests/purchasing-pairing-inline.test.mjs
```

Expected result:

```text
13/13 checks passed.
```

Do not continue if any targeted check fails.

---

# 4. Run the full application validation

```bash
cd "$HOME/inventory-app" || exit 1
npm ci
npm run check
```

Continue only if the full check/build gate passes.

---

# 5. Install SQL 58 in Supabase

Copy the migration to the clipboard:

```bash
cd "$HOME/inventory-app" || exit 1

test -f deployment/sql/58_PURCHASING_INLINE_PAIRING_REPAIR.sql || {
  echo "STOP: SQL 58 is missing."
  exit 1
}

pbcopy < deployment/sql/58_PURCHASING_INLINE_PAIRING_REPAIR.sql
echo "SQL 58 copied to clipboard."
```

Then:

1. Open **Supabase → SQL Editor**.
2. Create a new query.
3. Paste.
4. Click **Run**.

SQL 58 performs prerequisite checks first. If it reports that either the pull-sheet override RPC or Product-to-Blank Mapping Lifecycle is missing, stop. Do not remove the prerequisite check.

The migration is safe to rerun. It does not create inventory quantities and does not rewrite inventory movement history.

---

# 6. Run SQL 59 verification

```bash
cd "$HOME/inventory-app" || exit 1

pbcopy < deployment/sql/59_VERIFY_PURCHASING_INLINE_PAIRING_REPAIR.sql
echo "SQL 59 verification copied to clipboard."
```

Paste into a new Supabase SQL Editor query and run it.

Every verification row should show:

```text
PASS
```

The second result set is a sample of current purchasing demand sources. It may legitimately return zero rows if no open jobs are currently driving purchasing demand.

---

# 7. Review, commit, and push

```bash
cd "$HOME/inventory-app" || exit 1

echo "UNSTAGED DIFF CHECK:"
git diff --check

git add -A

echo
echo "STAGED FILES:"
git status --short

echo
echo "STAGED DIFF CHECK:"
git diff --cached --check
```

If `git diff --cached --check` reports no errors, commit:

```bash
git commit -m "Add Purchasing inline blank pairing repair v1.4.7"
git push -u origin feature/purchasing-inline-pairing-v1.4.7
```

Open this pull request link:

```text
https://github.com/matt17463/inventory-app/compare/main...feature/purchasing-inline-pairing-v1.4.7?expand=1
```

Suggested PR title:

```text
Add Purchasing inline blank pairing repair v1.4.7
```

Merge only after GitHub/Netlify preview checks pass.

---

# 8. Verify the Netlify production deploy

After merging:

1. Open Netlify.
2. Confirm the newest **Production** deploy is from `main`.
3. Confirm it is **Published**.
4. Open the inventory application and hard refresh with **Command + Shift + R**.
5. If you use Deployment Health, confirm the application reports version `1.4.7`.

No Netlify environment-variable changes are required.

---

# 9. Functional smoke test

Use one known Purchasing row whose demand is caused by an incorrect blank pairing.

1. Open **Purchasing → Recommended Orders** or **Current Shortages**.
2. Expand **Orders / Pull Sheets** for the affected blank.
3. Confirm the source now shows both **Pull Sheet #...** and **Fix Pairing**.
4. Click **Fix Pairing**.
5. Confirm the modal shows the order, pull-sheet line, ordered SKU, current blank, and quantity.
6. Search for the correct blank by brand/style/color/size or SKU.
7. Select the correct blank.
8. For a real WooCommerce line, leave **Remember this pairing for future orders** checked.
9. Enter a reason and click **Save Pairing Correction**.
10. Confirm the Purchasing Report refreshes automatically.
11. Confirm the incorrect shortage/recommendation disappears or moves to the corrected blank as appropriate.
12. Open the linked pull sheet and confirm the line now points to the corrected blank.

For placeholder lines such as:

```text
MANUAL-21-LINE-1141
```

no reusable SKU rule should be offered/saved unless a real WooCommerce variation/product identifier was captured. The current pull-sheet line can still be corrected.

---

# 10. Optional database audit after the smoke test

To confirm a durable future rule was created:

```sql
select
  source_kind,
  source_key,
  blank_product_id,
  mapping_source,
  notes,
  created_at,
  is_active
from public.sc_product_blank_mappings
where mapping_source = 'purchasing_report'
order by created_at desc
limit 25;
```

To confirm the current line correction was logged by the existing Pull Sheet override system:

```sql
select *
from public.job_item_blank_override_log
limit 25;
```

This avoids assuming a timestamp-column name on older versions of the override log.

---

# Behavior summary

```text
Purchasing row shows wrong blank demand
        ↓
Orders / Pull Sheets → Fix Pairing
        ↓
choose correct active blank
        ↓
existing Pull Sheet override logic
        ↓
current job item + reservation corrected
        ↓
optional durable Woo variation/SKU/product mapping saved
        ↓
Purchasing reloads
        ↓
wrong purchasing demand is removed/reassigned
```
