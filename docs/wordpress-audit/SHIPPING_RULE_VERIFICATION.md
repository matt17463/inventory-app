# Shipping rule verification

Reviewed 2026-10-22. **Configuration and installed calculation code verified; no cart-rate or order transaction test performed.** Dollar amounts below are USD configured costs before shipping tax, not customer quotes.

## Sources and boundaries

Inspected both live Woo shipping zones and enabled method dialogs, shipping classes/product counts, General/Shipping/Tax settings, the published Advanced Free Shipping rule and extension switches, the published coupon's eligibility controls, installed Woo flat-rate/free-shipping/legacy-cart code, and installed Advanced Free Shipping method/subtotal/comparison code. No settings were changed, coupons applied, addresses entered into a cart, or checkout totals calculated. Existing configuration editor forms were exited without saving.

The application GET diagnostic was refreshed at 11:21:43 AM Pacific on 2026-10-22: two zones, each with enabled Flat rate and core Free shipping, base 0 and minimum 200/either. Its response omits class matrices, discount handling and extension conditions, so it is not sufficient on its own for this review.

## Destination and global settings — confirmed

- Currency: USD. Selling countries: **United States only**. Shipping: **all countries you sell to**. The fallback label “Rest of the world” does not mean international ordering is enabled.
- Explicit zone **Kitsap County**, ID 1, appears before fallback ID 0. Region selector shows **Everywhere**, narrowed by these entered postcodes:

```text
98110 98301 98311 98312 98314 98337 98322 98337 98340
98342 98345 98346 98353 98359 98364 98366 98367 98370
98378 98061 98380 98315 98383 98384 98386 98392 98393
```

There are 27 entries and 26 unique values; `98337` is repeated. No wildcards/ranges were entered. The duplicate appears redundant, not evidence of a second charge. The zone name is a human label, not a county boundary engine; owner should validate the explicit coverage list. No assertion is made about whether a particular postcode belongs to the intended county.

- Fallback is **Rest of the world / Locations not covered by your other zones**, ID 0, for destinations not matched above within permitted selling/shipping countries.
- Shipping calculator: on. Hide costs until address entered: on. Default destination: billing address. Force billing-only: not selected. Shipping debug: off. Core **Hide shipping rates when free shipping is available: off**.
- Taxes: on; catalog prices entered excluding tax; tax based on **shop base address**; shipping tax class based on cart items; per-line tax rounding (subtotal rounding off); shop and cart displays exclude tax; totals shown as one total. Rate-table entries and actual address/item tax outcomes were not tested. Tax setup requires separate owner/accounting policy confirmation rather than a jurisdictional assumption.

## Per-zone core methods — confirmed

| Zone | Method order | Enabled methods | Core free qualification | Minimum | Ignore discounts? | Flat base | Tax status | Class calculation |
|---|---|---|---|---:|---|---:|---|---|
| Kitsap County | Free shipping, Flat rate | Both Yes | `either`: minimum OR a valid free-shipping coupon | 200.00 | No: “Apply minimum order rule before coupon discount” unchecked | 0.00 | Taxable | Per order: highest shipping-class cost |
| Fallback | Flat rate, Free shipping | Both Yes | `either`: minimum OR a valid free-shipping coupon | 200.00 | No: same unchecked control | 0.00 | Taxable | Per order: highest shipping-class cost |

Method order is not proof of the selected checkout default. Saved session preference, package rates and third-party filters can affect the offered/selected result.

### Flat-rate class cost matrix — confirmed

| Class / term ID | Slug | Kitsap | Fallback | Product count shown | Intended purpose shown |
|---|---|---:|---:|---:|---|
| Clothing / 101 | `clothing` | 7.50 | 8.00 | 31 | “2 lb” |
| Drinkware / 102 | `drinkware` | 8.75 | 9.25 | 1 | “3lb” |
| Heavy / 128 | `heavypackages` | 12.00 | **blank** | 0 | Large orders requiring shipping |
| Local Stock / 146 | `local-stock` | 2.00 | 3.00 | 0 | Locally stocked items with reduced shipping |
| Spirit Wear Campaign / 138 | `spirit-wear-campaign` | **0.00** | **0.00** | **81** | Free shipping during an active campaign; delivery to students'/athletes' organization for distribution |
| Sublimated Uniforms / 129 | `sublimated-uniforms` | 12.00 | 12.00 | 0 | Shipping/handling after program cutoff |
| Uniform Bulk Order / 117 | `uniform-bulk-order` | **0.00** | **blank** | 0 | Free delivery when placed by team cutoff |
| USPS Mail / 328 | `usps-mail` | 1.00 | 1.00 | 0 | Mail shipments |
| No shipping class | not a term | 8.00 | 10.00 | Not established | Fallback for products with no assigned class |

The 81 campaign assignments make the zero-cost exception operationally relevant. A no-class fee does **not** automatically cover a product whose assigned class has a blank rate.

### What the installed core algorithm means — source-confirmed, checkout untested

`woocommerce/includes/shipping/flat-rate/class-wc-shipping-flat-rate.php`, `calculate_shipping()`:

1. A nonempty base cost, including the string `0.00`, marks the rate as configured and starts the cost at zero.
2. It groups shippable package items by shipping class. It uses the class's specific cost when assigned, and **no-class cost only for genuinely classless items**.
3. A blank class-cost string is skipped. It does not substitute the no-class fee for that assigned class.
4. With calculation type `order`, it adds the highest evaluated class cost, rather than summing all class costs, then registers the rate when costs are configured. Calculation is invoked per shipping package, even though the UI says “Per order.” Package splitting needs its own test.

**Answer to “Can a <$200 cart be offered a $0 selectable flat rate?”** The reviewed core logic and current class matrix permit it for an otherwise eligible shippable package containing only zero-cost classes. They also permit it in the fallback zone for a package containing only a blank-cost Heavy or Uniform Bulk Order class, because base `0.00` still enables the rate. No minimum-spend condition exists on this flat-rate method. This is a code/configuration-supported path, **not an observed checkout quote**; availability filters, package splits and other integrations may change the final offer.

For Spirit Wear Campaign, free organization distribution is explicitly documented in the class description, so a sub-$200 zero rate is **not automatically an error**. The blank fallback Heavy cost is an owner-policy gap with zero currently assigned products in the class view; it is not proof an existing customer was undercharged. The same applies to the blank fallback Uniform Bulk Order fee unless free organization delivery is the intended policy.

For comparison, source-derived single-package pre-tax flat costs are:

| Package contents | Kitsap | Fallback | Basis |
|---|---:|---:|---|
| No class only | 8.00 | 10.00 | No-class fee |
| Clothing only | 7.50 | 8.00 | Clothing fee |
| Drinkware only | 8.75 | 9.25 | Drinkware fee |
| Clothing + Drinkware | 8.75 | 9.25 | Highest class, not sum |
| No class + Drinkware | 8.75 | 10.00 | Highest of no-class and drinkware |
| Spirit Wear Campaign only | 0.00 | 0.00 | Intentional zero class |
| Spirit Wear Campaign + Clothing | 7.50 | 8.00 | Highest class charges the whole package |
| Heavy only | 12.00 | 0.00 **inferred risk** | Fallback assigned class is blank; configured zero base remains |
| Uniform Bulk Order only | 0.00 | 0.00 **inferred** | Explicit local zero; fallback blank with zero base |

These are arithmetic expectations from inspected source/configuration, excluding taxes and runtime filters. They are not staged test results.

## Core free-shipping threshold and coupon behavior

Installed `free-shipping/class-wc-shipping-free-shipping.php`, `is_available()` uses the cart's **displayed subtotal**. With `ignore_discounts=no`, it subtracts coupon discounts (and discount tax if prices display including tax), rounds to currency decimals and checks **>= 200**. A valid coupon with its **Allow free shipping** flag also qualifies because both zones use **OR**. Given this site's tax-exclusive cart display, the core threshold is based on displayed tax-exclusive subtotal after discounts, subject to filters.

The only published coupon in the list was inspected under alias **C1**; its code and URL are intentionally omitted. Observed:

- Percentage discount **100**; **Allow free shipping checked**.
- No expiry, minimum spend, maximum spend, usage limit, per-user limit or item-count limit entered.
- Products/category restrictions and exclusions showed no selections; allowed-email restriction was empty; role restriction switch off; schedule dates empty.
- Cart Conditions displayed an empty condition group. URL-coupon feature enabled. Auto-apply/premium features were not treated as enabled merely because their sections exist.

This configuration supports a sub-$200 free-shipping exception when the coupon is valid and applied. It also represents a published, apparently broad 100% discount policy that the owner should confirm promptly. **No coupon was applied or tested**, no validity claim beyond inspected configuration is made, and this report does not disclose the redemption code/link or assert that it has been misused. Confirm whether this is intentional internal use; if not, approve expiry/access/usage/product constraints and the free-shipping flag as a separate remediation.

## Advanced Free Shipping — exact rule matrix

Extension **Advanced Free Shipping for WooCommerce 1.1.7.1**, active:

| Item | Observed value |
|---|---|
| Enable the Advanced Free Shipping rates | Checked |
| Hide other shipping methods when free shipping is available | Unchecked |
| Published rate title | “Spend $200 get free shipping!” |
| Shopper shipping title | “Free Shipping” |
| Number of listed rates / condition groups | One rate / one group |
| Actual non-template condition | **Subtotal → Equal to (`==`) → 200** |
| Coupon/class/destination/role restrictions in this group | None observed |
| Extra blank rows in DOM | Hidden editor templates using `9999` indexes; not counted as saved conditions |
| Priority | No separate priority control observed; only one published rate listed, so no inter-rate priority conflict demonstrated |

Installed `WPC_Subtotal_Condition::get_compare_value()` reads `WC()->cart->subtotal`. Installed Woo `class-wc-legacy-cart.php` resolves that property to **`get_subtotal() + get_subtotal_tax()`**, before coupon discounts. `WPC_Condition::match()` uses equality for `==`; it is not a minimum. The extension method adds a zero-cost `advanced_free_shipping` rate when a rule matches. The reviewed method reads global rule posts and the rule has no destination condition; it is not a separately restricted zone method in the inspected core zone lists. Effective per-package availability still requires a runtime test.

**Confirmed policy inconsistency:** the rate title suggests “spend $200” as a threshold, but the stored comparator matches **exactly tax-inclusive pre-discount subtotal 200**. Core free shipping uses **>= tax-exclusive displayed subtotal after discounts** here. Those bases can disagree even if the operator changes only `==` to `>=`; the tax/discount basis must be reconciled too.

For a tax-free/no-discount fictional package, source logic predicts:

| Subtotal | Core free | Extension free | Flat-rate offer |
|---:|---|---|---|
| 199.99 | Not by minimum; coupon may qualify | Does not match equality | Class-dependent; may be zero for organization-delivery classes |
| 200.00 | Qualifies | Matches equality | Remains possible; both hiding switches are off |
| 200.01 | Qualifies | Does not match equality | Remains possible |

With tax, the extension compares `pre-discount subtotal + subtotal tax` to 200. A pretax subtotal below 200 could match if that sum equals 200; a pretax subtotal of 200 with positive tax will not match the extension equality even though core may qualify. With a discount, extension and core may diverge again. Exact amounts, tax rates, rate ordering, label duplication and selected-method persistence have **not** been observed in a test cart.

## Recommended simplest safe policy — proposal, not applied

1. Ask the owner to distinguish ordinary shipped merchandise from campaign/team distribution. Preserve legitimate zero-cost distribution; define whether it applies nationally, only to an organization drop-off, only during an open campaign, and what happens in mixed carts.
2. Prefer **one threshold engine**, normally core zone Free shipping, with an explicit **>= $200 qualifying subtotal basis** and a clearly chosen discount/tax policy. Decide whether free-shipping coupons are intentional exceptions; otherwise remove that bypass in a separately approved change. Do not assume “OR coupon” is itself a bug.
3. After equivalent staging coverage, retire the redundant extension rule or deliberately align its conditions and scope. Merely replacing equality with >= would leave its tax-inclusive/pre-discount base different from core here.
4. Make every shippable class policy explicit in both zones. For Heavy fallback, approve a real fee, carrier method or explicit non-delivery restriction; do not silently replace all blanks with zero. Preserve intentional Uniform/Campaign delivery only after owner confirmation. Core class prices are not date-window enforcement.
5. Review C1's 100% discount, free-shipping and broad scope separately. Restrict/expire it only after owner approval; no code/link belongs in training materials.
6. If the business wants customers always to use available free shipping, evaluate core “Hide shipping rates when free shipping is available.” It is currently off, as is the extension equivalent. Hiding must be tested against pickup/expedited choices before enabling; optional paid service can be intentional.
7. Retain charged rates as pre-tax configuration; verify tax and address policy with the owner's accounting requirements. No live tax/rate change is authorized by this proposal.

Expected before/after: one understandable free-shipping method for ordinary qualifying carts, no unexplained exact-$200-only extension behavior, explicit campaign distribution exceptions, and explicit Heavy/no-class fallback charges. These are acceptance goals, not promised current rates.

## Untested fixture matrix and evidence requirements

No isolated SiteGround staging copy exists for the selected production installation (live Site Tools showed “There's nothing here yet”). Owner also confirmed application previews/Supabase may remain production-connected. **No fictional transactions or live exploratory cart were used.** See `COMMERCE_INTEGRITY_STAGING_PLAN.md` for the approval/isolation gate.

On an approved isolated environment, test the Cartesian matrix:

- Merchandise subtotals **199.99 / 200.00 / 200.01**.
- No coupon; ordinary discount that crosses the threshold; explicit free-shipping coupon; a fictional restricted 100% coupon only if owner wants its current policy reproduced safely.
- Local matching postcode, outside-zone US postcode, missing/invalid postcode, and a disallowed international country.
- No class; Clothing; Drinkware; Spirit Wear Campaign; Heavy; Uniform Bulk Order; mixed paid/free; mixed no-class/paid; multiple shipping packages if a plugin splits them.
- Taxable and non-taxable fixtures, before/after-discount basis, logged-out/fresh session versus retained selection, and classic/block checkout where supported.

For each case retain fixture ID, input item totals, coupon type (no secret code), displayed/discounted subtotal, tax basis, matching zone, every offered method with rate/tax, selected method and final total. Compare current code first, then the approved candidate configuration; clear only staging shipping caches/session data. No actual payment, order submission, refund, label or customer email is needed for rate tests.

Woo checkout shipping charges are distinct from USPS Click-N-Ship/EasyPost postage purchases in the application's Work Hub. An available free/paid method proves neither purchased postage nor dispatch/delivery. No carrier purchase was inspected or executed here.
