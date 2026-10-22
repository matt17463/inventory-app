# WordPress Audit Integration — Guide and Training Release

Date: October 22, 2026. Audit source: WordPress Work PR #103, with PARTIAL results in docs/wordpress-audit/AUDIT_COMPLETE.json.

## Integrated deliverables
- 51 installed plugins (50 active, one inactive) and two additional drop-ins in the Work inventory.
- 42 partially observed screen/section records and 405 documented controls across 22 plugins; 29 plugins have inventory only.
- WordPress owner-scenario and plugin-field reference chapters in the online Application Guide. Controls include novice purpose, advanced notes, observed options, effect/uncertainty, known error/safety notes.
- Six read-only WordPress training programs: storefronts, personalization, artwork, printing, shipping, WooCommerce product sync.
- Manager-only Documentation Audit view enriched with all recorded WordPress control details and explicit partial-review boundaries.
- Generated PDF now includes these chapters, training and a nonduplicated evidence/risks annex. Plugin UI observation is NOT evidence of saved settings or tested downstream effects.

## Owner issues
1. Client Storefronts installed 0.1.2 but repository header 0.1.3; verify actual deployed code before changing.
2. Native SC Product Options Replacement mode coexists with historical legacy option reading; protect order metadata.
3. Multiple active SKU writers and batch editors; confirm sole SKU ownership and separate Woo/Supabase sync and blank pairing.
4. Core WooCommerce shipping and Advanced Free Shipping may overlap; local $200 minimum OR coupon settings are not universal.
5. Print Documents output generation is NOT a physical print or customer handoff confirmation.
6. Homepage /shop-new/ and Team Orders /find-your-store/ use distinct directory paths; verify intentional navigation.

## Open QA
- 29 inventory-only plugins still need specific administration and conditional dialogs checked.
- Saved settings, real checkout, shipping/tax rules, refunds, R2 approvals, data repair/sync, roles/mobile and printing were not comprehensively tested.
- Only two WordPress shipping-dialog visibility cases are narrowly live verified. No plugin has a complete end-to-end certification.
- No sanitized WordPress screenshots were retained.

## Release
Run documentation audit validation, full tests, lint, PDF regeneration and Vite build through CI. No Netlify preview deploys. Merge to main only after green. Real WordPress/Netlify checks remain separate.