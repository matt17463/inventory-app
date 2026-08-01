# Skilled Crafting Inventory App 0.6.22 Deployment

This release replaces the earlier color-focused presets with six graphically
distinct interface styles. No SQL is required.

## Install and validate

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.22
npm ci
npm run check
```

The build must finish with:

```text
PASS: Required production bundle features are present.
```

## Build using the working Netlify environment

```bash
rm -rf dist
npx netlify build --context production
```

## Create a preview deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

## Preview checklist

Open **Tools & Admin → Visual Themes & Interface Styles** and test:

- Technical Blueprint
- Futuristic Interface
- Cyberpunk Neon
- Formal Executive
- Professional Enterprise
- Industrial Command

For each style, confirm:

1. Buttons, cards, headings, navigation, tables, controls, and backgrounds
   visibly change—not only their colors.
2. Light, dark, and system modes work.
3. Compact, comfortable, and spacious density work.
4. The selection remains after refreshing.
5. Inventory, pull sheets, purchasing, purchase orders, and search still work.
6. Printed reports remain clean and white.

## Production deployment

After the preview passes:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```
