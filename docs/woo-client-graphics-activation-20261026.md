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
