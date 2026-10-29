# Skilled Crafting — Device & Product Library (xTool O1 Omni Dual UV)

Implementation issue: #181
Branch: feature/omni-device-product-library-20261028
App route: /device-product-library
Linked: /material-settings, /equipment-center, /uv-studio

## Scope
- Device / product searchable directory and saved Supabase material recipes.
- Source-linked Dual UV setup and manufacturing guides, official starter settings for dark slate and acrylic.
- Owner-originated public reports clearly separated from official information.
- Setup checklist synced by machine across employees.
- Shared maintenance logging and due-date displays.
- Troubleshooting with official resources; no printer control/API is represented.
- Existing sc_material_recipe_trials and sc_approve_material_recipe approval workflow is unchanged.
- Deep link /material-settings?seed=<id> builds an unapproved draft; /material-settings?recipe=<uuid> opens an existing saved entry.
- Branded print and photo workflow intentionally remain in xTool Studio / existing UV Studio.

## Safety / qualification
Standard spherical golf balls (~42.7 mm) are below the OR1 minimum 47 mm. Do not recommend standard OR1 operation. New golf workflows require a measured and physically validated compatible fixture. Flatbed coins and other items require blank-specific surface preparation and adhesion testing. Food contact surfaces and drinking rims must not be UV printed. For primer-using print trials, xTool recommends resting at least 30 minutes before adhesion testing.

**No seeded numerical setting is treated as production approved.** Slate dark-rock official tutorial: flatbed Square Rock Coaster / White+Color / 2 white layers + 1 color layer (https://support.xtool.com/article/3736). Acrylic manufacturer texture tutorial sample: 0.6 mm texture / smoothness 1 (https://support.xtool.com/article/3738).

## Migration and release
Additive migration: supabase/migrations/202610280001_device_product_library.sql
Tables: sc_device_setup_checks (shared current state), sc_device_maintenance_logs (append-only audit).
Requires existing public.sc_current_app_role() function in production, admin/manager/operator role policies, authenticated access, no anonymous access. Do not expose service keys. Verify SELECT/INSERT/UPSERT with employee account and deny viewer writes/anonymous access. The UI displays a non-persistence warning until tables are installed and readable.

Run npm run test:material-studio, npm run lint, npm run build and full npm run check on final commit. Confirm menu, setup completion across browsers, maintenance history across users, recipe seeding and manager-only approval. Confirm existing routes work. Verify no deployment until migration is applied and CI passes. Production needs real-world material tests.

## Maintenance
Follow Studio Device Health for daily lamp reminders and consumable life. Official separate UV lamp guide describes weekly cleaning, optical/CIS weekly and rails monthly. The app stores manual logs, not live xTool counters.

## Sources
https://support.xtool.com/article/3084
https://support.xtool.com/article/3666
https://support.xtool.com/article/3704
https://support.xtool.com/article/3188
https://support.xtool.com/article/3736
https://support.xtool.com/article/3738
https://support.xtool.com/article/3081
https://support.xtool.com/academy/course?id=335


## xTool Studio-specific recipe expansion (October 28, 2026)
Each of the ten built-in Omni products has a Studio parameters matrix at
`src/lib/omniStudioProfiles.js` and a detailed view in /device-product-library.
Every displayed parameter contains an evidence class and direct original source:
- **Official example:** exact numerical option on a named xTool tutorial, not an approved recipe for all manufacturers of a blank.
- **Manufacturer principle:** general material/white-ink/primer guidance applied to candidate.
- **Shop trial candidate:** deliberate comparison, never claimed to be published or tested.
- **Public owner report:** quoted by subject and linked to public discussion; not an official validation.
- **Not supported:** standard fixture incompatible; no one-click recipe draft.

### Documented numerical references
- Dark Square Rock Coaster: UV Flatbed / Flat / White+Color / 2 white layers + 1 color layer. https://support.xtool.com/article/3736
- Acrylic texture board: UV Flatbed / Acrylic / Texture / White+Color / Thickness 0.6 mm / Smoothness 1. https://support.xtool.com/article/3738
- PU leather/canvas xTool bend comparison: Texture / Flexible White / 0.3 mm / rest 30 minutes. This is a test condition, not a universal hat patch production preset. https://support.xtool.com/article/3750
- UV DTF A/B film: Flat mode, transparent double-sided glass use Color+White+Color; 1–3 varnish layers optional; LM1 film process. https://support.xtool.com/article/3688
- Rotary glassware: xTool Studio > Rotary > calibrate empty OR1 > mount > Modeling > Preview > set Flat/Texture/Relief. https://support.xtool.com/article/3510
- General primer: metal, acrylic, glazed ceramic/glass require matching primer; rest at least 30 minutes before testing. https://support.xtool.com/article/3704
- xTool Studio v1.8+: home Material setting > Community can filter manufacturer/product settings and apply matching shared parameters. https://support.xtool.com/article/1306
- Public leatherette report: an owner used "red PU luggage tag" on red leatherette with white ink; actual ink layer count not reported. https://www.reddit.com/r/xToolOfficial/comments/1wgufkq/testing_white_uv_ink_on_leatherette_with_the/

### Product-specific trial matrix
Brass coins: Flat / White+Color / rigid white, compare 1 vs 2 white layers; no OEM brass count.
Stainless coins: Flat / White+Color / rigid white, compare 1 vs 2, isolate coatings.
Leather hat patches: Texture / Flexible White / 0.3-mm benchmark, validate folds.
PU leather: same 0.3-mm test on compatible PU only, TPU/HTV separately.
Glass drinkware: Rotary/modeling / Flat / White+Color, compare 1 vs 2 white layers.
Slate: 2 white + 1 color official starting point.
Standard golf ball: blocked without an alternate validated fixture (OR1 sphere minimum 47 mm).
Acrylic: 0.6 mm texture / Smoothness 1 official starting point.
Glazed ornaments: flat / rigid white; compare substrate-color-dependent white passes.
UV DTF: Flat A/B films, optional 1–3 varnish and two-sided transparent Color+White+Color.

### Operator workflow
1. Browse /device-product-library by device or product.
2. Read per-field evidence and set the actual surface/coating, fixture, ink and production effect.
3. Select "Load sourced settings into a draft"; this passes the data into /material-settings (never automatically saves).
4. Confirm xTool Studio settings and actual selected preset, update unknown or test-dependent values, and save the experimental draft.
5. Physically print and log a test for that version/material lot. Approval requires manager role and passing trial, as before.
6. Never use unqualified printer settings as a production traveler approval.

No new Supabase table or approval bypass is necessary for these research records. Machine output occurs only in xTool Studio.
