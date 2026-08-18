# Skilled Crafting Inventory App 0.6.24 Deployment

This is an emergency containment release for pull sheets that gain lines when
opened. No new schema migration is required.

## Before deployment

Do not repeatedly open pull sheet 170.

Run the separate read-only diagnostic:

```text
10_PULL_SHEET_170_GROWTH_DIAGNOSTIC_READ_ONLY.sql
```

Save every result grid before changing or deleting database records.

## Validate

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.24
npm ci
npm run check
```

The final bundle check must pass.

## Build and preview

```bash
rm -rf dist
npx netlify build --context production
npx netlify deploy --dir=dist --functions=netlify/functions
```

In the preview:

1. Record the number of rows in `job_items` for job 170 using the diagnostic.
2. Open pull sheet 170 once.
3. Run the diagnostic again.
4. Confirm the saved `job_items` count did not increase.
5. Confirm the screen displays one row per saved job-item ID.

## Production

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```

Existing duplicate rows must be reviewed separately. Do not delete them based
only on matching SKU, because a legitimate order can contain repeated products.
