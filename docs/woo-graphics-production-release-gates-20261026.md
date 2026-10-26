# WooCommerce Client Graphics — production release gate (October 26, 2026)

## Confirmed and patched
- The installed standalone Graphic Choices plugin must not render a **second** design selector when the existing *Skilled Crafting Mockup Variation Selector* owns Color → Size → Logo. Configure `_sc_graphic_external_selector=yes` **only after** the old selector has been adapted to send the canonical `sc_graphic_family_id`. Never configure this flag alone: without a UUID-emitting adapter, validation deliberately rejects a missing choice.
- The existing selector must submit the approved family **UUID**, not a filename, caption, generic logo ID or free-text label. Do not infer IDs from display names.
- Cart and checkout metadata are checked against parent-product `_sc_graphic_options`. A submitted label is overwritten from trusted configuration. Variation-only requests normalize to parent options.
- Keep `sc_graphics_selector_enabled` and `SC_GRAPHIC_ORDER_CAPTURE_ENABLED` **OFF** until actual checkout and webhook acceptance is verified. All code changes are additive and the existing storefront remains unchanged by a Git merge alone.

## Blocking external work before customer activation
1. Obtain source of the **currently installed** Mockup Variation Selector and verify its exact logo field, variation form events, output meta and add-to-cart behavior; it is not part of this repository. Write a version-aware adapter in that plugin that outputs `sc_graphic_family_id` from the approved mapping. Do not silently replace the plugin or choose a logo by text.
2. Reconcile interaction with **Skilled Crafting Product Options** and **WooCommerce Product Add-Ons** on one test product. Preserve names/numbers/teacher/team customization fields.
3. In isolated WordPress, submit a variable product (parent 700, variation 801 type only in fixtures) through the actual Divi form; inspect cart item and order-item `_sc_graphic_family_id`, `_sc_graphic_label` and Woo webhook JSON. Verify `product_id` is the parent, and `variation_id` is the purchased variation.
4. Verify a real webhook capture retry when the order job/job line has not yet appeared, and when the initial webhook/DB operation temporarily fails. Verify managed_pending/failed is visible and traveler creation stays blocked. Avoid creating actual live stock reservations. Use a separate isolated database and disabled email/payment/shipping.
5. Test exact R2 object HEAD and signed production receipts and a mixed-line, duplicated-webhook traveler. Compare line snapshots to each original graphic UUID.
6. Check Woo theme outdated gallery overrides for compatibility before future Woo upgrades (not demonstrated to affect order graphics). HPOS remains disabled and not certified.

## Release procedure
- WordPress plugin v0.2.0 is currently installed with the **old** production file set; updating the GitHub repository does **not** update this plugin automatically. Version the revised PHP plugin before packaging. Upload via WordPress only when an authenticated installation route is available and after its PHP CI passes.
- Netlify PR previews are not main production deployments; verify the exact published commit in Netlify.
- Production Supabase manager review migration is already installed; do not reapply or loosen its authorization.
- Confirm zero enabled bindings before activation.
- Complete the isolated checkout proof before approving any customer-facing rollout. WordPress selector OFF first on rollback, then Netlify capture OFF, preserving historical order metadata and traveler snapshots.

## Test caveat
Dedicated PHP fixtures exercise plugin hooks under emulated WordPress/WooCommerce, and the isolated PostgreSQL suite covers reconciliation through traveler. They are **not** a live WordPress checkout, real webhook HTTP delivery, or live R2 network access. Do not label release customer-activated based on passing these simulations.
