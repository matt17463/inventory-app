# v0.6.29 GitHub and Netlify Deployment Guide

Version 0.6.29 is a focused correction for the remaining page-bottom pull-sheet dialogs. No Supabase SQL migration is required.

## Apply to the current GitHub repository

Use a fresh clone of `git@github.com:matt17463/inventory-app.git`, confirm the starting version is 0.6.28, and overlay the focused patch.

```bash
rsync -av --exclude='.DS_Store' \
  inventory-app-dialog-placement-patch-v0.6.29/ \
  inventory-app/

cd inventory-app
npm ci
npm run check

git add -A
git diff --cached --check
git commit -m "Release v0.6.29 row-local pull-sheet dialogs"
git push origin main
```

Verify the local and GitHub commit hashes match before deploying.

## Netlify

Build and deploy from the same verified Git worktree:

```bash
npx netlify build --context production

npx netlify deploy \
  --dir=dist \
  --functions=netlify/functions
```

After preview acceptance:

```bash
npx netlify deploy \
  --dir=dist \
  --functions=netlify/functions \
  --prod
```

## Required acceptance checks

1. Open a pull sheet containing many lines.
2. Select **Override Blank Pairing** on a line near the top or middle.
3. Confirm the search panel opens immediately inside that line card.
4. Cancel it, then select **Mark Non-Inventory** or **Edit Non-Inventory Settings**.
5. Confirm the non-inventory editor opens in the same line card.
6. Open a bin with multiple products and select **View history**.
7. Confirm receiving history appears directly beneath that product.
8. Confirm no single-record editing form appears after the end of the page.

