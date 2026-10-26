# WooCommerce Client Graphics — staged integration checklist

**Status:** development branch only. Do not enable production customer selections by installing this plugin.

## Deployed baseline
- Client Graphics internal release: dba32a1fc42c68969caeb6a2d89a5b7b71322ef2.
- Internal traveler receipt security and generic-recipe per-placement assignments are live.
- WordPress graphic selector plugin was **not installed** as of final release evidence; `SC_GRAPHIC_ORDER_CAPTURE_ENABLED` is unset/off and Woo allowed bindings = 0.

## Gate 1 — plugin compatibility (no customer impact)
1. Validate PHP syntax and execute `php scripts/integration/client-graphics/wordpress-runtime.php` including variable-product tests.
2. Confirm classic Woo product and checkout hooks, HPOS line-item metadata persistence, and support boundaries for Woo Blocks / Store API. **Do not assume these classic hooks establish Woo Blocks checkout compatibility.** If the live storefront uses Blocks add-to-cart or checkout, implement Store API support before activation.
3. Install plugin *inactive* first, inspect for conflicts and PHP errors. Option `sc_graphics_selector_enabled` must remain `no` even after plugin activation.
4. Never configure multiple unverified artwork families on a production product.

## Gate 2 — mapping / managed capture
1. Using a noncustomer sandbox product, confirm server-verifiable allowed graphic family IDs, labels and exact product mapping, including Woo parent and variation IDs.
2. Confirm the selected family ID is persisted to `_sc_graphic_family_id` on the exact Woo **order line**, not merely the order or a cart session. Wrong UUID or missing choice must block checkout for a managed selectable product.
3. Confirm order webhook signature verification, replay/idempotency, and mapping to Woo order ID + **line-item ID** + production job_item_id. Never derive a design ID from labels, SKUs or the artwork filename.
4. Exercise capture statuses `managed_pending`, `managed_failed`, and `managed_resolved`. Failed managed capture must never become an accepted legacy order.
5. Verify each resolved selection has approved graphic family/variant, artwork object present, exact job-line placement approval, and traveler receipt. Mixed-order lines must not borrow another line's graphic choice.

## Gate 3 — rollout, isolated first
1. Use an existing authorized test environment with payments/emails/inventory isolated, or a clearly designated controlled test product that cannot produce a real fulfillment or payment. Do not place a real customer order during verification.
2. Keep `SC_GRAPHIC_ORDER_CAPTURE_ENABLED` off for customer traffic until the entire webhook-to-traveler chain passes.
3. Confirm automated tests and Netlify deploy SHA. Document screenshots and log evidence for Woo classic/Blocks paths actually used in production.
4. Activate for **one approved product** with verified mappings; monitor capture errors; only then expand to others. Require explicit permission to expose live customer-facing selector.

## Rollback
Turn the Woo WordPress option `sc_graphics_selector_enabled` to `no` first, then turn off `SC_GRAPHIC_ORDER_CAPTURE_ENABLED`, without deleting persisted managed capture states, order metadata, or existing traveler snapshots. Do not roll back permanent receipt validation independently of the matching application.

## Store API / WooCommerce Blocks implementation status

WooCommerce publishes an explicit `woocommerce_store_api_validate_add_to_cart` action before cart insertion. The plugin now blocks Store API add-to-cart requests for an enabled multi-choice product unless a compatible Blocks selection workflow is built; it currently directs the shopper to the standard product form. Fixed-design products and globally disabled graphic selectors remain unaffected. This is a **safety compatibility guard**, not a completed Blocks selector UI or verified Store API add-to-cart extension. Do not activate the customer-facing graphics feature for a Blocks-only product flow until a supported Blocks selection mechanism has been implemented and tested. See WooCommerce's current Cart API and Blocks validation hook documentation.

PHP fixture regression now includes variation lookup and Store API rejection of unverified multi-choice graphics. Execution of latest CI and live checkout topology verification is still required.

## Store API custom graphic ID bridge (2026-10-26)

The Store API now accepts an explicit `sc_graphic_family_id` parameter for add-to-cart, validates it against that product's configured parent-level list, and copies only the server-side trusted label/ID into `cart_item_data`. Requests lacking a valid family ID for a managed multi-choice product are rejected. Single fixed-art products automatically receive the configured ID. This builds on the official `woocommerce_store_api_add_to_cart_data` filter; it is **not** a storefront Blocks selector UI. <https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/cart>

Do not enable customer-facing selection until the actual storefront supplies this parameter via a tested Blocks UI or uses a compatible classic form, and tests confirm the Store API cart item metadata survives into the exact Woo order line and Skilled Crafting's signed webhook. Run the PHP fixture and all PR checks before considering activation.

## Store API / legacy validation ordering

WooCommerce's current CartController executes `woocommerce_add_to_cart_validation` with six arguments before its `woocommerce_store_api_validate_add_to_cart` action. The WordPress plugin accepts a server-validated `cart_item_data.sc_graphic_family_id` from the sixth argument when classic `$_POST` has no graphic field; it still independently checks that ID against the product's allowed designs. The `woocommerce_add_cart_item_data` filter preserves already-validated Store API selection data instead of dropping it. This resolves a previously hidden rejection for otherwise valid Blocks add-to-cart requests. This is not an assertion that a Blocks product-selection interface exists yet.
