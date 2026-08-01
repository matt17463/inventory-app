# Skilled Crafting Inventory App 0.6.16

## Why this version replaces 0.6.15

The 0.6.15 source files correctly contained the Deployment Health page,
route, navigation item, and Netlify function. However, the Vite 8 production
build removed those reachable React modules during Rolldown tree-shaking.

This was confirmed by two controlled builds:

- Default tree-shaking: Deployment Health markers were absent.
- `treeshake: false`: all Deployment Health markers were present.

Version 0.6.16 permanently applies the verified build setting and adds an
automatic post-build inspection. The build now fails before deployment if
Deployment Health is missing from the generated JavaScript.

## Important database note

Do not rerun the full Supabase migration collection. The previous database
audit confirmed that the required Steps 1–14 objects are installed.

This update is an application build correction only.

## Clean installation

1. Extract this ZIP into a new folder.
2. Do not merge it into the 0.6.15 folder.
3. Open Terminal in the new folder:

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.16
```

4. Install the locked dependency versions:

```bash
npm ci
```

5. Run all checks:

```bash
npm run check
```

A successful build must end with:

```text
PASS: Required production bundle features are present.
```

If that line is not shown, do not deploy.

## Optional manual bundle verification

```bash
node scripts/verify_build_features.mjs
```

The verifier checks all JavaScript files under `dist/assets`, so it remains
valid if Vite creates multiple chunks or changes the hashed bundle filename.

## Link to the existing Netlify site

```bash
npx netlify link
npx netlify status
```

Select the existing Netlify site serving:

```text
inventory.skilledcrafting.com
```

Do not create another site.

## Draft deployment

Deploy the exact locally verified output:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions
```

Open the newly generated draft URL in a private browser window, then visit:

```text
/deployment-health
```

Confirm:

- Deployment Health appears under Tools & Admin.
- The Deployment Health page opens.
- Existing inventory pages still open.
- The employee login reaches the correct Supabase project.

## Production deployment

Only after the draft works:

```bash
npx netlify deploy --dir=dist --functions=netlify/functions --prod
```

Then open:

```text
https://inventory.skilledcrafting.com/deployment-health
```

## Separate Supabase key issue

A direct Supabase request returning HTTP 401 means the URL/key pair is still
invalid or mismatched. That is separate from the removed-route build defect.

Use only a Project URL and publishable/anon key from the same Supabase project.
Never put a service-role or secret key in a `VITE_` variable.
