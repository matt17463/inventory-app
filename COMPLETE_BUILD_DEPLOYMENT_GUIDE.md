# Complete Build Deployment Guide

## 1. Preserve the current working site

Do not delete your current project folder. Rename or duplicate it as a backup.
Netlify also retains prior published deploys that can be restored.

## 2. Extract this complete build

Extract `inventory-app-main-complete-corrected-v0.6.15.zip` into Downloads.
The extracted folder should contain `package.json`, `src`, `netlify`, `supabase`, and `scripts` at its top level.

## 3. Open Terminal in the new folder

```bash
cd ~/Downloads/inventory-app-main-complete-corrected-v0.6.15
```

Confirm the key files:

```bash
ls package.json netlify.toml src/DeploymentHealth.jsx netlify/functions/deployment-health.js
```

## 4. Install and validate

```bash
npm ci
npm run check
```

Warnings are acceptable. Do not deploy if the command ends with an error or a failed Vite build.

Confirm Deployment Health is in the source:

```bash
grep -n "deployment-health" src/App.jsx
grep -n "Deployment Health" src/navigationConfig.js
```

Build and confirm it is in the final bundle:

```bash
rm -rf dist node_modules/.vite
npm run build
grep -R "/deployment-health" dist
grep -R "Deployment Health" dist
```

Both bundle searches must return a match under `dist/assets`.

## 5. Link the correct existing Netlify site

```bash
npx netlify login
npx netlify link
npx netlify status
```

Choose the existing site for `inventory.skilledcrafting.com`. Do not create a new site.

## 6. Verify Netlify browser variables

The following must be available to Builds and the deployment context used:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

They must be a matching URL and browser-safe publishable/anon key from the same Supabase project.
Never place a service-role or secret key in a `VITE_` variable.

## 7. Create a draft deploy

```bash
npx netlify deploy --build
```

Open the newly generated draft URL in a private window and test:

```text
/deployment-health
```

Confirm the page appears and **Deployment Health** appears under **Tools & Admin**.

## 8. Publish production

```bash
npx netlify deploy --build --prod
```

Then open:

```text
https://inventory.skilledcrafting.com/deployment-health
```

Use a private browser window or a hard refresh.

## 9. Live smoke tests

- Sign in as an employee.
- Confirm inventory, bins, orders, pull sheets, and reservations load.
- Confirm `/create-product` redirects to `/inventory/edit-blanks`.
- Confirm a false path shows Not Found.
- Confirm a valid customer portal token works without employee login.
- Run standard Deployment Health.
- Run the deep WooCommerce health check.
- Regenerate one controlled pull sheet and confirm no duplicate job item is created.

## 10. SQL

Your most recent audit showed all Steps 1–14 database objects installed.
Do not replay the complete migration set on production.

The guarded optional uniqueness script is located at:

```text
supabase/optional/202607250702_optional_pullsheet_unique_index.sql
```

Run it only if it has not already been run and the duplicate audit reports zero duplicate job/line-item groups.
