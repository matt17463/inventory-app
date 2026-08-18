# Skilled Crafting Inventory App 0.6.21 Deployment

This release adds six visual themes and display preferences. **No SQL is
required.**

## Step 1 — Extract the complete build

Extract:

```text
inventory-app-main-complete-corrected-v0.6.21.zip
```

The extracted folder should be:

```text
inventory-app-main-complete-corrected-v0.6.21
```

## Step 2 — Install and validate

Open Terminal and run:

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.21
npm ci
npm run check
```

The build must finish with:

```text
PASS: Required production bundle features are present.
```

## Step 3 — Link the existing Netlify site when necessary

```bash
npx netlify link
npx netlify status
```

Select the existing Skilled Crafting inventory site. Do not create a new site.

## Step 4 — Build with the working production environment

```bash
rm -rf dist
npx netlify build --context production
```

## Step 5 — Create a preview deployment

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

Open the new preview URL.

## Step 6 — Test the theme system

1. Log in normally.
2. Select **Themes** in the top bar, or open **Tools & Admin → Visual Themes & Layout**.
3. Apply each of the six themes.
4. Test Light, Dark, and System appearance.
5. Test Compact, Comfortable, and Spacious density.
6. Refresh the browser and confirm the selection remains saved.
7. Open Inventory, Pull Sheets, Purchasing Report, and Purchase Orders.
8. Confirm the pages display normally and the data is unchanged.
9. Print or preview a report and confirm the print layout remains white.

## Step 7 — Publish production

After the preview passes:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```

## Default setting

New browsers use:

```text
Theme: Operations Blue
Appearance: System
Density: Comfortable
Help panels: Visible
Animation: Standard
```

Existing browser light/dark preferences are migrated automatically.
