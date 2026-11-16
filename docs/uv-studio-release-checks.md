# UV Studio release and application domain checks

## UV first article

1. Open a synthetic or shop-owned logo in UV Studio. Make one small color, height, white and varnish pack. Open the operator guide included in the ZIP.
2. In xTool Studio, record its version, the Omni model and firmware, the blank manufacturer and lot, white ink chemistry, the selected native print mode, entered height, and whether varnish is enabled. Verify layer placement against the color artwork reference.
3. Print one coupon on a sacrificial blank using a manufacturer-supported process. Measure deposited height, inspect white coverage and varnish edges, and record adhesion and flex or scratch results appropriate to the substrate.
4. If cutting a patch, verify size, registration marks, and material bridge strength on scrap stock using the actual cutter before using the reference on customer work.
5. Record the results under UV Studio → Material calibration and print validation. A positive measurement and passing durability result qualify only the specific material and configuration tested.

## Contextual settings help

Use the shared React `SettingHelp` control alongside each label. Keep the control outside the HTML label so opening help does not activate or focus its form control. Use stable field keys in a versioned registry and describe what changes, the next workflow step it affects, and supported ranges when they are established. Verify hover, keyboard focus, Escape, tap, and outside dismissal. The standalone UV Studio implements equivalent controls because it runs as an independent document.

## Domain cutover prerequisites

Netlify serves the two hosts from the same site. At discovery, `inventory.skilledcrafting.com` was primary and `app.skilledcrafting.com` was an alias. The hosts showed different signed-in session states. Verify Supabase Site URL and explicit reset and sign-in callbacks for both hosts. Check any provider callback URLs and local storage or service workers before changing the primary domain.

WordPress Pull Sheet Due Dates uses the legacy host for `manual-pullsheet` and `set-pullsheet-due-dates`. Preserve those POST endpoints while migrating callers. Keep webhook, OAuth, password-reset, and service worker transition behavior explicit. Do not redirect integration POST requests through the interactive UI redirect.

Verify authentication and password reset, a deep link with a query string, and legacy callback and webhook reachability in an isolated check. Record the current Netlify deploy so it can be republished if a cutover fails. Check the production deploy SHA and both hosts after publishing.

### Verified configuration and rollout flag

Supabase already uses the app host as the Site URL. Both host roots and both exact `/reset-password` callbacks are in the allowlist. Netlify has `SC_APP_URL` and the Google Calendar and QuickBooks OAuth callbacks on the app host. These settings are configuration evidence. An end-to-end OAuth reauthorization is a separate check.

The edge redirect is disabled by default. After the signed-in app-host smoke test and integration checks pass, set the production Edge Functions environment value `SC_CANONICAL_APP_NAVIGATION=true`. The rule permanently redirects ordinary legacy browser navigation with its path and query, and keeps the legacy root available for older fragment-based authentication links. The legacy root can be retired after all such links and provider settings are migrated. Leave function endpoints, APIs, webhook requests, OAuth and recovery callbacks, service workers and assets on their original host. To reverse the redirect, disable the flag and redeploy the published revision.
