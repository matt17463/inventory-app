# ChatGPT Work: WordPress Commerce Integrity deep audit and staged acceptance review

**Project:** Skilled Crafting WordPress + WooCommerce operational integrity
**Website:** https://skilledcrafting.com (WordPress administrator through authorized Work browser)
**Application:** https://inventory.skilledcrafting.com/wordpress-integrity (or current canonical Skilled Crafting app URL; confirm redirect rather than assuming)
**Source repository:** https://github.com/matt17463/inventory-app
**Source starting point:** \`main\` at commit \`7233f968e40ffd159d4142d5a1aff418ad8b423e\`, as of 2026-10-22; refresh branch HEAD when starting
**Handoff branch:** \`handoff/wordpress-commerce-integrity-audit-20261022\`
**Requested action:** Perform **safe browser/code/configuration checks**, produce actionable recommendations and sanitized evidence. **Do not change production plugin settings, SKUs, shipping rates, products, orders, payments, Supabase inventory or publish customer storefronts.**

## Source documents to review first

- \`docs/wordpress-audit/COMMERCE_INTEGRITY_PREFLIGHT.md\` — staging acceptance matrix and approval gates
- \`docs/wordpress-audit/operations-integrity.md\` — partial October 22 WordPress audit findings
- \`docs/wordpress-audit/AUDIT_COMPLETE.json\` — actual browser-audit scope and known gaps
- \`src/application-guide/commerceIntegritySnapshot.json\` — dated baseline, **not live proof**
- \`netlify/functions/wordpress-commerce-integrity.js\` — currently deployed manager-only GET diagnostics
- \`wordpress/skilled-crafting-client-stores/\` — GitHub companion plugin version 0.1.3

## Most recent user screenshot evidence: 2026-10-22 10:44–10:45 AM (PT)

The user ran **Tools & Admin → WordPress Commerce Integrity → Run read-only checks** and shared two screenshots.

1. Plugin: WordPress REST returned **"Not confirmed"** for the current Client Storefronts installed version. Historical WordPress browser audit found **0.1.2** installed; GitHub PHP header **0.1.3**. Lack of REST plugin-list capability must not be mistaken for absence or mismatch.
2. SKU writers: live integrity screen listed **2 possible active candidates**:
   - **Product SKU Generator for WooCommerce 2.5.1**
   - **SKU Generator for WooCommerce 1.6.6**
   Earlier WordPress audit listed **WC SKU Builder Manager 2.4.0-batched-no-save-timeout-fix** as another active candidate. Investigate whether the plugin is disabled/renamed, missing from REST enumeration, or has no recognized slug; do **not** assert it is inactive without admin inventory/code proof.
3. SKU sample: **50 products and variation records** checked, **0 without SKUs**, **0 duplicate SKU values**. This is good but is **only a bounded sample**, not an exhaustive catalog uniqueness/overwrite test.
4. Shipping: **2 zones** returned; **both** had two enabled methods:
   - Zone **"Locations not covered by your other zones"** (Woo fallback): Flat rate (\`flat_rate\`), base cost **0**; Free shipping (\`free_shipping\`), qualifier **either** (minimum order amount OR coupon), minimum **200**.
   - Zone **"Kitsap County"**: Free shipping (\`free_shipping\`), qualifier **either**, minimum **200**; Flat rate (\`flat_rate\`), base cost **0**.
   - The existing **Advanced Free Shipping** extension has a separate rule titled **"Spend $200 get free shipping!"**; core Woo shipping REST **does not necessarily expose** those extension conditions.
   - **WARNING:** $0 flat-rate **base** does NOT necessarily mean customers pay $0: classes and no-class fees may add a charge, and the audit mentioned highest shipping-class cost and taxable status. Do not claim an active free-shipping bug without verifying cart-rate calculation.
   - **No checkout totals were calculated** by this diagnostic.

## Workstream A — Client Storefronts 0.1.2 / 0.1.3 code equivalence

1. Use an authorized WordPress browser to verify installed plugin exact name, version, active state and any WordPress/host update message.
2. Obtain the **installed plugin code** using a safe, authorized, read-only method (WordPress admin plugin editor only if allowed/read-only, supported SiteGround File Manager/backup, or other authorized connector). Never expose passwords, Application Passwords, \`.env\`, wp-config, session cookies or unrelated site files. If code is inaccessible, document precisely which access is missing.
3. Compare only this plugin against \`wordpress/skilled-crafting-client-stores/\` in GitHub. Distinguish header-only change from actual REST routes, permissions, branded templates, checkout context, category isolation, shortcodes and page rendering differences. Produce a high-level file/function diff, impact/risk assessment, update prerequisites, rollback and staging test requirements.
4. Inspect a safe existing QA draft and WordPress public storefront/category view **without publishing** or changing live content. Verify observed behavior and do not claim a successful new storefront publication or checkout unless previously documented evidence actually exists.
5. **Do not update 0.1.2 or install 0.1.3 on live WordPress.** If an update appears necessary, write an approval-ready remediation plan.

## Workstream B — Determine SKU generation ownership and avoid collisions

1. Inspect **Plugins → Installed Plugins**, active statuses and settings for all three historical SKU-generator candidates, including WC SKU Builder Manager. Verify names, current versions and activation status independently of the bounded REST diagnostic.
2. Where read-only plugin code is available, inspect registered WordPress/Woo hooks/filters/actions for (a) new product creation, (b) variation creation, (c) single product save, (d) Woo bulk edits, and (e) explicit batch SKU regeneration; identify precedence/callback priority and possible overwrites. State unknowns rather than inferring hook ownership from active plugin names.
3. Determine which SKU builder aligns with the existing Skilled Crafting schema (Brand / Style / Color / Size + variation ID suffix) and which was intended to be canonical. Document identifiers and effects on already-placed Woo orders and blank-master links.
4. Sample known product/variation records read-only without exposing customer data. Keep the previous 50-record / 0-missing / 0-duplicate result as **sample evidence only**. Prefer a complete read-only inventory export/scan for SKU collisions if allowed and suitably bounded; do not run any writes, batch relinks, Woo sync, repair or SKU rebuild.
5. Evaluate WooCommerce product/variation → Supabase sync and blank inventory pairing as separate concerns. **Never imply a SKU rebuild automatically syncs or relinks inventory.**
6. If an isolated staging site is ALREADY available and authorized for safe test writes, use fictional products for 4-path SKU tests, log before/after versions and effects, then clean up staging only. **Do not create/deploy a new staging website, incur service costs, or copy live personal customer records without explicit owner approval.**
7. Recommend the single authoritative writer **only if evidence suffices**; otherwise state concrete unresolved decisions and exact next approval needed. Do not deactivate live plugins.

## Workstream C — Shipping costs and overlapping free-shipping conditions

1. In WP Admin → WooCommerce → Settings → Shipping, inspect the **real current settings** of both zones, all enabled core shipping methods, free-shipping coupon/minimum handling (before/after discount), flat-rate base amount, shipping class rate matrix, no-class cost, class calculation mode, tax, and address-to-zone rules. Record numbers and exact labels safely.
2. Inspect **Advanced Free Shipping** plugin's current rules/conditions separately, including whether the rule is active, exact qualifying totals, coupon restrictions, shipping classes, destinations, visibility, priority and how it coexists with Woo free shipping.
3. Explicitly evaluate the question **"Can a <$200 cart be offered a $0 selectable flat rate?"**. Be careful: flat-rate base $0 may still produce positive totals from shipping-class costs. Use read-only configuration evidence first, distinguishing confirmed behavior, likely behavior and unknowns.
4. Use an already-authorized **staging or nonproduction checkout** if available, with fictional products and sample carts at **$199.99, $200.00 and $200.01**, with/without coupon, local Kitsap vs outside-zone address, no shipping class vs one/mixed classes, and applicable tax. Record cart subtotal, discounted subtotal, matching zone, displayed methods/rates and total. **Do not place real orders, charge cards, create refunds, buy postage, mail customers or update live shipping rates.**
5. If staging is not available, record untested cart combinations and a proposed safe fixture plan; do not infer success or invent amounts. An unsent exploratory cart on the live site should be avoided unless the user separately authorizes that limited action.
6. Distinguish Woo customer checkout charges from USPS Click-N-Ship/EasyPost postage purchases in the Skilled Crafting Work Hub. Shipping method eligibility is NOT proof the label was bought, parcel was sent, or package was delivered.
7. Produce a proposed simplest safe shipping configuration, *including known risks and before/after expectations*, but do **not** apply it.

## Required deliverables and GitHub workflow

Do not overwrite the earlier completed WordPress audit. Add:
- \`docs/wordpress-audit/COMMERCE_INTEGRITY_WORK_RESULTS_20261022.md\`: executive summary, what was inspected, confirmed facts, exact remaining unknowns, recommended actions ranked, cost/time/safety implications.
- \`docs/wordpress-audit/STOREFRONT_DEPLOYED_CODE_COMPARE.md\`: actual deployed-versus-repo code/version comparison or precisely stated evidence blocker.
- \`docs/wordpress-audit/SKU_WRITER_OWNERSHIP.md\`: plugin status/hooks/settings matrix, identified authority vs unknown, SKU sample scope, Woo↔Supabase mapping/blank relink risk and no-write staging acceptance tests.
- \`docs/wordpress-audit/SHIPPING_RULE_VERIFICATION.md\`: per-zone core methods and cost/class tables, Advanced Free Shipping rule matrix, test fixtures and **confirmed vs inferred vs untested** conclusions.
- \`docs/wordpress-audit/COMMERCE_INTEGRITY_HANDOFF_COMPLETE.json\`: \`status\` = \`complete\` if all A/B/C read-only inspections performed, else \`partial\`; \`completedAt\`, \`reviewedBy\`, \`sources\`, \`confirmedFindings\`, \`remainingBlockers\`, \`stagingFixturesPerformed\`, \`productionWritesPerformed:false\`, \`reportPaths\`. Never claim end-to-end verification without test evidence.
- Optional privacy-redacted screenshots stored in a **private documentation location**, not public web assets. Do not publish screenshots with customer names, orders, financial data, login cookies, addresses or API credentials.

**Preserve source-data distinctions**: plugin header only vs actual installed PHP, detected hooks vs tested effect, Woo method configuration vs observed checkout rates, sample SKU scan vs exhaustive uniqueness.

Create a **GitHub pull request** with reports and any documentation corrections (not production configuration changes); run relevant tests and guide/PDF validation, avoid Netlify preview deployments. Merge only with authorization under normal repo policy. If you cannot access live installed plugin code or staging, file precise evidence blockers rather than guessing.

## Completion instruction (MANDATORY)

When Work finishes, explicitly tell the user in the Work chat:

> WordPress Commerce Integrity review is [complete / partially complete]. Please return to your original Skilled Crafting ChatGPT conversation and say: **"Work finished the storefront, SKU and shipping integrity checks. Review the results and prepare the approved remediation steps."** Here is the GitHub pull request: [link]. Outstanding issues: [concise list].

The original conversation will review Work's evidence and implement only **owner-approved**, regression-tested changes. This handoff is a diagnostic task, not permission to change production.
