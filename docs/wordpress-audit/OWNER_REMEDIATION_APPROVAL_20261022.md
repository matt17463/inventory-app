# Skilled Crafting — WordPress Commerce Remediation Decision & Approval Pack

**Prepared:** October 22, 2026
**Evidence:** Work's read-only findings, merged [PR #106](https://github.com/matt17463/inventory-app/pull/106); read-only application [PR #105](https://github.com/matt17463/inventory-app/pull/105).
**Live state:** No WordPress settings, product SKUs, Woo orders, Supabase inventory, coupons or checkout rates were changed by the audit.
**Approval status:** **COUPON INTENT CONFIRMED; OTHER REMEDIATION AWAITING OWNER APPROVAL.** This is an implementation plan and diagnostic-documentation update, not permission to modify production.

## Priority decisions (business owner)

| Decision ID | Question | Recommendation | Risk if deferred | Explicit approval |
|---|---|---|---|---|
| C1 | Is the published 100% discount/free-shipping coupon intentional? | **Owner confirmed intentional. Keep the coupon and its free-shipping behavior unchanged.** Document intended audience and optional safeguards separately, without assuming limited eligibility. | Broad eligibility still warrants periodic confidential review; **no misuse observed** | **Intent confirmed; no change authorized** |
| S1 | Which transactions should get free fulfillment? | Distinguish **ordinary shipped merchandise** from free **organization/team distribution**. Prefer one ordinary free-shipping engine at **>= $200** based on **discounted, tax-exclusive merchandise subtotal**, with free-shipping coupons only as deliberately authorized exceptions. | Tax/coupon/exactly-$200 discrepancy and possible unexpected method offerings | Approve policy / Propose alternate basis |
| S2 | Should paid/expedited rates stay available when a free shipping option exists? | Preserve choices until staging shows how pickup/expedited methods interact. Decide after fixture results, not by blindly enabling Hide other rates. | Duplicate/confusing shipping choices | Decide after staging |
| S3 | Should Heavy-class fallback have a positive shipping cost or no standard shipping? | Decide explicit national/fallback Heavy fee or carrier quote/manual approval. Keep intentional zero-cost Spirit Wear/Uniform organizational delivery only in eligible fulfillment channels. | A source-derived potential $0 fallback path for Heavy; no undercharge proven | Approve explicit Heavy policy |
| K1 | What owns newly created SKUs and existing SKUs? | Preserve current existing IDs and SKU values until a staged authoritative rule has passed all save paths. Prefer a single canonical creator across app and Woo, with **no silent rewrites of nonempty SKUs**. Custom builder is closest to desired human-readable scheme but **not safe to declare sole authority yet**. | Competing custom/SkyVerge writers; possible rewrites and blank mapping divergence | Approve preservation policy / Approve proposed target schema |
| F1 | May we stage/test the 0.1.3 Client Storefronts two-file change? | Approve staging acceptance and a rollback rehearsal, **not a production update**. New 0.1.3 code restricts client product recommendations and recent-history display; no cross-client leak observed. | Missing defense-in-depth context filtering | Approve staging only |
| E1 | May Work build an isolated test environment? | Prefer a **fresh, private fictional-data WordPress fixture** over copying live customer data. Isolate network, email, payments, webhooks, Netlify, Supabase and carrier accounts before enabling. | Cannot safely validate SKU saves, checkout calculations, plugin upgrade, or rollback | Approve scoping/cost cap only |

## Confirmed evidence versus unknowns

**Storefront:** Installed active v0.1.2 PHP and CSS were visually read by Work and compared with repository v0.1.3. Missing v0.1.3's client product context resolver, related-item category filtering, body class, recently-viewed suppression and scoped stylesheet loading. Existing QA draft related products happened to remain inside the client's category; **no leakage observed**. Actual checkout, four templates, different categories, and mixed cart require staging.

**SKU:** Two enabled hook writers are present: custom WC SKU Builder Manager and SkyVerge. WP Wham plugin is active but its **internal generation toggle was OFF** when inspected. The custom builder overwrites existing SKUs, does direct post-meta writes and offers a state-changing GET rebuild without a nonce; SkyVerge has a mismatched callback method spelling in one path. App Mockup Studio publisher supplies a separate deterministic REST SKU scheme. No actual save race or data corruption demonstrated. A 50-row Woo sample had 0 blank/duplicate SKUs; it is not exhaustive.

**Shipping:** Core free shipping both zones: >= 200 of **displayed tax-exclusive subtotal after discount**, OR eligible free-shipping coupon. Advanced Free Shipping extension: **exactly 200 tax-inclusive pre-discount subtotal** and applies a separate zero-cost rate. Both hide-other-rates switches OFF. Base flat rate 0 but clothing/drinkware/no-class classes have nonzero fees, while Spirit Wear distribution intentionally zero and fallback Heavy blank can allow zero. **No checkout rates observed.** Published C1 coupon is 100%, broadly configured and free-shipping enabled; **no abuse observed**.

**Staging:** SiteGround's selected production installation shows no existing staging copies. No isolation was certified and no test orders, save actions or payment/label purchases were performed.

## Proposed sequence (gated; do not skip)

### Gate 0 — Coupon intent confirmed; preserve business policy

1. **Owner confirmed the 100% coupon is intentional.** Preserve its discount and free-shipping behavior without change. Keep redemption details private; do not paste coupon codes, customer information, or secret redemption links into chat or documentation.
2. Audience, access limitations, expiry, and usage policy were **not** confirmed by that answer. Review them confidentially with the owner at the next scheduled policy review, without changing current settings.
3. Do **not** expire, restrict, disable, delete, or silently remove the free-shipping flag. Any later policy change needs separate specific owner approval.

### Gate 1 — Isolated staging authorization

1. Confirm SiteGround plan entitlement/storage/cost; approve a staging URL or private host and allowable expense **before creation**.
2. Prefer new Woo/WordPress fixture with fictional customers/products. If cloning is chosen, avoid copying customer information if possible and isolate before first boot.
3. Stop outgoing SMTP/HTTP at an effective boundary, disable existing WP cron/Action Scheduler until queues inspected, replace production payment gateways/SMTP/webhooks/Supabase/QuickBooks/Square/R2/EasyPost/USPS credentials with test stubs, restrict indexing and anonymous access, and assert all external destinations are nonproduction.
4. Validate isolation with a harmless probe and no real external recipients. Only then authorize *fictional* product save and cart quote tests. Production Netlify deployment previews are **not** isolated staging by default.

### Gate 2 — Read-only WordPress plugin diagnostic correction (prepared separately)

Update app-side canonical basename aliases for exact installed folders:
- \`skilled-crafting-client-stores\` → storefront identity
- \`wc-sku-builder-manager-v3-clean\` → custom SKU builder identity

Keep original basename evidence, label WordPress plugin enabled versus internal SKU generator enabled separately, test both aliases. This improves reporting only; cannot designate the winning SKU writer. Can be deployed without touching Woo records after CI and owner release approval.

### Gate 3 — Security hardening before any bulk SKU rebuild

Implement a staging-tested admin **POST + nonce** operation for the custom SKU builder. Require the existing \`manage_woocommerce\` capability, strict batch-size validation, explicit dry-run/preview, dedupe/idempotent resume, and audit trail. No state-changing GET auto-advance. Confirm no incorrect direct-meta lookup/cache drift, check nonempty-SKU preservation and failure/rollback. Also correct SkyVerge callback spelling only through an authorized patch path; third-party plugin code should not be silently modified in production.

### Gate 4 — Canonical SKU writer and mapping

1. Decide whether the business wants immutable SKU after creation (recommended) and specific brand/style/color/size/variation identity format.
2. Stage separate new parent, child variations, single save, Woo AJAX variation edit, bulk, explicit rebuild, and Mockup Studio REST publish.
3. Record before/after ID + SKU, Woo lookup, Supabase normalized product, blank link, reservations, open demand, fictional pull sheet, refunds and existing order provenance.
4. Only after pass, consider changing plugin settings/disable redundant generators one at a time in a low-traffic approved window; preserve IDs and historical order keys. Execute Woo sync and blank-master linkage checks as independent controlled phases.

### Gate 5 — Shipping policy simulation and proposed safe simplification

1. Confirm owner policy C1/S1/S2/S3. Distinguish ordinary carrier shipping from free club/team distribution (and whether only local/offsite group drop-off).
2. Stage exact comparison of 199.99/200/200.01 pre-/post-discount, taxable/non-taxable, free-shipping coupons, local/out-of-zone/missing address, no class/Clothing/Drinkware/Spirit Wear/Uniform/Heavy/mixed/no-class. Include classic & Blocks checkout and multiple package handling.
3. Capture every offered rate, shipping tax, selected default, effective total, coupon validity and no-class/blank-class fallback. Compare **existing** and **candidate** policies.
4. Proposed normal behavior: core free shipping **>= $200** after discounts and excluding shipping taxes, with authorized coupon exceptions only; remove/disable redundant exact-equality extension rule only after staging. Keep intentional club fulfillment exceptions, and set a policy for blank Heavy fallback; do not automatically set it to zero or a guessed price.
5. Stage customer-safeguard regressions before separately approved production changes; preserve carrier label accounting as unrelated to Woo rate settings.

### Gate 6 — Plugin 0.1.3 update, if approved after staging

1. Back up deployed PHP/CSS together and WordPress plugin metadata; no full database overwrite after orders can change.
2. Stage four templates, client category and descendants, related/cross-category products, recently-viewed widgets, REST store validation, authorized draft preview, cart/mixed cart, block & classic checkout, directory shortcode, mobile and permissions.
3. If pass, schedule an owner-approved production update of **only the two reviewed plugin files**, purge cache intentionally, smoke-test public storefront and rollback both files together on failure.

### Gate 7 — Release/rollback evidence

- No mutations without clearly specified owner approval, change window and identified operator.
- Test before/after with fictional records; separate customer data from staging.
- Record all applied settings, order mapping audits, reversible changes, error alerting, and staging screenshots stripped of customer/secret content.
- Update Application Guide and employee training, then regenerate PDF; do not label full operational validation if any gate lacks evidence.

## Owner approval: suggested reply

> I approve **read-only diagnostic corrections and preparing an isolated staging plan**. I do not authorize live WordPress changes, coupon edits, SKU regeneration, shipping-rate updates, order modifications or label purchases. The 100% coupon is intentional and must remain unchanged. I will separately confirm free team distribution, the ordinary $200 shipping threshold, and whether an isolated test site may be created within an agreed budget.

Or specify individually: **C1, S1, S2, S3, K1, F1, E1**. The assistant must not infer consent to other workstreams from one approved category.

## Planning estimates

Work estimated ~12–24 engineering hours for isolation and selected acceptance tests **before remediation**, not a fixed quote. Existing SiteGround staging may be covered by the owner's plan but entitlement/space and real incremental cost were not verified. No service was purchased.

## Supporting source reports

- [Work summary](COMMERCE_INTEGRITY_WORK_RESULTS_20261022.md)
- [Installed code comparison](STOREFRONT_DEPLOYED_CODE_COMPARE.md)
- [SKU callbacks and security](SKU_WRITER_OWNERSHIP.md)
- [Checkout rule and class matrix](SHIPPING_RULE_VERIFICATION.md)
- [Isolated staging scope](COMMERCE_INTEGRITY_STAGING_PLAN.md)
- [Completion status](COMMERCE_INTEGRITY_HANDOFF_COMPLETE.json)
