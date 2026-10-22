# Skilled Crafting — WordPress commerce integrity preflight

**Status:** Safe read-only review shipped with inventory application; actual production settings remain unchanged.

**Observed baseline:** Authorized WordPress browser audit from 2026-10-22, PR #103. Live values can differ. Open **Tools & Admin → WordPress Commerce Integrity** and click **Run read-only checks** for fresh limited REST evidence when permissions allow.

## 1. Client Storefronts deployment-version gate

| Evidence | Last-audited value |
|---|---|
| WordPress installed Client Storefronts plugin header | 0.1.2 |
| GitHub companion plugin header | 0.1.3 |
| Full deployed-file comparison | NOT DONE |
| Real WordPress REST publishing and shopper checkout | NOT END-TO-END VERIFIED |

**Safe resolution:** request a read-only copy of the installed plugin folder in an authorized maintenance environment (without credentials or logs), compare PHP/CSS/API routes against `wordpress/skilled-crafting-client-stores/`, document changes and rollback steps, back up WordPress, and stage a fictional store/category/draft/checkout fixture. Do not install 0.1.3 on production solely to make the headers match.

## 2. SKU writer precedence gate

Known active candidates in the 2026-10-22 inventory: **WC SKU Builder Manager 2.4.0-batched-no-save-timeout-fix**, **Product SKU Generator for WooCommerce 2.5.1**, **SKU Generator for WooCommerce 1.6.6**. This does **not** prove all three write the SKU on the same save.

Before authorizing changes:

1. Inspect source/hooks and current plugin settings under administrative read-only access to determine which writes on new product, variation create, single product save, and bulk rebuild.
2. Choose one authoritative schema. Collect a staging fixture with at least one parent, four garment colors, all supported sizes and overlapping adult/youth sizes.
3. Record Woo product/variation IDs, SKU, size/color/brand attributes, variation status, blank-product link, currently reserved demand and any open orders *before* the operation.
4. On staging, exercise each of the four write pathways and compare identity/values. Ensure no SKU collisions/overwrites and that unrelated Woo orders still match the originally purchased item.
5. **Separate gates:** SKU generation does not by itself update Supabase. Woo product sync must be run and validated separately, then blank master relinking checked separately. Inspect one fake pull sheet as a final acceptance test.
6. Approve a production change only after rollback and audit procedures are tested.

The in-app Woo sample is *not* exhaustive: up to 25 parents plus at most three sampled groups of variations. Counts contain no SKU names or product prices.

## 3. Shipping method matrix (staging only)

WordPress audit observed Kitsap County core free-shipping minimum **$200 OR coupon** and a separate Advanced Free Shipping rule labelled **Spend $200 get free shipping!**. Core flat-rate uses shipping-class pricing and is taxable; different zones and extensions can override details.

| Cart total | Coupon | Zone | Shipping class | Staging expectation |
|---|---|---|---|---|
| $199.99 | No | Kitsap County | None | Record *actual* eligible methods, not a guessed free-shipping result |
| $200.00 | No | Kitsap County | None | Record actual methods and displayed totals |
| $200.01 | No | Kitsap County | None | Compare threshold behavior and VAT/sales-tax calculation |
| $199.99 | Yes | Kitsap County | None | Record coupon-specific eligibility; no assumption about discount timing |
| $200.00 | Yes | Kitsap County | Multiple classes | Check highest-class/per-order logic |
| $200.01 | No | Kitsap County | Multiple classes | Check class cost interaction |
| $199.99 | No | Outside Kitsap County | None | Verify address-to-zone matching and fallback methods |
| $200.00 | Yes | Outside Kitsap County | Multiple classes | Verify extension rules do not leak to wrong zone |
| $200.01 | No | Unmatched postcode | None | Verify default/no-matched-zone behavior |

Repeat each applicable case with taxable/non-taxable items and any free-shipping coupons actually enabled. Save a sanitized record: fixture ID, **zone**, items/classes, discounted cart subtotal, shipping methods offered, rates, tax, final checkout amount, and the core + extension rule expected to apply. No real payment, test purchase or customer email.

## 4. Validation boundaries

The server endpoint `/.netlify/functions/wordpress-commerce-integrity` is **GET-only and manager/admin authenticated**, and makes **GET-only** WordPress and WooCommerce REST calls. It reads plugin metadata when the WordPress Application Password has permission, at most eight shipping zones/methods and a bounded product/variation SKU sample. It never saves methods or computes a real cart rate.

**Unavailable is not PASS.** The WordPress plugin-list API may return 403 for a shop manager, and SiteGround's security challenge may block even correct read-only credentials. Do not disable security or request elevated credentials merely to improve a report.

### Final approval before operations changes

Owner should sign off on **(a)** plugin deployed-code comparison, **(b)** one authoritative SKU writer and staged identifier/pull-sheet test, **(c)** shipping fixture matrix with confirmed desired cart totals, and **(d)** backup, audit logs, rollback and low-risk launch window. Nothing in this preflight constitutes approval to update live WordPress or Supabase.
