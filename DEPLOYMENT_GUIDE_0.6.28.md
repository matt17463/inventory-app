# v0.6.28 GitHub and Netlify Deployment Guide

No Supabase SQL migration is required for v0.6.28.

## Recommended: apply the focused patch to the current GitHub worktree

These commands assume your current repository is already v0.6.27 and that the patch ZIP is in Downloads.

```bash
cd /path/to/your/inventory-app

git status -sb
git remote get-url origin
npm pkg get version

unzip -o "$HOME/Downloads/inventory-app-usability-workflow-patch-v0.6.28.zip" -d .

npm ci
npm run check

git status -sb
git add package.json package-lock.json src scripts README_FIRST.md \
  RELEASE_NOTES_0.6.28.md \
  USABILITY_WORKFLOW_REVIEW_0.6.28.md \
  DEPLOYMENT_GUIDE_0.6.28.md

git commit -m "Release v0.6.28 workflow proximity improvements"
git push origin main
```

Confirm GitHub shows version `0.6.28` in `package.json` on the `main` branch and that the newest commit matches:

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

The two hashes should match.

## Netlify

If Netlify is linked to the GitHub repository, pushing `main` should start the production build automatically. Confirm the Netlify deploy lists the same Git commit hash.

For a preview or manual deploy from the verified worktree:

```bash
npm ci
npm run check

rm -rf dist
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

## Required preview checks

- Existing manual invoice order edits under its selected row.
- Single blank-product edit opens under its selected row.
- Blank-product bulk editor appears after the table.
- Pricing, non-inventory, and costing editors remain with their selected rows.
- Pull-sheet bulk due-date control appears after the table.
- Pull sheet 165 remains complete with correct backpack inventory.
- Pull sheet 170 shows only the active lines.
- Inventory Overview keyword search finds SKU, name, and description matches.

Do not promote the preview if any single-item editor opens at the end of an unrelated page or if `npm run check` fails.

