# Client Graphics architecture / migration hold point — October 25, 2026

## Phase 1 build scope
- Central graphics families, art file variants, production selection rules, storefront product bindings, and separate transfer review records.
- Artwork is stored by existing R2-backed mockup_artwork_assets; **do not copy large files into SQL**.
- Each graphic family has independent customer-visible and production-only status.
- Manual, QuickBooks, and Woo source selections share stable graphic-family identities.
- Recipes must evolve from single version-level artwork_asset_id to an artwork asset or variant per placement with exact version snapshots.
- Never extrapolate sizes from image metadata alone. Size/placement/color rules require approved samples.
- Keep finished product SKU, inventory, invoice, shipping, and payments independent from decoration selection.

## Public storefront audit
Directory https://skilledcrafting.com/shop-new/ lists:
Burley Bears, EPO Orcas, Marcus Whitman MS, Sidney Glen Dolphins, South Colby Bobcats, Swift Water Elementary, Big Kick Energy, North Mason Fastpitch, SK United, SKGSA, SKSC, Ultimate Street, and Freestanding ERs.
Notable: Burley uses named Classic Logo products; Big Kick Energy has light/dark jerseys; SKSC anniversary merchandise; multiple hardgoods/print processes; club/team hierarchy and personalized kits. Swift Water public page timed out during audit.
Public listings do not reveal complete product attributes, variation structures, or checkout item metadata; do not claim full WooCommerce catalog verified.

## Phase 2 WooCommerce migration, **NOT AUTHORIZED YET**
1. Read-only inventory every published/unpublished client-store product, categories, parent/variation IDs, attributes, default selections, plugins, pricing, SKUs, product imagery, historical order-item graphic metadata and legacy custom fields.
2. Export baseline snapshots and hash; identify duplicate labels, ambiguous attribute slugs, unlisted designs, variants with different prices, legacy sku-parsed logo names, and existing order metadata.
3. Stage sc_client_graphic_transfer_reviews rows marked pending; attach source metadata, screenshots, proposed family and impact.
4. Present a per-store comparison of existing and proposed customer choices. Verify storefront thumbnails, add-to-cart/checkout/confirmation, notification/invoice/packing and synced job line metadata in an isolated non-payment test environment.
5. Human approval explicitly required for ambiguous mappings. Only after all tests, use reversible controlled product modifications. Never delete variation rows as a side effect of changing graphic choices.
6. Historic orders and approved traveler recipe snapshots remain immutable.

## Required readiness before any deployment
- Complete role-scoped APIs and RLS policies, manager-facing library UI, Woo selector plugin and authorization, manual/QuickBooks order UI, per-placement artwork and QR traveler preview, art preflight, migration dashboard, coverage report, end-to-end tests.
- Dry-run rule matrix per store and representative checkout variations.
- Migration is additive and **has not been applied** to production Supabase.
- No production changes/Netlify preview deploys in this initial foundation commit.
