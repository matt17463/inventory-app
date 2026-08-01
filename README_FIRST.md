# Skilled Crafting Inventory App 0.6.27 Deployment

No Supabase SQL migration is required for this release.

## Build and validate

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.27
npm ci
npm run check
```

The check must end with:

```text
PASS: Required production bundle features are present.
```

## Preview deployment

```bash
rm -rf dist
npx netlify build --context production
npx netlify deploy --dir=dist --functions=netlify/functions
```

Verify Inventory Overview searches:

1. A complete or partial blank SKU.
2. A linked WooCommerce SKU without enabling another option.
3. A word that occurs only in a product name.
4. A word that occurs only in a product description.
5. Brand, style, color, size, barcode, and supplier keywords.
6. A finished-product SKU, name, or description in Finished Products mode.

## Production deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
