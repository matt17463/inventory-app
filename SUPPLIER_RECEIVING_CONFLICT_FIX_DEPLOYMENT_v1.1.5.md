# Supplier Receiving Conflict Fix v1.1.5

This update fixes the supplier receiving error:

> there is no unique or exclusion constraint matching the ON CONFLICT specification

## Cause

`sc_integration_jobs.idempotency_key` is protected by a partial unique index. PostgreSQL correctly prevents duplicate non-null request keys, but PostgREST cannot infer that partial index from an API request using `onConflict: 'idempotency_key'`.

## Repair

The Netlify function now:

1. Looks for an existing integration job with the request key.
2. Reuses it when found.
3. Inserts a job when none exists.
4. If a simultaneous request wins the insert, recognizes PostgreSQL error `23505`, reads the winning row, and continues safely.

The database index remains unchanged and continues protecting duplicate jobs. No new SQL or environment variables are required.

## Update an existing open supplier-receiving pull request

Download `inventory-app-supplier-receiving-fixes-v1.1.5.zip` into the Mac Downloads folder, then run:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-fixes-v1.1.5.zip"

test -d "$REPO_DIR/.git" || {
  echo "STOP: Git repository was not found at $REPO_DIR"
  return 1 2>/dev/null || exit 1
}

test -f "$PATCH_ZIP" || {
  echo "STOP: v1.1.5 ZIP was not found at $PATCH_ZIP"
  return 1 2>/dev/null || exit 1
}

cd "$REPO_DIR"
git branch --show-current

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run test:supplier-receiving
npm run check

git add -A
git commit -m "Fix supplier receiving integration job conflict v1.1.5"
git push
```

The existing pull request and Netlify preview update automatically.

## If the prior pull request was already merged

Use a new branch:

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-supplier-receiving-fixes-v1.1.5.zip"
BRANCH="feature/supplier-receiving-conflict-fix-v1.1.5"

cd "$REPO_DIR"

test -z "$(git status --porcelain)" || {
  echo "STOP: Uncommitted or untracked files were found. Nothing was overwritten."
  git status
  return 1 2>/dev/null || exit 1
}

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c "$BRANCH"
unzip -o "$PATCH_ZIP" -d "$REPO_DIR"

npm ci
npm run check

git add -A
git commit -m "Fix supplier receiving integration job conflict v1.1.5"
git push -u origin "$BRANCH"
```

Open the pull request:

<https://github.com/matt17463/inventory-app/compare/main...feature/supplier-receiving-conflict-fix-v1.1.5?expand=1>

## Verification

After Netlify publishes the update:

1. Return to **Add Item to Bin**.
2. Upload the supplier confirmation again.
3. Review the parsed lines and receive one selected line.
4. Confirm the inventory receipt completes.
5. Confirm refreshing or retrying does not create a duplicate receipt or integration job.

If a different `ON CONFLICT` error remains, copy the corresponding Netlify function log. The v1.1.5 function no longer uses `ON CONFLICT` for integration-job idempotency, so a remaining error will identify one of the older supplier table constraints specifically.
