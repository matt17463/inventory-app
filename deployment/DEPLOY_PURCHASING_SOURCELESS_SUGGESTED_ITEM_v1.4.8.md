# Skilled Crafting Inventory App v1.4.8
## Purchasing Source-less Suggested Item Repair — Deployment Guide

This release extends the v1.4.7 Purchasing pairing workflow so Recommended Orders and other Purchasing rows can be corrected even when they are **not tied to an existing pull-sheet source**.

The new **Fix Suggested Item** workflow can move safe source-less reservation demand, move the low-stock threshold, and remember a Purchasing-only replacement preference. It does not move physical inventory.

This patch also reconciles the repository copies of v1.4.7 SQL 58/59 to the corrected versions that successfully ran in Supabase. You do **not** rerun SQL 58/59 during this v1.4.8 deployment.

---

## 1. Confirm the current repository is clean

Open Terminal and run:

```bash
cd "$HOME/inventory-app" || exit 1

echo "BRANCH: $(git branch --show-current)"
echo "VERSION: $(node -p "require('./package.json').version")"
echo
git status --short
```

Expected before continuing:

```text
BRANCH: main
VERSION: 1.4.7
```

`git status --short` should return no output.

If there are uncommitted changes, stop. Do not use `git reset --hard` or `git clean`.

Then update `main` and create the feature branch:

```bash
cd "$HOME/inventory-app" || exit 1

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/purchasing-sourceless-repair-v1.4.8
```

---

## 2. Apply the v1.4.8 patch safely

Assuming the downloaded ZIP is in Downloads:

```bash
cd "$HOME/inventory-app" || exit 1

PACKAGE="$HOME/Downloads/inventory-app-purchasing-sourceless-repair-v1.4.8.zip"

test -f "$PACKAGE" || {
  echo "STOP: Package not found at $PACKAGE"
  exit 1
}

PATCH_TMP="$(mktemp -d)"
unzip -q "$PACKAGE" -d "$PATCH_TMP"
PATCH_FILE="$PATCH_TMP/purchasing-sourceless-repair-v1.4.8.patch"

test -f "$PATCH_FILE" || {
  echo "STOP: Patch file was not found inside the ZIP."
  exit 1
}

git apply --check "$PATCH_FILE" || {
  echo
  echo "STOP: The v1.4.8 patch does not match your current v1.4.7 source tree."
  echo "Nothing was changed. Send the git apply output rather than forcing the patch."
  exit 1
}

git apply "$PATCH_FILE"

npm version 1.4.8 --no-git-tag-version --allow-same-version

echo
echo "PATCHED FILES:"
git status --short
```

Do not continue if `git apply --check` fails.

---

## 3. Run the targeted v1.4.8 regression test

```bash
cd "$HOME/inventory-app" || exit 1
node scripts/tests/purchasing-sourceless-suggested-item.test.mjs
```

Expected:

```text
17/17 checks passed.
```

Do not continue if any targeted check fails.

---

## 4. Run the full application validation

```bash
cd "$HOME/inventory-app" || exit 1
npm ci
npm run check
```

Continue only if the complete check/build gate passes.

---

## 5. Install SQL 60 in Supabase

Copy SQL 60:

```bash
cd "$HOME/inventory-app" || exit 1
pbcopy < deployment/sql/60_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql
echo "SQL 60 copied to clipboard."
```

Then in **Supabase → SQL Editor**:

1. Create a new query.
2. Paste SQL 60.
3. Click **Run**.

SQL 60 is safe to rerun. It adds the source-less repair tables/RPCs but does not alter the v1.4.7 demand-source view, so it does not rename or replace any existing Purchasing report columns.

If SQL 60 reports a missing prerequisite, stop and send the exact error. Do not remove the preflight checks.

---

## 6. Run SQL 61 verification

Copy SQL 61:

```bash
cd "$HOME/inventory-app" || exit 1
pbcopy < deployment/sql/61_VERIFY_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql
echo "SQL 61 copied to clipboard."
```

Run it in a new Supabase SQL Editor query.

Every verification row in the first result set should show:

```text
PASS
```

The second and third result sets are optional samples of saved replacement rules and repair audit rows. They may be empty before the first repair.

---

## 7. Final Git validation

```bash
cd "$HOME/inventory-app" || exit 1

git diff --check
```

No output means the unstaged diff check passed.

Stage the exact v1.4.8 files:

```bash
git add \
  package.json \
  package-lock.json \
  src/Purchasing.jsx \
  src/lib/purchasingPairingApi.js \
  src/purchasingPairing.css \
  scripts/tests/purchasing-sourceless-suggested-item.test.mjs \
  PATCH_MANIFEST_v1.4.8.txt \
  deployment/DEPLOY_PURCHASING_SOURCELESS_SUGGESTED_ITEM_v1.4.8.md \
  deployment/RELEASE_NOTES_v1.4.8.md \
  deployment/sql/58_PURCHASING_INLINE_PAIRING_REPAIR.sql \
  deployment/sql/59_VERIFY_PURCHASING_INLINE_PAIRING_REPAIR.sql \
  deployment/sql/60_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql \
  deployment/sql/61_VERIFY_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql

git status --short
git diff --cached --check
```

`git diff --cached --check` should return no output.

---

## 8. Commit and push

```bash
git commit -m "Add source-less Purchasing suggestion repair v1.4.8"
git push -u origin feature/purchasing-sourceless-repair-v1.4.8
```

Open the pull request:

```text
https://github.com/matt17463/inventory-app/compare/main...feature/purchasing-sourceless-repair-v1.4.8?expand=1
```

Suggested PR title:

```text
Add source-less Purchasing suggestion repair v1.4.8
```

Merge only after GitHub/Netlify preview checks pass.

---

## 9. Update local main after merge

```bash
cd "$HOME/inventory-app" || exit 1
git switch main
git pull --ff-only origin main
git status --short
node -p "require('./package.json').version"
git log -1 --oneline
```

Expected version:

```text
1.4.8
```

---

## 10. Verify Netlify production

In Netlify, confirm the newest Production deploy:

- branch: `main`
- status: **Published**
- created after the v1.4.8 merge

Then hard refresh the inventory app with **Command + Shift + R**.

---

## 11. Functional smoke test — threshold-only recommendation

Use a Recommended Orders row with:

- `Reserved = 0`
- no source details
- `Threshold > 0`

For example, a row like the Sport Grey / YM example that existed only because of its low-stock threshold.

1. Open **Purchasing → Recommended Orders**.
2. Click **Fix Suggested Item**.
3. Confirm the dialog identifies the current suggested blank and threshold.
4. Search for and select the correct replacement blank.
5. Leave **Move the low-stock threshold to the replacement blank** checked.
6. Leave **Remember this as a Purchasing replacement rule** checked if desired.
7. Save.
8. Confirm Purchasing refreshes automatically.
9. Confirm the old blank no longer carries that threshold recommendation.
10. Confirm the replacement blank uses the higher of its old threshold or the moved threshold.

No physical inventory should move.

---

## 12. Functional smoke test — reserved but no source details

Use a row showing `Reserved > 0` and **No source details**.

1. Click **Fix Suggested Item**.
2. Review **Source-less Reservation Check**.
3. If the dialog reports one or more **unlinked active reservations**, leave **Move active reservations that are not tied to an existing pull sheet** checked.
4. Choose the correct replacement blank.
5. Save.
6. Confirm the old row's reserved quantity decreases and the replacement blank's reserved quantity increases appropriately.

If the dialog reports `0` unlinked reservations but warns about inactive/closed linked work, do not force a move. Those records are intentionally left unchanged for safety and should be diagnosed as stale reservation/workflow data separately.

---

## 13. Confirm existing v1.4.7 Fix Pairing still works

Use a normal Purchasing source card that displays a Pull Sheet and **Fix Pairing**.

Confirm:

- the existing line-level button is still present;
- it opens the existing pull-sheet pairing repair dialog;
- saving still corrects the current line/reservation;
- reusable Woo variation/SKU/product mappings still work as before.

v1.4.8 does not replace that workflow.

---

## 14. Optional database audit checks

Latest source-less repairs:

```sql
select *
from public.sc_purchasing_row_repair_log
order by id desc
limit 25;
```

Active Purchasing replacement preferences:

```sql
select
  r.id,
  s.sku_base as source_sku,
  t.sku_base as replacement_sku,
  r.reason,
  r.created_at
from public.sc_purchasing_blank_replacement_rules r
join public.blank_products s on s.id = r.source_blank_product_id
join public.blank_products t on t.id = r.replacement_blank_product_id
where r.active
order by r.id desc;
```

To deactivate a bad Purchasing replacement preference without touching inventory:

```sql
update public.sc_purchasing_blank_replacement_rules
set active = false,
    updated_at = now()
where id = YOUR_RULE_ID;
```

Do not delete inventory or reservation records to undo a saved preference.

---

## Rollback scope

The application patch can be reverted through Git if needed. SQL 60 is additive; leaving its tables/functions installed does not alter Purchasing by itself. The repair RPC only changes data when an operator explicitly confirms **Fix Suggested Item**.
