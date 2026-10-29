# Product & Event Center — Integrated release (Phases 1–5)

**Branch:** feature/product-event-center-phases-1-5-20261028  
**Route:** /product-event-center  
**Migration:** supabase/migrations/202610282301_product_event_center_phases_1_5.sql  
**Status:** Implementation branch; production deployment requires CI, schema application, role verification, and manual acceptance checks.

## What is included

1. **Opportunity radar:** starter products, category/equipment filtering, manually weighted customer/demand/production/differentiation ratings, documented market/source links, authenticated live-web research via product-opportunity-research Netlify function (server-only OPENAI_API_KEY).
2. **Recipe and physical testing:** direct links to existing /material-settings, version-specific shop trial records, material lot/photo, separation of internet research and manager-approved settings; Sawgrass SG500 machine recipe fields.
3. **Product economics:** blank, materials, packaging, labor hours, equipment hours, spoilage, sales-channel fee, setup, selling price, contribution per unit/order/labor hour/machine hour.
4. **Reusable event packages:** Essential, Signature, Premium weddings; coach appreciation and coach banquet; sports awards and corporate recognition. Event record, date, client, colors, guest count, table count, package items, unit pricing, exact material recipe, customer proof, artwork revision and per-item guest names. JSON planning-packet export.
5. **Launch and performance:** external listing-reference tracking, manager-only launch approvals, current recipe/trial gate, manually entered actual units/revenue/costs/waste/labor/machine time; deep links to existing Marketing CRM, Mockup Studio, Quotes, Catalog, Work Hub and Production Travelers.

## Explicit limits (do not misrepresent as complete)

- **No automatic WooCommerce publishing, QuickBooks invoicing, inventory reservation, external customer portal or traveler creation in this release.** Those operations stay in their existing application workflows; their links are provided.
- **No automatic supplier data importing, competitor-demand verification, AI proof certification, physical printer control or closed-group scraping.** Live web research is optional, source-linked and human-reviewed.
- **No new direct R2 photo-upload implementation.** Existing secure image URLs can be attached. Do not expose private R2 object keys with public URLs.
- **No automatic sales ETL.** Performance numbers are manually recorded and marked as such.
- **No shop-tested universal machine numbers.** Exact settings must be verified and physically tested in Material Settings before approval.
- **Event status "production" is a planning state**, not evidence of a traveler or purchase order. Existing work order and customer billing still need explicit creation.
- Event package line items are persisted individually; no transactional multi-table creation across HTTP calls. If item creation fails after the event is created, open the event and repair the missing items.

## Required order of operations

1. Review the branch diff against current main. Check other in-flight production branches before merging.
2. Run \`npm ci\`, \`npm run test:product-center\`, \`npm run test:material-studio\`, \`npm run lint\`, \`npm run build\` and preferably \`npm run check\`. Build may require the project's existing documentation/PDF build prerequisites.
3. Back up Supabase, apply the additive migration once via approved migration workflow. The migration changes an existing machine-type check constraint for SG500 and creates seven new secured tables. No existing product/order data is updated.
4. Verify RLS with admin, manager, operator, marketing, viewer, and anonymous sessions; test that a marketing account can write opportunities/events, an operator can log trials, viewers cannot mutate, and only managers can record launches/performance.
5. Confirm the new /product-event-center route loads under both the full and simplified navigation systems, including marketing-only employees.
6. Create a sample wedding and a coach gift package in **Testing Mode** first, then with safe training data on staging. Save line items, attach exact recipes, test a proof revision, and verify production gating.
7. Confirm WooCommerce, QuickBooks, Work Hub, and the print/QR traveler paths remain unchanged. **Do not use a live customer order for a smoke test.**
8. Once quality gates pass, deploy the merged commit through Netlify's normal production pipeline; check logs, release health, role access and all existing key routes. Roll back the code through Netlify and schema using an additive compensating migration if needed.

## Roles and security

- Admin/manager: opportunities/events, physical trials, launches/performance.
- Marketing: opportunities, research sources, event plans; not material recipe approval or business metrics.
- Operator: physical trials and read access; no quote/package writes.
- Viewer/anonymous: no Product & Event Center table access.
- Existing \`sc_current_app_role()\` supplies the application role, not user-editable JWT metadata. Client UI restrictions are backed by Postgres RLS policies.
- No auto-deletes; customer names should be limited to personalization necessary for production, and existing business retention/privacy practices should apply.

## Safety and qualification

- Never laser PVC, vinyl chloride or unidentified plastics. Require supplier SDS/compatibility proof.
- Glassware and UV prints: avoid food contact/drinking rims; use tested safe decoration methods.
- Golf balls: require measured fixture suitability and specific material handling checks.
- xTool Omni UV advice is specific to Dual UV edition. Treat blank/coating/adhesion as trial-specific.
- All example products and package quantities are unverified candidates, not supplier prices or tested settings.

## Known dependency

The built-in on-demand research button requires \`OPENAI_API_KEY\` in Netlify server environment and a suitable approved model. Lack of key returns a clear message; source management, packages and economics still work. Search-provider responses can be slow or incomplete and must not be treated as manufacturer certifications.


## Automation addendum — 2026-10-28
The following Supabase migrations are applied: product_event_center_phases_1_5 and product_event_sales_imports. Anonymous access to sc_pdc_events was explicitly denied in a role test.
Admin/manager operations are exposed through the employee-authenticated product-event-automation Netlify function.
- publish_existing_woo_product publishes a validated, name-matched existing WooCommerce draft; the original mockup publisher still creates full products and variations.
- create_qbo_event_invoice creates an unsent QBO invoice using explicit customer and item IDs, duplicate DocNumber query and approved event/proof/recipe gates. Verify QuickBooks taxes and payment terms before sending.
- create_verified_traveler uses the linked open job, exact line IDs, approved manufacturing recipe and the existing traveler-artwork-preflight/verifiedTraveler path.
- verify_qbo_event_invoice reconciles exact invoice number, customer, total and tax via the existing read-only helper.
- import_verified_qbo_sales appends idempotent per-opportunity actual-sales records after QuickBooks reconciliation and event-line attribution.
These are guarded user-initiated operations, not recurring background jobs. No automatic Woo catalog creation, QuickBooks customer lookup/matching, invoice emailing, Woo sales ingestion or automatic source-of-truth job linking is claimed.
Existing material recipe approvals are currently zero: production gates must remain closed until physical tests are recorded and approved.
Both Netlify preview builds showed success on the integrated branch. The separate GitHub Actions product regression, manufacturing/order suites, security tests, lint and build must be checked for completion.
Existing Supabase security/performance advisors contain historical warnings; this release does not remediate unrelated database functions or policies.
No live paid order or customer invoice was created during development. Production release should follow staged order, printer and finance acceptance.
