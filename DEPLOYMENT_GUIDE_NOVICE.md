# Novice Deployment Guide — Skilled Crafting Inventory App Steps 1–14

This guide assumes your current inventory application is live at `inventory.skilledcrafting.com` and connected to Supabase and Netlify.

The SQL in this package is designed to preserve existing inventory and order records. The deployment still needs to be performed carefully and in order.

---

## Part 1 — Download and prepare the files

1. Download the final ZIP supplied with this guide.
2. On your computer, right-click the ZIP and choose **Extract All** or **Uncompress**.
3. Open the extracted folder named:

   `inventory-app-main-steps1-14-final`

4. Confirm that the folder contains all of these:

   - `src`
   - `netlify`
   - `supabase`
   - `scripts`
   - `deployment`
   - `package.json`
   - `netlify.toml`

Do not deploy the ZIP from the earlier build named `inventory-app-main(13).zip`.

---

## Part 2 — Protect the current live system

### A. Confirm a Supabase backup

1. Sign in to Supabase.
2. Open the project used by the inventory application.
3. In the left menu, open **Database**.
4. Open **Backups**.
5. Confirm that a recent backup or recovery point exists.
6. Write down the date and time of the latest backup.

Do not continue if you do not have a usable backup or recovery point.

### B. Preserve the current Netlify deployment

1. Sign in to Netlify.
2. Open the existing inventory application project.
3. Open **Deploys**.
4. Find the most recent successful production deploy.
5. Write down its deploy date and deploy identifier.
6. Leave that deploy in place. Netlify can republish an earlier successful deploy if the new release must be rolled back.

---

## Part 3 — Run the database audit first

1. In Supabase, open **SQL Editor**.
2. Choose **New query**.
3. On your computer, open:

   `deployment/sql/00_FINAL_READ_ONLY_AUDIT.sql`

4. Select all of the SQL in that file and copy it.
5. Paste it into the Supabase SQL Editor.
6. Click **Run**.
7. Run the whole script at once. Do not highlight only the last line.
8. When the result table appears, use the download/export button to save the result as CSV.

### How to read the result

- `PASS` means the check succeeded.
- `REVIEW` means the deployment can often continue, but the condition needs attention.
- `STOP` means do not continue until that item is corrected.

### Common result: Steps 3–5 installed but ledger rows missing

When the audit shows the Step 3–5 objects exist but migration numbers `202607250201`, `202607250301`, or `202607250401` are not recorded:

1. Open a new Supabase SQL query.
2. Open this file on your computer:

   `deployment/sql/01_RECONCILE_STEPS_3_5_LEDGER_ONLY_IF_NEEDED.sql`

3. Copy and run the entire file.
4. It must return `PASS` for all three migration numbers.
5. Run `00_FINAL_READ_ONLY_AUDIT.sql` again.

The reconciliation script verifies the objects first and only then adds missing migration-history records. It does not change inventory or orders.

### Stop conditions that require caution

Do not run the Step 6–14 migrations when the audit reports a `STOP` for any of these:

- `blank_products`
- `blank_inventory_movements`
- `jobs`
- `job_items`
- `inventory_reservations`
- `reserve_inventory`
- An incompatible ID type

Those conditions indicate that the live database does not match the expected application model.

---

## Part 4 — Install the Step 6–14 database changes

Run one file at a time in Supabase SQL Editor. Wait for each file to finish successfully before running the next file.

### Step 6

Run:

`deployment/sql/02_STEP_6_WOOCOMMERCE_STATUS_AUDIT.sql`

This adds the order-status audit table. It does not change an existing WooCommerce order status.

### Step 7

Run:

`deployment/sql/03_STEP_7_SUPPLIER_SYNC.sql`

This adds the supplier synchronization run ledger and creates the private `supplier-sync-cache` bucket when it does not already exist.

After running it:

1. Open **Storage** in Supabase.
2. Confirm a bucket named `supplier-sync-cache` exists.
3. Confirm the bucket is **private**, not public.

### Step 8

Run:

`deployment/sql/04_STEP_8_PULLSHEET_REPAIR.sql`

This adds the pull-sheet run ledger and the reservation-repair helper. It does not rewrite existing reservations.

### Step 14

Run:

`deployment/sql/05_STEP_14_DEPLOYMENT_HEALTH.sql`

This adds the release registry and deployment-health database function.

### Verify the SQL installation

Run:

`deployment/sql/06_POST_INSTALL_VERIFICATION.sql`

Then run `00_FINAL_READ_ONLY_AUDIT.sql` again.

At this point there should be no `STOP` rows. `REVIEW` rows about historical duplicates may remain. Do not delete or merge records simply to remove those warnings.

### Do not run the optional unique index yet

The file below is intentionally optional:

`deployment/sql/99_OPTIONAL_PULLSHEET_UNIQUE_INDEX_DO_NOT_RUN_UNLESS_DUPLICATES_ZERO.sql`

Run it only when the audit reports zero duplicate job/line-item groups. It is not required for the initial deployment.

---

## Part 5 — Configure Netlify environment variables

1. In Netlify, open the inventory application project.
2. Open **Project configuration**.
3. Open **Environment variables**.
4. Add or verify the variables below.
5. Never place spaces before or after a value.
6. Do not paste secret values into source files.

### Browser application variables

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

These are the normal Supabase project URL and anon/publishable key used by the browser application.

### Server function variables

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SC_ALLOWED_ORIGINS
```

Set `SC_ALLOWED_ORIGINS` to:

```text
https://inventory.skilledcrafting.com
```

The service-role key is secret. Do not use a `VITE_` prefix for it.

### WooCommerce variables

```text
WOO_SITE_URL
WC_CONSUMER_KEY
WC_CONSUMER_SECRET
WC_WEBHOOK_SECRET
```

Set `WOO_SITE_URL` to:

```text
https://skilledcrafting.com
```

`WC_WEBHOOK_SECRET` must exactly match the secret configured for the WooCommerce webhook that sends orders to:

```text
https://inventory.skilledcrafting.com/.netlify/functions/woocommerce-webhook
```

### Pull-sheet and artwork integration secrets

Verify the existing values for:

```text
MANUAL_PULLSHEET_SECRET
SC_PULLSHEET_SECRET
SC_ARTWORK_WEBHOOK_SECRET
```

Your WordPress/WooCommerce integration must send the same secret values. Do not replace working secrets unless you are also updating the matching WordPress configuration.

### Optional controls

These can be omitted to use the built-in defaults:

```text
WC_STATUS_ALLOWED_STATUSES=pending,processing,on-hold,completed,cancelled,refunded,failed
SUPPLIER_CATALOG_SYNC_CHUNK_SIZE=50
SUPPLIER_CATALOG_SYNC_MAX_CHUNK_SIZE=250
SUPPLIER_CATALOG_DOWNLOAD_TIMEOUT_MS=30000
SUPPLIER_CATALOG_MAX_SOURCE_BYTES=104857600
```

After changing an environment variable, trigger a new deploy so the new deploy and functions receive the current values.

---

## Part 6 — Validate the application on your computer

This section requires Node.js 20 or newer.

1. Open Terminal on Mac, PowerShell on Windows, or the terminal inside Visual Studio Code.
2. Change into the extracted application folder.

Example on Mac:

```bash
cd ~/Downloads/inventory-app-main-steps1-14-final
```

Example on Windows PowerShell:

```powershell
cd "$HOME\Downloads\inventory-app-main-steps1-14-final"
```

3. Install the packages:

```bash
npm ci
```

4. Run the complete validation:

```bash
npm run check
```

The command must finish without an error. It checks Netlify ESM functions, static routes and security behavior, ESLint, and the production Vite build.

The built website will be placed in the `dist` folder.

---

## Part 7 — Deploy the code to Netlify

Because this application contains Netlify Functions, do not deploy only the `dist` folder with a basic drag-and-drop upload. Use the connected Git repository or Netlify CLI so the functions are deployed too.

### Recommended method: connected GitHub repository

1. Find the local folder that is connected to the GitHub repository used by Netlify.
2. Make a complete backup copy of that folder.
3. Keep the hidden `.git` folder in the repository folder.
4. Delete the old application files inside the repository folder, but do not delete `.git`.
5. Copy all files and folders from `inventory-app-main-steps1-14-final` into the repository folder.
6. Open GitHub Desktop.
7. Select the inventory application repository.
8. Review the changes.
9. Enter this commit message:

   `Deploy consolidated Steps 1-14 release`

10. Click **Commit to main** or your production branch.
11. Click **Push origin**.
12. Open Netlify and watch the new deploy under **Deploys**.
13. The deploy log should run `npm run build` and publish `dist`.
14. Confirm that the deploy lists the Netlify functions, including:

   - `woocommerce-webhook`
   - `manual-pullsheet`
   - `supplier-catalog-feed-sync`
   - `update-woocommerce-order-status`
   - `deployment-health`

### Alternate method: Netlify CLI

Use this only when the project is not connected to GitHub.

From the application folder run:

```bash
npm ci
npm run check
npx netlify login
npx netlify link
npx netlify deploy --build --prod
```

When `netlify link` asks which project to use, choose the existing inventory application project. Do not create a second production site.

---

## Part 8 — Confirm the live application

After Netlify reports **Published**, test the following.

### Basic page tests

1. Sign in to the inventory application.
2. Open **Inventory Overview**.
3. Confirm current quantities still appear.
4. Open **Pull Sheets**.
5. Confirm existing orders still appear.
6. Open **Bins**.
7. Confirm the bin list loads.
8. Open **Customer Portal Preview**.
9. Test sample mode and a known valid customer token.
10. Open a made-up URL such as:

   `https://inventory.skilledcrafting.com/not-a-real-page`

   Confirm the Not Found page appears.

11. Open an old `/create-product` bookmark and confirm it redirects to `/inventory/edit-blanks`.

### Deployment Health

1. Sign in as an admin or manager.
2. Open **Tools & Admin → Deployment Health**.
3. Run the normal check.
4. Every required database, storage, environment, release, and function check should pass.
5. Select **Include WooCommerce connection test**.
6. Run the check again.
7. Confirm WooCommerce connectivity passes.

The page reports whether a variable exists but never displays its secret value.

### WooCommerce webhook

1. In WordPress, open **WooCommerce → Settings → Advanced → Webhooks**.
2. Open the order webhook used by the inventory application.
3. Confirm the delivery URL is the current Netlify function URL.
4. Confirm the webhook is active.
5. Confirm its secret matches `WC_WEBHOOK_SECRET` in Netlify.
6. Use WooCommerce webhook delivery logs or a controlled test order to confirm an HTTP 2xx response.

### Pull-sheet rerun test

Use a controlled order that already has a pull sheet.

1. Trigger the manual pull sheet again.
2. Confirm it does not create a second job.
3. Confirm it does not duplicate job items.
4. Confirm existing reservations are reported as existing rather than recreated.

### Supplier sync test

1. Start one supplier feed synchronization.
2. Confirm a run record is created.
3. Confirm the run completes or returns a resumable `run_id`.
4. Confirm a second overlapping run for the same feed is refused.

---

## Part 9 — Roll back the code if necessary

If the new application has a serious problem:

1. Open the Netlify project.
2. Open **Deploys**.
3. Open the previous successful production deploy that you recorded before starting.
4. Choose the option to publish or restore that deploy.
5. Confirm the old site is live again.

The required database migrations are additive. Usually you should leave them installed even when rolling back the application code. Do not run a SQL rollback file unless the exact rollback has been reviewed for the current live database.

---

## Part 10 — Keep these records

Save these together:

- The final application ZIP
- The pre-deployment audit CSV
- The post-deployment audit CSV
- The Netlify successful deploy identifier
- The date and time of the Supabase backup
- A screenshot of the passing Deployment Health page

These records make future troubleshooting and upgrades much safer.
