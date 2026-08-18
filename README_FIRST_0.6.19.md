# Skilled Crafting Inventory App 0.6.19 Deployment

This release reconciles the Purchasing Report with Create Purchase Order and
What Am I Waiting On. No SQL is required.

## Install and validate

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.19
npm ci
npm run check
```

The build must end with:

```text
PASS: Required production bundle features are present.
```

## Build with the working Netlify environment

```bash
rm -rf dist
npx netlify build --context production
```

## Test deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

Check the new preview:

1. Open Purchasing Report → Recommended Orders.
2. Note an item and its recommended quantity.
3. Open Create Purchase Order.
4. Confirm the same item appears.
5. Confirm the screen shows Report Need, On Open PO, and Still To Order.
6. Items with no open PO coverage should be selectable.
7. Items fully covered by an open PO should remain visible but show
   Covered by Open PO and should not be selectable.
8. Open What Am I Waiting On and confirm Pending Stock shortages appear.
9. Open a PO receiving screen and confirm Pending Stock is not offered as a
   destination bin.

## Production deployment

After the preview passes:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
