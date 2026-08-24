# Skilled Crafting Inventory v1.0.4 — Authentication Resume Stability

## What this update fixes

- A routine Supabase `TOKEN_REFRESHED` event no longer clears the successful employee access check.
- Returning to a background browser tab no longer replaces and unmounts the open application.
- Unsaved React form entries remain mounted during token refreshes and temporary access-check outages.
- Only an explicit HTTP 403 employee-role denial displays **Account access is not active**.
- Network failures, Netlify cold starts, timeouts, and HTTP 5xx responses display a retryable temporary-verification message.
- Access checks stop after eight seconds instead of leaving the branded loading screen hanging for 20–30 seconds.
- HTTP 401 and 403 errors now carry machine-readable status information to the access gate.
- The loading and sign-in screen uses a bounded logo and centered card.

No Supabase schema migration and no new Netlify environment variable are required.

## Install the patch

```bash
REPO_DIR="$HOME/inventory-app"
PATCH_ZIP="$HOME/Downloads/inventory-app-auth-resume-stability-v1.0.4.zip"

test -d "$REPO_DIR/.git" || { echo "STOP: Repository not found at $REPO_DIR"; return 1 2>/dev/null || exit 1; }
test -f "$PATCH_ZIP" || { echo "STOP: Patch not found at $PATCH_ZIP"; return 1 2>/dev/null || exit 1; }

cd "$REPO_DIR"
git status --short
```

If the last command lists files, stop and commit or stash those files before continuing. Then run:

```bash
cd "$HOME/inventory-app"
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/auth-resume-stability-v1.0.4

unzip -o "$HOME/Downloads/inventory-app-auth-resume-stability-v1.0.4.zip" -d "$HOME/inventory-app"

npm ci
npm run check

git add \
  src/AuthGate.jsx \
  src/lib/netlifyFunctionClient.js \
  src/App.css \
  scripts/tests/application-integrity.test.mjs \
  netlify/functions/application-integrity.js \
  package.json \
  package-lock.json \
  AUTH_RESUME_STABILITY_DEPLOYMENT.md

git commit -m "Keep employee sessions stable when browser tabs resume v1.0.4"
git push -u origin feature/auth-resume-stability-v1.0.4
```

Open this pull request:

https://github.com/matt17463/inventory-app/compare/main...feature/auth-resume-stability-v1.0.4?expand=1

Merge it into `main`, then wait for the Netlify production deploy to finish successfully.

## Verify the employee role

Valid login credentials and an active application role are separate checks. Run this read-only query in the Supabase SQL editor, replacing the email value:

```sql
select
  u.id as user_id,
  u.email,
  r.role,
  r.is_active
from auth.users u
left join public.sc_app_user_roles r on r.user_id = u.id
where lower(u.email) = lower('YOUR_LOGIN_EMAIL_HERE');
```

Expected: one row, `role` is `admin`, `manager`, or `operator`, and `is_active` is `true`.

If the role is missing or inactive for the business-owner account, replace the email and run:

```sql
insert into public.sc_app_user_roles (user_id, role, is_active, notes)
select
  u.id,
  'admin',
  true,
  'Restored business-owner application access on 2026-08-24.'
from auth.users u
where lower(u.email) = lower('YOUR_LOGIN_EMAIL_HERE')
on conflict (user_id) do update
set role = excluded.role,
    is_active = true,
    notes = excluded.notes,
    updated_at = now();
```

Do not run that update for an account that should not have administrator access.

## Browser verification

1. Open the production site and sign in.
2. Begin entering data in a form but do not save it.
3. Switch to another browser tab for at least two minutes.
4. Return to the inventory tab.
5. Confirm the page remains open and the unfinished form values remain present.
6. Leave the tab inactive long enough for a token refresh, return, and repeat the check.
7. In DevTools, confirm that a temporary failed health request displays a retry notice rather than **Account access is not active**.
8. Confirm a real inactive role still blocks application access.

## If the problem continues

Capture the response status and response body for:

`/.netlify/functions/application-integrity`

Also inspect the matching Netlify function log. Interpretation:

- `200`: access is active.
- `401`: the saved Supabase session is missing, expired, or cannot be renewed.
- `403`: the `sc_app_user_roles` row is missing, inactive, or has an unsupported role.
- `500` or a network timeout: server configuration, role lookup, or temporary connectivity failed; it must not be treated as an inactive account.
