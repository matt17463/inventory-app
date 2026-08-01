# Steps 3–5 Safe Deployment

## What changes

### Step 3 — Public customer portal

- `/customer-portal?token=...` is rendered outside employee `AuthGate` and outside the employee application shell.
- A missing token no longer exposes employee links or recent preview records.
- The protected `/customer-portal-preview` page remains available to employees.
- The app uses the new `sc_customer_portal_data_v2` RPC.
- The existing `phase6_customer_portal_data` function and all existing tokens/events remain untouched for rollback.

### Step 4 — Netlify function authentication

- Browser functions require a current Supabase access token plus an active `admin` or `manager` role.
- Existing Supabase Auth users are inserted into the new role table as `admin` only when they do not already have a role. This prevents a production lockout.
- WordPress/server functions require a configured shared secret and fail closed when configuration is missing.
- Security authorization decisions are written best-effort to `sc_function_security_audit`.

### Step 5 — WooCommerce webhook verification

- Every webhook POST requires `WC_WEBHOOK_SECRET` to be configured.
- Every webhook POST requires `X-WC-Webhook-Signature`.
- HMAC comparison is timing-safe and is performed against the unmodified raw request body before setup pings, JSON parsing, or database writes.
- Existing compatibility URLs remain deployed but reuse the canonical secured handler.

## What does not change

- No inventory, order, job, reservation, movement, product, mapping, artwork, sample, portal token, or portal event row is deleted or modified.
- No existing table, view, function, trigger, policy, or storage bucket is dropped.
- Existing customer portal tokens remain valid.
- Existing WooCommerce catalog and pull-sheet logic remains in the canonical function files.

## Required environment variables

Set these in Netlify before deploying the function files:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SC_ALLOWED_ORIGINS=https://inventory.skilledcrafting.com

WC_WEBHOOK_SECRET
MANUAL_PULLSHEET_SECRET
SC_PULLSHEET_SECRET
SC_ARTWORK_WEBHOOK_SECRET

WC_CONSUMER_KEY
WC_CONSUMER_SECRET
```

Compatibility fallbacks remain for some older names, but the names above should be treated as canonical. `SC_ARTWORK_WEBHOOK_SECRET`, `MANUAL_PULLSHEET_SECRET`, `SC_PULLSHEET_SECRET`, and `WC_WEBHOOK_SECRET` should be separate random values.

Never expose any of these as a `VITE_` variable. Vite variables are shipped to the browser.

## Deployment order

1. Create a current Supabase backup/recovery checkpoint.
2. Run `000_steps3_5_preflight_read_only.sql`.
3. Resolve every `STOP` result.
4. Add/confirm the Netlify environment variables above, but do not remove the old deployment yet.
5. Run `202607250201_step3_public_customer_portal.sql`.
6. Run `202607250301_step4_employee_roles_and_security_audit.sql`.
7. Review `sc_app_user_roles`; existing users should have `admin` unless a prior role was retained.
8. Run `202607250401_step5_integration_security_registry.sql`.
9. Deploy the application and Netlify function files.
10. Run `900_steps3_5_post_install_verification.sql`.
11. Complete the smoke tests below.

## Smoke tests

### Public portal

- In a private/incognito browser, open a known `/customer-portal?token=...` link.
- Confirm no employee sign-in is requested.
- Confirm only that customer’s visible events appear.
- Open `/customer-portal` without a token and confirm no customer data or employee links appear.
- Test an inactive, expired, and invalid token; all should return the same generic unavailable message.

### Employee browser functions

- Sign in as an existing employee.
- Run one supplier catalog chunk and verify it succeeds.
- Change one test WooCommerce order status and verify it succeeds.
- Temporarily set the employee’s role to `viewer`; both privileged actions should return HTTP 403.
- Restore the original role.

### Shared-secret integrations

- Send each integration a request with no secret: expect 401, or 500 when the server secret is not configured.
- Send a bad secret: expect 401.
- Send the configured secret: existing behavior should continue.

### WooCommerce webhook

- Use WooCommerce’s webhook delivery/test mechanism with the matching secret: expect HTTP 200.
- Send the same body without a signature: expect HTTP 401.
- Send a modified body with the old signature: expect HTTP 401.
- Confirm valid order webhook deliveries still create/update jobs and status records.

## Role management

Use SQL or the Supabase table editor after deployment:

```sql
select u.email, r.role, r.is_active, r.notes
from auth.users u
left join public.sc_app_user_roles r on r.user_id = u.id
order by u.email;
```

To downgrade a user after reviewing their responsibilities:

```sql
update public.sc_app_user_roles
set role = 'operator', updated_at = now()
where user_id = '<auth-user-uuid>';
```

Only `admin` and `manager` can run supplier imports or WooCommerce status changes in this package.
