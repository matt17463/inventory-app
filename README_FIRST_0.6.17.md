# Skilled Crafting Inventory App 0.6.17 Deployment

This release changes out-of-stock pull-sheet handling. It requires no SQL.

## Required existing bin

Confirm the Bins page contains a bin whose code or label is:

```text
Unassigned
```

The match is case-insensitive.

## Install and validate

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.17
npm ci
npm run check
```

A successful build ends with:

```text
PASS: Required production bundle features are present.
```

## Preview deployment

Link this folder to the existing Netlify site if needed:

```bash
npx netlify link
npx netlify status
```

Build with the production Netlify environment:

```bash
rm -rf dist
npx netlify build --context production
```

Deploy the exact verified build:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

Test a manual order containing an out-of-stock paired blank:

1. Generate or sync its pull sheet.
2. Open the pull sheet.
3. Confirm the line shows **Out of Stock — Unassigned**.
4. Confirm the bin is already set to **Unassigned**.
5. Confirm the action reads **Awaiting Stock** and does not deduct inventory.
6. Receive the blank into a real bin.
7. Refresh the pull sheet and confirm the real source bin becomes available.

## Production deployment

After the preview works:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
