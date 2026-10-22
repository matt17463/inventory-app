# Staging availability, isolation and planning cost

Reviewed 2026-10-22; no staging created and no fictional transactions performed.

## Actual hosting observation

After the owner signed into SiteGround in the authorized browser, Site Tools → WordPress → Staging selected `https://skilledcrafting.com/`. The Create New Staging Copy form was available. Under Manage Staging Copies → Staging Copies, the list said **“There's nothing here yet.”** No existing copy was available for this installation. This does not inventory unrelated hosting sites, billing entitlements or environments outside this screen.

The owner confirmed no known isolated staging and identified WordPress, inventory.skilledcrafting.com and Supabase as production. Netlify previews may use production connections. No environment was treated as safe merely because its URL says staging or preview. No payments/email/webhooks/Supabase isolation was certified.

## Recommended setup requiring owner approval

Prefer a fresh private WordPress/Woo fixture with fictional data and the reviewed plugin versions, rather than copying live customer records and credentials. If SiteGround's cloning tool is chosen instead, obtain approval for the copy and design isolation **before the first WordPress boot**: a clone can copy production secrets, scheduled jobs and personal data. A disconnected clone is not automatically a safe clone.

Approve the environment, allowed data, spending cap, responsible operator and test writes before implementation. Use a separate database and a separate fictional Supabase project or integration stub. The previous decision to bypass separate Supabase staging does not authorize production-connected tests now.

### Isolation acceptance checklist — all pending

- Restrict access with authentication, prevent indexing, disable customer registration/real-user access, and establish a staging-only backup/cleanup procedure.
- Block outbound HTTP/SMTP at a layer effective before WordPress initialization; allow only explicitly approved sandbox destinations after review. A plugin toggle alone is not an egress boundary.
- Remove/replace production Woo API keys, application passwords, payment tokens/keys, Supabase credentials, SMTP accounts, webhook secrets and carrier credentials. Include Square/WooPayments, storage/R2, accounting, Google and artwork/notification services where installed.
- Disable staging cron/Action Scheduler and all sync/publish/notification jobs until destinations and queues have been inspected. Drain or remove copied pending jobs only on the approved staging system.
- Route email to a local capture sink; verify externally that no customer or staff recipient receives it. Use sandbox payment keys and block real charge/refund endpoints. Do not purchase carrier labels/postage.
- Replace Woo webhooks and application/Supabase sync destinations with inert local endpoints or approved separate fixtures. Check outbound requests, retries and logs, rather than assuming the absence of a visible UI key means isolation.
- Keep production inventory, blank mappings, reservations and order identifiers inaccessible to fictional tests. Use clearly marked fictional products, users, coupons and addresses.
- Verify every external destination and retained queue before enabling the fixture. Record isolation evidence without recording secrets.
- Run baseline SKU save-path and shipping quote tests before candidate fixes. Payments and order submission are unnecessary for shipping quote checks; any fictional order needed for mapping tests needs separate explicit authorization.
- Never push a whole staging database back onto live WooCommerce. Package approved code/settings changes individually; preserve new live orders. Remove fictional data and revoke staging credentials when finished.

## Estimated cost and effort

The existing staging UI may mean no incremental hosting charge if the current subscription includes staging and sufficient resources; **$0 additional hosting is a planning assumption, not a verified billing quote**. No upgrade or service was purchased. Confirm the account plan/storage before choosing a setup. SiteGround advertises staging with GrowBig/GoGeek; its published regular GrowBig USD rates, updated October 12, 2026, are $34.99/month on monthly terms, $29.99/month on a prepaid 12-month term and $24.99/month on a prepaid 24-month term. These are reference rates, not a required purchase or verified account renewal price. See [SiteGround features](https://www.siteground.com/features/wordpress-hosting2.htm) and [regular plan rates](https://www.siteground.com/kb/current-rates-shared-hosting-plans/).

Planning labor estimates, not quotations: 4–8 hours to build and prove isolation; 4–8 hours for SKU path instrumentation/acceptance; 2–4 hours for storefront regression; 2–4 hours for a selected shipping matrix, longer for the full combination matrix. Allow roughly **12–24 engineering hours before remediation**, depending on fixture reuse and integration stubs. At an owner-chosen hourly rate R, labor budget is approximately 12R–24R. Separate paid Supabase/services, taxes and actual remediation are not priced; a local stub may avoid additional subscription cost but does not validate a real sync.

If approval is deferred, retain the confirmed read-only findings and all unperformed test gaps. No live exploratory cart is necessary to preserve this audit's evidence.
