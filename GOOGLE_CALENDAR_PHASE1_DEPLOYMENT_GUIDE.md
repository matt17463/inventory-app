# Google Calendar Phase 1 — Novice Deployment Guide

Release: **Skilled Crafting v0.6.30**  
Base release: **v0.6.29**

This guide installs the first Google Calendar integration for:

- Active WooCommerce and manual-order pull-sheet due dates
- Open purchase-order expected arrival dates
- Open high-priority tasks assigned to the selected owner employee
- Manual sync, duplicate-safe rebuild, sync history, and 15-minute automatic production sync

Skilled Crafting remains the source of truth. Calendar changes never update orders, inventory, purchase orders, reservations, or employee tasks.

## Deployment order

Complete the steps in this order:

1. Extract and verify v0.6.30.
2. Run the Supabase migration.
3. Create the Google Cloud OAuth client.
4. configure Netlify variables.
5. update GitHub and deploy the application.
6. Connect Google from the deployed application.
7. Run and verify the initial sync.

Do not connect Google until the SQL, variables, and application are all deployed.

---

## Step 1 — Extract the release safely

Download this file into your Mac Downloads folder:

`inventory-app-main-complete-corrected-v0.6.30-google-calendar-phase1.zip`

Open Terminal and run this entire block:

```bash
cd ~

SC_RELEASE_ZIP="$(find "$HOME/Downloads" -maxdepth 1 -type f \
  -name 'inventory-app-main-complete-corrected-v0.6.30-google-calendar-phase1*.zip' \
  -print | sort | tail -n 1)"

if [ -z "$SC_RELEASE_ZIP" ]; then
  echo "STOP: The v0.6.30 complete ZIP was not found in Downloads."
else
  echo "Using release: $SC_RELEASE_ZIP"
fi
```

Do not continue if it says `STOP`.

Then run:

```bash
SC_WORKDIR="$(mktemp -d "$HOME/Downloads/sc-calendar-phase1-XXXXXX")"
mkdir -p "$SC_WORKDIR/package"
unzip -q "$SC_RELEASE_ZIP" -d "$SC_WORKDIR/package"

SC_SOURCE_DIR="$(find "$SC_WORKDIR/package" -maxdepth 1 -type d \
  -name 'inventory-app-main-complete-corrected-v0.6.30-calendar-phase1' \
  -print | head -n 1)"

echo "Release workspace: $SC_WORKDIR"
echo "Application source: $SC_SOURCE_DIR"

test -n "$SC_SOURCE_DIR" || { echo "STOP: Application folder was not found inside the ZIP."; return 1 2>/dev/null || exit 1; }

grep '"version"' "$SC_SOURCE_DIR/package.json" | head -n 1
test -f "$SC_SOURCE_DIR/deployment/sql/17_GOOGLE_CALENDAR_PHASE1.sql" || { echo "STOP: Calendar SQL is missing."; return 1 2>/dev/null || exit 1; }
```

The version must be:

```text
"version": "0.6.30"
```

Keep this Terminal window open. Later steps reuse `SC_WORKDIR` and `SC_SOURCE_DIR`.

---

## Step 2 — Install the Supabase migration

The migration creates only new Google Calendar integration objects. It does not change inventory quantities, jobs, pull sheets, purchase orders, or existing dates.

1. Sign in to Supabase.
2. Open the Skilled Crafting project.
3. Select **SQL Editor**.
4. Select **New query**. Do not reuse an old migration tab.
5. On your Mac, open:

   `deployment/sql/17_GOOGLE_CALENDAR_PHASE1.sql`

6. Copy the entire file into Supabase.
7. Select **Run**.

Expected result:

```text
connection_table_installed       true
target_table_installed           true
event_link_table_installed       true
sync_run_table_installed         true
health_function_installed        true
```

Do not continue unless all five values are `true`.

---

## Step 3 — Create the Google Cloud connection

Use the Google account that should own the Skilled Crafting calendars. Do not create a service account; Google recommends authorizing as the intended calendar owner.

### 3A. Create or choose a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project such as **Skilled Crafting Calendar Integration**, or select an existing Skilled Crafting project.
3. Confirm the correct project name appears in the top project selector.

### 3B. Enable Google Calendar API

1. Open **APIs & Services → Library**.
2. Search for **Google Calendar API**.
3. Open it and select **Enable**.

### 3C. Configure Google Auth Platform

1. Open **Google Auth Platform**.
2. Set the app name to **Skilled Crafting Operations**.
3. Enter your support email and developer contact email.
4. For audience:
   - Choose **Internal** if the Google account belongs to your Google Workspace organization and Internal is available.
   - Otherwise choose **External**.
5. Add your Google account as a test user while configuring the connection.
6. Under data access/scopes, add:

   `https://www.googleapis.com/auth/calendar.app.created`

The application also requests basic `openid` and `email` identity scopes so it can display which Google account is connected.

For continuous automatic synchronization, the OAuth application should be **In production**. Google testing-mode refresh tokens can expire after seven days. If you temporarily leave it in Testing, expect to reconnect after the test token expires.

### 3D. Create the OAuth client

1. Open **Clients** and select **Create client**.
2. Choose **Web application**.
3. Name it **Skilled Crafting Inventory Calendar**.
4. Add this authorized JavaScript origin:

   `https://inventory.skilledcrafting.com`

5. Add this exact authorized redirect URI:

   `https://inventory.skilledcrafting.com/.netlify/functions/google-calendar-oauth`

6. Select **Create**.
7. Copy the **Client ID** and **Client secret** to a secure temporary location. Do not commit either value to GitHub or paste it into Supabase.

The redirect URI must match exactly, including `https`, the domain, and the full function path.

---

## Step 4 — Configure Netlify variables

The safest novice option is the Netlify website:

1. Open your Netlify Skilled Crafting inventory project.
2. Open **Project configuration → Environment variables**.
3. Add these variables:

| Variable | Value |
|---|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | Client ID copied from Google Cloud |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Client secret copied from Google Cloud |
| `GOOGLE_CALENDAR_STATE_SECRET` | Random value generated below |
| `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` | Random 32-byte key generated below |
| `GOOGLE_CALENDAR_REDIRECT_URI` | `https://inventory.skilledcrafting.com/.netlify/functions/google-calendar-oauth` |
| `SC_APP_URL` | `https://inventory.skilledcrafting.com` |

Generate the two random secrets in Terminal:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

- Use the first output for `GOOGLE_CALENDAR_STATE_SECRET`.
- Use the second output for `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`.

Never prefix these with `VITE_`. Doing so could expose them to the browser bundle.

Important: after Google is connected, do not change the token-encryption key. If it must be changed, reconnect Google immediately afterward.

### Optional Netlify CLI method

If your Terminal is already logged in and linked to the correct Netlify project:

```bash
cd "$SC_SOURCE_DIR"
npx netlify status

read -r "SC_GOOGLE_CLIENT_ID?Paste Google Client ID: "
read -rs "SC_GOOGLE_CLIENT_SECRET?Paste Google Client Secret: "
echo
SC_GOOGLE_STATE_SECRET="$(openssl rand -hex 32)"
SC_GOOGLE_TOKEN_KEY="$(openssl rand -base64 32)"

npx netlify env:set GOOGLE_CALENDAR_CLIENT_ID "$SC_GOOGLE_CLIENT_ID"
npx netlify env:set GOOGLE_CALENDAR_CLIENT_SECRET "$SC_GOOGLE_CLIENT_SECRET"
npx netlify env:set GOOGLE_CALENDAR_STATE_SECRET "$SC_GOOGLE_STATE_SECRET"
npx netlify env:set GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY "$SC_GOOGLE_TOKEN_KEY"
npx netlify env:set GOOGLE_CALENDAR_REDIRECT_URI "https://inventory.skilledcrafting.com/.netlify/functions/google-calendar-oauth"
npx netlify env:set SC_APP_URL "https://inventory.skilledcrafting.com"

unset SC_GOOGLE_CLIENT_ID SC_GOOGLE_CLIENT_SECRET SC_GOOGLE_STATE_SECRET SC_GOOGLE_TOKEN_KEY
```

Confirm `npx netlify status` names the correct inventory site before setting anything.

---

## Step 5 — Update GitHub from a clean clone

The repository is:

`git@github.com:matt17463/inventory-app.git`

Run:

```bash
SC_REPO="$SC_WORKDIR/inventory-app"

git clone git@github.com:matt17463/inventory-app.git "$SC_REPO"
cd "$SC_REPO"

git switch main
git pull --ff-only origin main

git remote get-url origin
git status -sb
npm pkg get version
```

Before copying the release, the repository will normally show v0.6.29.

Copy the verified complete release into the clone:

```bash
rsync -a \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  "$SC_SOURCE_DIR/" "$SC_REPO/"

cd "$SC_REPO"
npm pkg get version
git status -sb
```

The version must now report `0.6.30`.

Install and validate:

```bash
npm ci
npm run check
```

Do not continue unless the final build verification says:

```text
PASS: Required production bundle features are present.
```

The chunk-size message is only a warning.

Review and push:

```bash
git diff --stat
git status -sb

git add .
git commit -m "Add Google Calendar Phase 1 integration v0.6.30"
git push origin main
```

Verify GitHub:

```bash
git status -sb
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/main
```

`HEAD` and `origin/main` must be identical, and status should show:

```text
## main...origin/main
```

On GitHub, confirm `package.json` on the `main` branch shows `0.6.30`.

---

## Step 6 — Deploy Netlify

### Recommended: GitHub-connected Netlify deployment

If Netlify is already connected to GitHub `main`, the push should start a production deployment automatically.

1. Open **Netlify → Deploys**.
2. Confirm the deploy uses the commit from Step 5.
3. Wait for **Published**.
4. Open the deploy log and confirm the production feature verifier passed.

### Manual Netlify deployment

Use this only if the site is not automatically publishing from GitHub:

```bash
cd "$SC_REPO"

npx netlify status
npx netlify build --context production

npx netlify deploy \
  --dir=dist \
  --functions=netlify/functions
```

Test the preview. The 15-minute scheduled sync does not run automatically on previews, so use **Sync Now** during preview testing.

When ready:

```bash
npx netlify deploy \
  --dir=dist \
  --functions=netlify/functions \
  --prod
```

After production deployment, the Netlify Functions page should show `google-calendar-scheduled-sync` with a **Scheduled** badge and a next-run time.

---

## Step 7 — Connect Google Calendar

1. Sign in to `https://inventory.skilledcrafting.com` with an admin or manager employee account.
2. Open **Tools & Admin → Google Calendar**.
3. Select **Connect Google Account**.
4. Sign in with the account that should own the business calendars.
5. Approve permission to create and manage calendars created by Skilled Crafting.
6. The authorization window should close and the app should show the connected email.

The integration creates:

- Skilled Crafting — Order Commitments
- Skilled Crafting — Purchasing
- Skilled Crafting — Owner Tasks

If Google displays an unverified-app warning, confirm you are authorizing the Google Cloud project you created. Do not proceed if the project or requested permission is unfamiliar.

---

## Step 8 — Configure and run the initial sync

On **Google Calendar Integration**:

1. Confirm the business time zone is `America/Los_Angeles`.
2. Select your employee record under **Owner Employee Record**.
3. Choose the minimum owner task priority. The default is `5`.
4. Leave all three calendars enabled.
5. Select **Save Settings**.
6. Select **Run Initial Sync**.

The result should show created events and zero errors. Open each Google calendar from the page.

Expected behavior:

- Active jobs with due dates appear as all-day `ORDER DUE` events.
- Open purchase orders with expected dates appear as all-day `PO EXPECTED` events.
- Open tasks assigned to the selected owner, with a due time and sufficient priority, appear as timed `OWNER TASK` events.
- Each event includes a link back to Skilled Crafting.
- Due-date events are transparent/free rather than blocking the full day.

---

## Step 9 — Verify duplicate safety and one-way behavior

Use an existing non-critical test order:

1. Record its current due date and Google event.
2. Change the due date in **Pull Sheet Due Dates**.
3. Return to **Google Calendar Integration** and select **Sync Now**.
4. Confirm the original event moved to the new date.
5. Confirm a second event was not created.
6. Edit the Google event title manually.
7. Select **Rebuild Calendar Sync**.
8. Confirm the Skilled Crafting title is restored.
9. Confirm the job due date in Skilled Crafting never changed from a Google-side edit.

Also verify:

- A received PO no longer has an active expected-arrival event after sync.
- A completed owner task no longer has an active event after sync.
- Repeated Sync Now operations report mostly unchanged events and do not create duplicates.

---

## Step 10 — Deployment Health

Open **Tools & Admin → Deployment Health** and run the checks.

Google Calendar should report:

- Phase 1 database: PASS
- Owner connection: PASS
- Recent sync errors: PASS
- All six Google/SC application environment variables: PASS

If Owner connection shows a warning, connect or reconnect Google from the integration page.

---

## Troubleshooting

### `redirect_uri_mismatch`

The URI in Google Cloud and Netlify must both be exactly:

`https://inventory.skilledcrafting.com/.netlify/functions/google-calendar-oauth`

Do not add a trailing slash.

### Connection works for seven days and then stops

The Google OAuth project is probably still in Testing. Move the Google Auth Platform publishing status to In production, then reconnect the account.

### Stored credential cannot be decrypted

The Netlify `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` changed. Keep the new key, open the integration page, and reconnect Google.

### Order events are missing

The job must have a due date and must not have a completed, cancelled, voided, deleted, or refunded status. Run **Pull Sheet Due Dates → Rebuild Due Date Sync**, then run Calendar Sync.

### Purchase-order events are missing

The PO must have an expected date and an open status such as draft, ordered, or partial.

### Owner tasks are missing

Confirm all of the following:

- An Owner Employee Record is selected.
- The task is assigned to that employee.
- The task has a due date/time.
- Its priority is at or above the configured minimum.
- Its status is open, in progress, or blocked.

### Automatic sync does not run in preview

This is expected. Netlify scheduled functions run automatically only for published production deploys. Use Sync Now in preview deployments.

### A sync reports that another sync is running

Wait one minute and refresh. The database prevents manual and scheduled runs from writing the same events simultaneously. A stale run is closed automatically after 30 minutes.

### A large initial sync does not finish every event at once

Each execution intentionally limits Google operations to stay inside the scheduled-function runtime. Changed and missing events are prioritized, and subsequent 15-minute runs continue the backlog without duplicates.

---

## Rollback

If the calendar feature needs to be paused:

1. Open **Google Calendar Integration**.
2. Select **Disconnect Google Calendar**.
3. Existing Google calendars and events remain visible, but updates stop.
4. Revert the v0.6.30 GitHub commit or publish the previous Netlify deployment.

Do not drop the four `sc_google_calendar_*` tables. They contain only integration state and audit history, and leaving them installed does not affect existing application workflows.

---

## When Phase 1 is accepted

Confirm these items before starting more calendar work:

- Orders update without duplicate events.
- POs appear and disappear correctly as their status changes.
- Owner-task filtering is useful rather than noisy.
- Automatic production sync runs for several days without errors.
- The Google calendar view reduces time spent checking separate application pages.

Then return to ChatGPT and send:

`Phase 1 is deployed and verified. Begin Phase 2 and Phase 3 planning.`

Phase 2 will focus on timed production blocks and capacity. Phase 3 will focus on backward-planned artwork, purchasing, production, QC, packing, and customer-delivery milestones.

## Official references

- [Google Calendar API authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Create secondary calendars](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert)
- [Create and identify events](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Google OAuth security practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)
