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
