# Existing WooCommerce artwork mapping

Map Existing Woo Artwork is the catalog-wide draft workspace at `/woo-artwork-mapping`, also linked from Product Setup & Readiness. It separates importing existing product artwork from authorizing production.

## Operator workflow

1. Search or filter the catalog queue. Select families and inspect them together. Each read captures actual Woo parent data and all variation pages, up to 1,000 variations; incomplete pagination blocks a saved baseline. A failed product does not discard other drafts. Pause after the current product and resume with Not inspected.
2. Open a saved product. Map each exact legacy logo term to a graphic family and exact uploaded artwork file. The tool does not infer identities from labels, filenames or SKUs. Existing color/size/logo images remain visible as source evidence. Missing information can remain blank.
3. Save the draft. Import mapped artwork into draft Client Graphics when desired. Families/file revisions remain draft; dimensions stay unspecified, process stays Unspecified unless selected, and product association stays pending. No customer approval, physical verification, Woo selector or stock change occurs. Current certified artwork and existing approved families are not edited.
4. Reuse a saved product mapping as a template. Only identical normalized legacy terms transfer reviewed reference IDs. Product images, retained physical variation IDs and approvals never transfer.
5. Export the immutable baseline, source checksum, mapping, image links and old-to-proposed variation crosswalk. Read revision history to see who changed the proposal. Concurrent edits require reloading instead of overwriting another manager's work.
6. Complete production evidence separately. Activation readiness compares the current Woo source with its saved fingerprint and checks exact family, artwork revision, recipe, checksum, binding, output and customer evidence. Missing approval never prevents saving a mapping.

## Data and authorization

`sc_woo_logo_mapping_plans` stores each parent/source fingerprint once, with an immutable baseline and editable draft mappings protected by revision checks. `sc_woo_logo_mapping_events` retains append-only revision history. Manager/admin APIs only; client roles have no direct writes. The draft import RPC authenticates the real employee, serializes each plan, and is idempotent per legacy choice. It creates pending transfer reviews instead of touching live product bindings, which are part of certificate fingerprints.

The baseline may contain private product configuration, so exports and rows require manager access. There are no credentials in exported API configuration. This is catalog evidence, not an authoritative sales report.

## Consolidation readiness

The planner represents zero/one/many logo choices without deleting historical IDs. It proposes one explicitly selected physical variation per group and retains each legacy variation's SKU, graphic and image crosswalk. It blocks price/tax/sale/shipping differences, wildcard physical attributes, independent per-logo stock pools, duplicate identities, missing images and incomplete mapping. Migration surcharge must remain zero for price parity. No automatic stock merging is attempted.

**Current release boundary:** this draft workspace does not itself change Woo variation attributes, archive variations, install a storefront selector, activate webhooks or certify products. A separately implemented/reviewed cutover must enforce the planner/evidence gates and supply durable recovery before any live consolidation. Readiness is evidence, not execution.

## Validation

Tests cover multi-logo-to-physical grouping, preserved historic crosswalks, unchanged inputs, financial/stock/source conflicts, incomplete drafts, exact-term shared templates, fail-closed evidence reads, actual PostgreSQL-compatible grants/RLS, immutable baseline/events, repeat-safe draft imports and zero inferred approval. Existing production certification tests remain required.
