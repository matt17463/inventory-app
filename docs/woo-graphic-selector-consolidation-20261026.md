# Skilled Crafting — consolidated WooCommerce graphic choice recommendation

## Proposed architecture
**Keep one customer-facing chooser per product.** The existing active *Skilled Crafting Mockup Variation Selector* owns dependent garment Color → Size → Logo presentation for current variable products. Do not place the separate *Skilled Crafting Graphic Choices* selector beside it. The existing *Skilled Crafting Product Options* and *WooCommerce Product Add-Ons* must remain compatible with customer personalization fields, not create a second authoritative graphic identifier.

Use the Client Graphics library as **the source of truth** for:
- canonical approved graphic-family UUID and trusted customer label;
- approved artwork variants and size/color/placement manufacturing rules;
- verified Woo parent-product binding and manager review evidence;
- exact Woo order-line UUID selection and repeat-safe webhook capture;
- R2 preflight, short-lived traveler receipts and immutable traveler line snapshots.

The UI adapter should map the existing Logo dropdown to the graphic-family UUID, using the same `_sc_graphic_family_id` and `_sc_graphic_label` order line metadata supported by the existing plugin. Avoid parsing display labels, SKUs or artwork filenames to infer identity. For simple products without an existing selector, the opt-in Graphic Choices block or classic selector can be used **instead**, not in addition.

## Manager review and activation boundaries
The new Client Graphics manager checklist certifies (1) exact parent/variation IDs, (2) reconciliation with existing three selector/add-on plugins, (3) approved physical sample/recipe, (4) approved R2 file verification. Its server endpoint requires an active manager/admin, and the database checks an approved family, approved artwork variant, active manufacturing rule and durable review evidence. Approval authorizes an application binding **only**. It never enables WordPress's `sc_graphics_selector_enabled` or Netlify's `SC_GRAPHIC_ORDER_CAPTURE_ENABLED`.

**Migration must be applied before using the new button.** Existing approved bindings are not changed by applying the migration. Do not activate customer selection until a safe real Woo isolated checkout and webhook acceptance passes.

## Test scope and limitations
The isolated test generates fictional checkout metadata with a canonical UUID and label, posts it through the real reconciliation module into isolated PostgreSQL, verifies `managed_resolved`, checks replay idempotency, and generates a grouped production traveler by its real SQL RPC. It does **not** execute the actual WordPress HTTP checkout or WooCommerce webhook HTTP handler, perform an R2 network GET, or test a real printer. Those stay gated on a safely isolated WooCommerce environment.

## Safe production rollout after separate owner authorization
1. Install migration and release UI/API code with selector/capture OFF.
2. Document exact existing selector option values, product parent/variation IDs and current personalization metadata; avoid duplicate inputs.
3. Complete manager evidence and approve exactly one binding in the application.
4. Establish test payment/email/inventory isolation and perform actual Woo checkout/webhook-to-traveler acceptance with a noncustomer item.
5. Enable the selector for one reconciled product; then enable server capture and monitor `managed_pending`, `managed_failed`, `managed_resolved` and travelers.
6. Disable WordPress customer selector first, then Netlify capture on emergency rollback. Do not delete archived orders/travelers/approved snapshots.
