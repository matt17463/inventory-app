# Shop workflow review — October 16, 2026

## Implemented

- Finished receiving accepts already-made extras, returns and demo/sample inventory, defaults to no blank deduction, excludes Pending Stock destination bins, and preserves customer, logo and production-source metadata. Returns cannot deduct another blank. The new RPC uses the actual bigint customer/logo key types and serializes blank consumption by locking the blank product.
- Published WooCommerce product-specific `Logo Selection` attributes are discovered in bounded pages alongside global synced logos. Local choices remain name-based rather than pretending to have a global logo ID. The existing global-only WordPress sync is unchanged; discovery covers the missing product-specific source without modifying storefront variations.
- Navigation uses collapsible groups materialized from the existing Menu Manager preferences, plus the existing top-bar search. The active page’s group expands on navigation.
- Managers can cancel POs or permanently delete unreceived POs with confirmation. Receiving against a cancelled order is rejected. Received inventory and its history are retained.
- Shop production excludes terminal jobs before pagination, and overlays saved job statuses like the main board. Display counts describe current returned results.
- Copper Foundry and Evergreen Workshop join Midnight Industrial. Production and equipment displays share theme tokens; hard-coded colors, body-level token overrides, unreadable count badges and conflicting control rules were corrected.
- Equipment TV / Touch reuses the existing Home Assistant connection, device mappings, photos, printer telemetry, remote links, command restrictions and confirmation. TV view hides operation controls. Training simulations do not send device commands.
- Catalog Workbench provides a single diagnostic sequence linking existing tools rather than introducing another repair engine. The outbound Woo queue is explicitly distinguished from inbound product/attribute imports.
- Guide and guided training cover the new workflows plus recently added equipment telemetry and contractor reporting. New receiving, PO lifecycle and equipment operations honor supported simulated writes.

## Confirmed causes and live evidence

- The EPO sweatshirt (WooCommerce product 15447) uses a **local** `Logo Selection` attribute containing EPO Orcas Black & White, East Port Orchard ES Orcas Classic and EPO Orcas Full Color. Those are absent from the global `pa_logo` taxonomy. Global attribute sync was working for its 12 terms; it did not cover this local source. Placement-like terms are already present in the global WooCommerce logo taxonomy and were not deleted or reclassified automatically.
- The old finished-product API wrapper dropped customer ID, logo ID and production source. The newer database overload also declared UUID customer/logo parameters while both lookup tables and destination columns use bigint IDs. The corrected v2 RPC avoids ambiguous legacy overloads.
- The cached board contained 18 completed jobs classified as attention/ready/in-production. Shop mode also admitted some production-complete rows based on their due date. The patched live query returned 5 open jobs and 0 terminal jobs.
- Last recorded order/pull-sheet sync completed October 15. Logged outcomes: 110 completed and 46 completed with warnings; historical warnings remain for targeted review.
- Catalog snapshot: 11,833 product rows, 1,927 missing blank links. These are raw diagnostics, not proof that every missing link should be repaired: services, archived rows and non-inventory items need classification first.
- Integrity diagnostics reported 20 duplicate-SKU issue rows, 129 duplicate-color lookup issue rows, 4 duplicate-size issue rows and 3 duplicate-style issue rows. No blanket merge was performed.
- Product Data Health reported 5,000 missing-barcode rows; its report cap means this should not be treated as a complete catalog count.
- Outbound inventory queue has 53 pending blank-product events, newest September 29, and one ignored reservation event. This queue does not measure the successful October attribute import.

## Tool ownership and simplification

1. Product Data Health checks missing fields; Product Integrity Center checks conflicting/duplicate catalog identities.
2. Color Pairings maps supplier aliases; Product Color Manager changes WooCommerce availability/replacements. These are different operations.
3. Product Type Manager assigns item categories. Non-Inventory Rules excludes services/customization from physical blank demand.
4. Product-to-Blank Mappings owns exact identities. Mapping Repair repairs imported catalog links. Bulk Pairing Repair propagates corrected mappings to historical order lines.
5. Operations Integrity checks downstream reservations, orders and purchasing after catalog repairs.

All are reachable through Catalog Workbench. Existing routes remain available to saved menus and guide links.

## WooCommerce plugin review

WordPress displayed 50 installed plugins, 49 active. Relevant overlap candidates:

| Area | Active plugins observed | Follow-up before removal |
|---|---|---|
| SKU generation | WC SKU Builder Manager; SKU Generator for WooCommerce; Product SKU Generator for WooCommerce | Determine which save hooks and SKU rules are active; select one writer without changing established identities. |
| Product options | Skilled Crafting Product Options; WooCommerce Product Add-Ons | Run the existing migration/cutover audit and compare pricing, conditional options and historical order metadata. ThemeHigh Extra Product Options was already inactive. |
| Exports/reporting | Advanced Order Export; JEM Order Export; Ninjalytics | Compare saved export templates, schedules and accounting consumers before retiring unused exporters. |
| Brand/style edits | WC Brand Style Manager V3; SC Woo Bulk Brand & Style Editor | Confirm which bulk-edit workflows are used and preserve variation propagation. |
| Product sync/repair | WooCommerce to Supabase Product Sync 2.9.1; SC Supabase Repair Tools 1.0 | Sync and repair have different roles; the existing sync imports global terms only. App discovery now covers local logo selections. |
| Artwork | Artwork System; Inventory Auto Sync; R2 Storage & Review Reliability | These are complementary intake, handoff and storage layers, not demonstrated duplicates. |
| Batch updates | Safe Batch Updates; Variation Batch Updater | Different parent/bulk and variation update surfaces; do not remove solely on similar names. |

No live plugin was disabled based solely on its name. The review does not establish that checkout, saved export schedules or historical option metadata can safely lose any of these plugins. Storefront configuration remains a separate, testable cutover.

## Validation and limits

The full existing test suite, new behavioral tests, lint and production build were run. New tests cover terminal job filtering, custom/global logo extraction and preserving foreign-key semantics across paginated logo merges. Database receipts and PO lifecycle were exercised in rolled-back transactions, so no real inventory or supplier order was changed by those tests.

A browser-rendered fixture uses the actual application, equipment and theme styles to measure representative production/equipment text across 9 themes × 2 modes. It covers headers, lane counts, alerts, controls, device names and readings. This is sampled component validation, not a claim that every cell on every authenticated screen was visually inspected.

Home Assistant device commands and supplier cancellations were not sent during verification. Existing connection requirements still apply. A TV/touch device needs its own signed-in app session and private Home Assistant connectivity.

Existing Supabase advisors also identified broad legacy exposure: 246 anonymously executable security-definer functions, 269 authenticated equivalents, 225 mutable function search paths and one security-definer view, plus configuration notices. The new RPCs use invoker rights and explicit role checks. Bulk privilege changes were not applied because public order/artwork flows and WordPress integrations need endpoint-by-endpoint access tests. See [function exposure remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
