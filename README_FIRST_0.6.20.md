# Skilled Crafting Inventory App 0.6.20 Deployment

No SQL is required.

## Install and validate

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.20
npm ci
npm run check
```

The build must end with:

```text
PASS: Required production bundle features are present.
```

## Build with Netlify's production environment

```bash
rm -rf dist
npx netlify build --context production
```

## Preview deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

## Test the reported scenario

1. Open the affected pull sheet.
2. The line should automatically select the physical bin when only one stocked
   physical bin is available.
3. When more than one physical bin is available, choose the correct bin.
4. Confirm the line displays:
   `Source bin saved. Purchasing now uses this physical-bin assignment.`
5. Open Purchasing Report and refresh it.
6. Confirm the old Pending Stock reference is gone.
7. The item should disappear when on-hand inventory satisfies current demand
   and the low-stock threshold does not independently recommend another unit.
8. If it remains only under Recommended Orders, review its low-stock threshold;
   that recommendation is safety stock rather than an unresolved pull-sheet
   shortage.

## Production deployment

After the preview passes:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
