# Color Lifecycle and Import Pairing v0.8.12

## What this update changes

The application now has one controlled color workflow:

1. Imports first try an exact match against active WooCommerce-synced colors.
2. Existing global and supplier-specific pairing rules are tried next.
3. If no clear result exists, the import stops and asks you to choose an existing color.
4. The selected pairing is saved and reused on later imports.
5. Colors and sizes are never created automatically by the supplier confirmation workflow.

The Color Pairings page now includes **Unused Color Cleanup**. It checks both Supabase and WooCommerce before offering a color for removal.

- A color used by `products` or `blank_products` is protected.
- A canonical target of an active pairing rule is protected.
- An unused source alias may be archived while its pairing rule is retained.
- A WooCommerce Color term is deleted only when WooCommerce reports zero product use.
- Archived colors disappear from normal product and receiving selectors.
- If a synced product later references an archived color, it is reactivated automatically.

No new Netlify environment variables are required. Existing `WOO_SITE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, and Supabase variables are used.

## Phase 1 — Run the SQL migration

1. Open Supabase.
2. Open **SQL Editor**.
3. Open `deployment/sql/26_COLOR_LIFECYCLE_AND_IMPORT_ALIASES.sql` from the patch ZIP.
4. Copy the entire file into Supabase SQL Editor.
5. Click **Run**.

The final result should show:

- `active_colors`
- `archived_colors`
- `import_aliases_ready = true`

The migration is additive and safe to run again.

## Phase 2 — Apply and push the application patch

Download the ZIP to your Mac's Downloads folder, then copy and paste this entire block into Terminal:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-color-lifecycle-v0.8.12.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"

if test -n "$(git status --porcelain)"; then
  echo "STOP: Uncommitted files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
fi

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/color-lifecycle-v0.8.12
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add -A
git commit -m "Add controlled color cleanup and remembered import pairings v0.8.12"
git push -u origin feature/color-lifecycle-v0.8.12
```

If Terminal stops because of an untracked guide file you want to keep, use this first:

```bash
cd "$HOME/inventory-app"
git stash push -u -m "Before color lifecycle v0.8.12"
```

Then repeat the Phase 2 block. Your saved files can later be viewed with `git stash list`.

## Phase 3 — Create and merge the pull request

Open:

https://github.com/matt17463/inventory-app/compare/main...feature/color-lifecycle-v0.8.12?expand=1

Create the pull request, wait for the checks to pass, merge into `main`, and wait until Netlify shows the production deployment as **Published**.

## Phase 4 — Verify production

```bash
cd "$HOME/inventory-app"
git fetch origin
git show origin/main:package.json | awk -F'"' '/"version"/ {print $4; exit}'
```

Expected result:

```text
0.8.12
```

Hard-refresh the application with **Command + Shift + R**.

## Phase 5 — Review and clean unused colors

1. Open **Tools & Admin → Color Pairings**.
2. Select **Unused Color Cleanup**.
3. Click **Refresh Preview**.
4. Review the Supabase and WooCommerce use counts.
5. Leave any color unchecked if you want to retain it despite being unused.
6. Click **Clean Up Selected**.
7. Type `ARCHIVE UNUSED COLORS` exactly.

The cleanup creates an audit log in `sc_color_cleanup_log`.

## Phase 6 — Test remembered pairing

1. Open **Add Items to Bin**.
2. Read a supplier confirmation containing a color that does not clearly match.
3. Choose an existing color from the Color selector.
4. Leave the **Remember** checkbox selected.
5. Receive one test line.
6. Read the confirmation again and verify it displays `remembered supplier color pairing`.

For a supplier ZIP import, the application will show **Pair Unrecognized Supplier Colors** before importing. Save each pairing, then click **Import Selected Files** again.

Automated supplier feeds stop before importing unresolved colors. Save the pairings through the manual Supplier Catalog Import screen and restart the feed.
