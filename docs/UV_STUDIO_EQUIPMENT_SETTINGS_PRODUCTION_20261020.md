# UV Studio + Machine Material Recipes
## Production release checklist — 2026-10-20

Branch: \`feature/uv-studio-material-settings-20261020\`
Target: \`main\` of \`matt17463/inventory-app\`, automatically built by Netlify for \`inventory.skilledcrafting.com\`.
Database: Supabase project \`uvqxkjqxcqovhkazaxbq\`.

### Delivered feature surface

1. **Advanced UV designer**: copied the previously tested v0.3 faux-stitch editor to \`public/uv-studio/index.html\`. Supports generated stitched/region-based height maps and underbase and varnish-intent assets, geometric cutting contours, patch layouts, calibration coupons, and production exports. Expanded with optional white background cleanup, chenille/rubber/embossed/metallic/gloss design treatments, stylized customer proofs, and personalized roster exports. Exports are **design and prepress assets**, not a proprietary xTool RIP job.
2. **Authenticated UV Studio route** \`/uv-studio\`: project/costing form, artwork and approval references, approved material recipe lookup, manager approval and photo/QC/proof/reprint event log, plus embedded design editor.
3. **Machine material recipe library route** \`/material-settings\`: shared across MOPA fiber, S1, P2, Omni Dual UV, traditional heat press and sublimation press. Search equipment/material/SKU, store configuration and process, use AI assisted candidate test plans, record physical tests and measurements, manager approval, CSV export.
4. **Secured AI suggestion endpoint** \`/.netlify/functions/material-settings-ai\`: requires signed-in active operator+; cannot drive equipment, cannot approve a recipe, cannot fabricate manufacturer values; rejects laser requests involving PVC/vinyl chloride and unknown plastic. Environment uses pre-existing \`OPENAI_API_KEY\`; optional \`OPENAI_MATERIAL_SETTINGS_MODEL\`.
5. **Persistent data model**: additive migration \`supabase/migrations/202610200001_uv_studio_material_recipes.sql\` with RLS, role-limited approvals and DB guards. No arbitrary client-facing user allowed to write material settings.
6. **Deploy preview suppression**: \`[build] ignore = "node scripts/netlify-ignore-non-production.mjs"\` in \`netlify.toml\`. The script exits 0 to SKIP nonproduction builds and 1 to BUILD production. Set \`SC_NETLIFY_FORCE_PREVIEW=1\` deliberately for a one-off preview. Actual Netlify site settings must be verified (UI-configured build-ignore settings may supersede repository config). GitHub Actions CI still runs for every push/PR.

### Important known limits — do not mislabel as fully production complete

- **Physical Omni calibration**: No printed height/ink-pass/adhesion samples were validated. “Layer masks” are graphic separation suggestions only; xTool Studio ultimately controls real UV ink deposition and selected settings.
- **Art asset persistence**: Browser embedded editor can import original artwork and export production files, but **the binary artwork/PNG/ZIP is not uploaded to the Artwork Vault/R2 yet**. The UV database stores metadata and manually entered durable artwork/proof URLs only. Reopening a job does not restore local artwork automatically. The user must store exported artwork separately until this bridge is tested.
- **Realistic previews**: The mockup is a *stylized approximation*, NOT photorealistic 3D physics or an actual photo. The procedural look presets are design-intent only and may not print as the simulated material.
- **Manufacturing jigs and cutter registration**: Geometric outlines and batch sheets exist, but physical fixture offsets and cutting registration must be measured and qualified on the installed xTool/Roland equipment.
- **AI settings research**: This version generates a *cautious suggested test plan*, NOT verified online live retrieval. No external manufacturer site is queried at request time, so it must not invent speed/power/frequency/temperature or recommend known-incompatible laser materials. Operators can use saved physically approved recipes or actual manufacturer data; no AI-only recommendations may be production approved.
- **Customer/work-order integration**: Customer reference/order reference and Artwork Vault URL are entered manually. Live order-line import, automatic inventory decrement, R2 file lifecycle, and equipment telemetry binding are not yet connected.
- **QA**: GitHub Actions automated CI must pass on the exact release commit. A production machine print must still pass manufacturer compatibility, ventilation, PPE, material handling, adhesion and durability testing before releasing products.

### Data deploy

1. Confirm production Supabase migration status and back up relevant production tables / schema.
2. Review migration SQL and run it once using the established Supabase production migration workflow.
3. Confirm four new tables exist, RLS enabled, policies/grants correct, approval guards and \`sc_approve_material_recipe\` RPC exist.
4. Test as an operator and a manager. Verify an operator cannot approve untested recipes and the database blocks direct writes setting \`status='approved'\` without an actual passing trial. Verify anonymous users cannot read.
5. Check Supabase security and performance advisors after DDL. Repair any newly introduced finding before launch.
6. Existing production data should be untouched by this additive migration.

### App deploy

1. Review changes from the feature branch against current \`main\`; reconcile any recent changes to sidebar or routes. **Do not fast-forward or force-update production without this review.**
2. Run GitHub Actions CI on the final commit: \`npm ci && npm run check\`, and specifically \`npm run test:material-studio\` (the comprehensive \`npm test\` includes it). Also test the actual deployed HTML in a browser (SVG/Canvas access, ZIP export, iframe postMessage, and keyboard access).
3. Verify Netlify \`OPENAI_API_KEY\` remains a server-side function environment variable; never place secret in Vite \`VITE_*\` environment.
4. Verify role-specific links and user permissions. Marketing role currently has its own restricted route tree; UV Studio and Material Settings are intended only for business operations staff.
5. Merge only after passing checks and successful migration. GitHub-to-Netlify production deploy occurs from \`main\`; check exact deployed commit and site health.
6. Confirm \`/uv-studio\` and \`/material-settings\` work behind employee login, material AI endpoint authorizes correctly, uploads/exports stay local, and no bypass of the existing employee access model.
7. Verify no extra deploy previews were generated. If the Netlify site still creates preview deploys, go to Netlify Site configuration → Build & deploy → Continuous deployment → Deploy contexts and disable branch/PR previews there, preserving \`main\` production. Project UI labels may differ by Netlify release.

### Machine qualification

- **MOPA fiber**: record exact OEM/controller, wattage, lens, spot size, frequency/pulse duration, material finish/coating, ventilation, intended effect, test matrix and result.
- **S1 / P2**: record precise laser module, wattage, air assist, focus, thickness, compatible material SDS, safety equipment, surface/adhesion changes, test coupon and the final recipe.
- **Omni**: three pilot prints (leather/synthetic, manufacturer-supported TPU 3D transfer film, metal with correct primer); measure height, adhesion, scratch/bend/stretch/wash or transfer durability as applicable. Ordinary heat transfer vinyl must not be assumed compatible with UV texturing.
- **Heat press / sublimation**: record manufacturer-approved time-temperature-pressure settings for the exact substrate/transfer, machine and platen; compare measured platen temperature; conduct adhesion/colorfastness/wash tests.
- Document actual tested outcomes in \`sc_material_recipe_trials\`, then have manager approve the matching recipe.

### Rollback

- Application rollback: redeploy the last-known-good main production commit using Netlify deploy rollback; do not force-reset Git history.
- Database rollback: additive tables can remain in place until a reviewed rollback migration is needed; **never** drop the new tables if staff may already have entered production data.
- If a critical issue occurs, stop use of the new routes, retain existing production features, fix and release forward.

### Explicit launch blockers

Do not claim full production-readiness until the exact commit has green CI, the SQL migration is applied and verified, Netlify environment is checked, the digital R2/Artwork Vault persistence workflow is built and tested for end-to-end work orders, and machine-specific physical material settings have passed the required tests. This branch is a **deploy candidate / limited pilot**, not a certified Omni printing driver or turnkey automated machine controller.
