# Authorized next step: private, fictional WordPress/WooCommerce staging

**Owner approval:** Yes, granted October 22, 2026, to set up an isolated WordPress staging environment using **fictional data**. The owner previously required separate approval for any added hosting/software charges. Approval does **not** extend to copying real customers/orders, altering live WordPress or spending money.

**Operational state:** The GitHub fixture and this runbook are prepared. A remotely accessible SiteGround staging installation is **NOT YET CREATED OR VERIFIED**.

## Best route for ChatGPT Work: a NEW clean WordPress install on a private SiteGround subdomain

Current authorized SiteGround Site Tools > WordPress > Staging screen showed **no existing staging copies**. The Create Staging Copy feature copies the entire production database and plugin configurations and therefore does not meet this project's isolation-before-boot requirements. **Do not click Create** on that cloning screen.

SiteGround officially supports a new WordPress or WordPress+WooCommerce install on a subdomain through **Site Tools > Domain > Subdomains**, then **WordPress > Install & Manage**, subject to the hosting plan's entitlement and capacity. Use a NEW fictional-data install, not a live clone.

### Phase A: entitlement and privacy before installation

1. In existing SiteGround account, inspect plan eligibility, available subdomain slots/usage, SSL and storage. Confirm no upgrade/add-on/new subscription or incremental charge is required. **If SiteGround asks for an additional charge, stop and obtain the owner's separate cost approval.**
2. Choose a private test subdomain such as \`stage-lab.skilledcrafting.com\` if free. Do not assume the name or DNS exists until SiteGround confirms creation.
3. Under **Security > Protected URLs** enable username/password protection; if available also restrict by authorized IP. Indexing disabled/robots noindex is additional hygiene, not equivalent to password protection.
4. Ensure the test subdomain does not point to \`inventory.skilledcrafting.com\`, has a distinct DB, and will never share production WordPress files or Supabase.
5. Create a **fresh** WordPress+WooCommerce site under **WordPress > Install & Manage** with NEW admin credentials stored only in the password manager / authorized browser. Do not reuse production login, Woo API, Application Password, customer list or payment credentials.
6. No real orders, coupons, logos with private customer assets, mailing lists, invoices or production data may be imported. Fixtures must use a clearly fictional organization, names, emails under \`example.invalid\`, fake products and fake shipping addresses.

### Phase B: hard isolation BEFORE installing custom plugins

1. Add a **server-specific** must-use safety plugin equivalent to \`staging/wordpress/mu-plugins/00-sc-fictional-safety.php\` (only on the staging site; the included DB-name assertion is intentionally for local Docker and must be changed to match the new staging DB before installing at SiteGround; NEVER upload the unchanged local file). This plugin blocks WordPress HTTP requests, mail, Woo gateways and Woo webhooks. Do not disable those controls to install plugins; upload approved ZIPs directly instead.
2. Disable wp-cron, scheduled actions and any plugin background jobs prior to enabling custom plugins. Confirm no previous queued live WooCommerce tasks exist (fresh install should have none).
3. Check that production API keys, \`wp-config.php\`, Supabase, QuickBooks, payment, Square, email provider, R2, EasyPost/USPS and other live service secrets are **absent**. Never paste them in chat, logs or GitHub.
4. An MU plugin intercepts WordPress HTTP and WordPress email, but PHP using raw \`curl\` can bypass the WP HTTP filter. For fully safe custom-plugin mutation tests, verify host-level outbound traffic restrictions or use the enclosed **Docker internal-only** local environment. If that is not possible, do not run a plugin path that might make a live external request.
5. Validate no production integration traffic using safe testing domains only, e.g. \`example.invalid\`. Do not probe actual production services, customer emails or payment processors.
6. Do not connect staging to Netlify deployment previews. They may still use production Supabase by default. Staging must not use a real Supabase project at all until a separate fake-data project and explicit approval exist.

### Phase C: fictional fixtures and testing

After passing the isolation gate, install only the specific custom plugin candidates on staging using authorized copies:
- GitHub client storefronts code v0.1.3 (two reviewed plugin files), with optional separate copy of v0.1.2 for before/after testing. Do not overwrite either in production.
- Custom WC SKU Builder Manager and SkyVerge generator, if the code can be reviewed for external calls and safely copied. Keep third-party licenses and activation concerns isolated; do not share licensed plugin archives publicly.
- Woo core shipping methods; Advanced Free Shipping only if authorized and safe to install from its licensed source. Do not upload production settings/coupons.

Set up fictional tests:
- Product variations: Brand / Style / Color / Size and stable variation IDs; SKU creation on product save, variation save, AJAX, REST publish and batch rebuild; record callback ownership without rewriting real IDs.
- Rates: $199.99, $200.00, $200.01 merchandise totals with and without fictional coupons; WA ZIP and out-of-zone addresses; normal clothing, heavy, no-class, free team distribution and mixed shipping classes; compare real displayed rates against desired policy.
- Client storefront v0.1.2 versus v0.1.3: correct product category, related-product cards, recently viewed widget, draft/preview, all four template variants, desktop/mobile and checkout handoff. No real transactions.
- Any sample order creation must occur **only** after isolation certification, with fake accounts and payment gateways disabled. Shipping quote testing normally does not require placing an order.

### Phase D: isolation verification record

Write \`docs/wordpress-audit/STAGING_ISOLATION_ATTESTATION.json\` with:
- \`environmentType\`: \`"fresh-siteground"\` or \`"local-docker"\`;
- \`siteUrl\` (no credentials), \`createdAt\`, \`checkedBy\`, \`extraHostingChargeUSD\` (verified amount, \`0\` only if genuinely confirmed);
- \`privateAccessProtected\`, \`separateDatabase\`, \`fictionalDataOnly\`, \`wpCronDisabled\`, \`paymentsDisabled\`, \`mailDisabled\`, \`webhooksDisabled\`, \`externalHttpBlocked\`, \`supabaseDisconnected\`, \`productionSecretsAbsent\`, \`carrierPurchasesDisabled\`, \`safeToRunFictionalWrites\`;
- \`verificationEvidence\` references without passwords/private data;
- \`remainingRisks\` for unverified raw cURL egress, plugin updates, WP webhook or scheduler behavior.

**Do not mark safeToRunFictionalWrites=true unless every applicable isolation condition has direct verified evidence.** Otherwise remain read-only and document the blocker.

### Phase E: findings and release gate

1. Commit only sanitised test setup scripts and fixture results; no \`.env\`, passwords, production database dump, API keys or customer data.
2. Save staging SKU and checkout observations under \`docs/wordpress-audit/staging-results/\`. Never auto-deploy the staging site back to production. SiteGround's **Full Deploy** can overwrite the live DB including orders, so this workflow explicitly prohibits that button.
3. Create a GitHub PR for proposed changes to WordPress plugin code and SKU rebuild security, **separate from the staging infrastructure PR**.
4. Require an explicit owner approval for each **production** modification: coupon restrictions, shipping rule changes, SKU plugin activation, SKU rebuild, Client Storefronts 0.1.3 installation. The owner has confirmed the 100% free-shipping coupon is intentional; it must be preserved.

## Local fallback (no hosting fee; private to workstation)

The repository includes \`staging/wordpress/compose.yaml\`, \`bootstrap.sh\`, \`mu-plugins/00-sc-fictional-safety.php\` and \`fixtures/seed.php\`.
On a workstation with Docker Desktop, Docker Compose, curl, unzip and OpenSSL:

\`\`\`bash
cd staging/wordpress
bash bootstrap.sh
\`\`\`

This downloads a pinned WooCommerce ZIP from WordPress.org **before** starting private containers, generates **local, gitignored staging-only credentials**, creates a fictional WordPress shop and inserts safe sample products and shipping methods. Docker's \`internal: true\` network prevents external network egress from the app containers; WordPress is bound to \`127.0.0.1:8088\` only. It is **not accessible to the cloud browser** or other devices without explicit and separately approved private access.

Docker is **not installed in the current ChatGPT code environment**, so the compose boot has **not** been executed or certified. CI checks syntax and safety markers only.

## Work handback

Once Work has truly created and isolated the fresh SiteGround site, report the non-secret URL, extra hosting costs (confirmed), safety gates and blocker list. If only the GitHub fixture is ready, say **staging prepared but not deployed**. Return the results to the original chat before executing any live production remediation.
