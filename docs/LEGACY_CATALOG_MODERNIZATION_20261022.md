# Skilled Crafting · Product and Client Modernization Manual
**Revision:** 1.7 · October 22, 2026  
**Scope:** recent additions to Marketing, Client Orders, Team Stores, Artwork, Production Recipes, Travelers, Print Center, WooCommerce auditing, QuickBooks setup and client/legacy product backfill.

## Golden rules
- **No original WooCommerce product, historic customer, order, inventory movement, or prior traveler is overwritten by this modernization.**
- Match client identities by source IDs and owner-confirmed evidence. Same school name does not prove same account. Never import a contact just because a similar email was found.
- A technical DTF/UV file preflight is not customer approval. Record exactly who approved the exact production version and garment scope.
- Every expanded recipe is an **unverified draft**. Physical sample and material/machine settings are mandatory before a manager approves.
- Reorder history is not proof that a different garment, year/season crest, logo color, name, number, size or process has the same approval.
- Testing Mode protects only supported actions. **Do not assume a high-impact action in Product & Client Modernization is simulated.** Read-only preview is the safe training path.

## 1. First-run setup for existing products
1. Open **Production → Catalog Production Readiness**. Refresh counts, generate missing review assignments, and review product-to-blank exceptions.
2. Open **Product & Client Modernization → Expanded recipe starters**, create the missing unapproved material/process templates.
3. In **Production Recipe Library**, select and fine-tune an actual verified production process. No source-article measurements are final until a physical sample passes.
4. In **Readiness scoring**, inspect the seven checks (blank, recipe, artwork, pricing, mockup, supplier, machine). Use the source systems to fix missing records. Manager-entered pricing/mockup/supplier verification notes are evidence references, not automated correctness claims.
5. In **Shared artwork**, select the exact preflight-passed locked artwork asset. Enter customer proof details and link the same asset independently to all intended garment families. **Do not grant approval for the customer beyond the agreed usage rights.**
6. Check for artwork revision flags before releasing manufacturing instructions. A changed stored asset raises a review warning on dependent product families, but existing order travelers remain immutable.
7. Assign a physically approved recipe to each appropriate product family, keeping special processes and exceptions distinct. Job-specific artwork proof and printing dimensions remain mandatory.

## 2. Legacy Woo customers → Marketing CRM
1. Refresh the **Client migration** candidate list.
2. Select one unlinked existing Woo customer. Review name/email suggestion evidence, alternate spellings, organization identity, billing company, orders and existing CRM contacts.
3. When the CRM account genuinely represents the same organization, select **Link reviewed existing CRM account**, enter supporting review evidence, and confirm.
4. **Create reviewed CRM account** only if there are no plausible matches and you have confirmed the original customer identity. This is not an email/newsletter subscription.
5. Inspect linked opportunities, contact preferences, prior estimates, artwork briefs and team-store launch tasks. No old Woo order, QuickBooks invoice, tax setting or customer contact record is changed by linking.

## 3. When a team returns to reorder
1. Start with the **Customer Reorders** report and original customer record.
2. Create/locate the new source order (WooCommerce **or** QuickBooks manual invoice; not both).
3. Open **Product & Client Modernization → Reorder comparison**. If an approved historical traveler with the same customer and exact SKU is missing, treat the order as first-time production.
4. Review current blank color/size, placement, personalization, signed artwork, machine settings and finished-stock applicability. All differences require action.
5. Record the reviewed outcome and evidence. Confirming alone does not create a traveler.
6. If there are zero differences and current artwork handoff, source recipe approval and shared logo still match, **Create traveler from reviewed approved recipe**. The database creates a fresh job-specific immutable snapshot; no inventory, invoice or job-status mutation occurs.
7. Continue pull sheet, production board, QC, spoilage if applicable, packing and actual shipping/pickup confirmation.

## 4. Substrate-specific starter families
| Method | Example products | Critical owner check |
|---|---|---|
| DTF | Tee, hoodie, polo, sweatshirt, adult/youth placements | Actual garment measurements, customer proof, film/transfer press instructions |
| Sublimation | Performance apparel, coated ceramic mugs, coated metal panels, tumblers | Verified substrate/polymer coating and specific press/oven settings |
| HTV | Cotton tee, polyester hoodie, cotton tote | **Exact** film brand/product heat schedule, cut test, dye migration |
| xTool Omni UV | PU/leather patch, metal badge, UV DTF film, experimental transfer film | Ink flexibility, primer, substrate/film compatibility, adhesion, relief and cure tests |
| MOPA fiber | Stainless steel and anodized metal | Actual alloy/finish, safe laser test grid, post-mark durability |
| xTool CO2/diode | Wood, laser-compatible acrylic | Fire/fume control, material compatibility, never PVC/unknown plastics |
| Roland BN2-30 | Printed contour-cut decals | ICC/media, solvent ink handling, drying, registration, cut force |

**Reference sites:** https://care.sawgrassink.com/ · https://www.siserna.com/easyweed/ · https://support.xtool.com/article/3666 · https://support.xtool.com/article/3704 · https://support.xtool.com/article/3750 · https://support.xtool.com/article/2399 · https://www.rolanddga.com/support/products/printers/versastudio-bn2-30

## 5. Client/order workflows introduced or refined recently
**One-time soccer-team hoodie order:** Marketing lead → verified client → logo/artwork request → client proof → quote/pricing rule → QuickBooks invoice → manual invoiced order → paired blanks/reservations → approved DTF recipe → traveler and QR → heat pressing → QC → dual invoice / labels → customer delivery/payment closeout.

**PTO school spirit-wear store:** Marketing client and commercial model → brand/artwork guide → approved mockups → tees/hoodies/mugs with material-specific methods → wholesale terms and PTO-set retail → campaign/storefront → confirmed Woo checkout and shipping → orders/pullsheets → artwork inheritance where licensed → approved recipe per item → production/packing by student/order → settlement and delivery.

**Printing:** Review customer invoice versus shop invoice with job QR and production details. The Epson CUPS queues on the Raspberry Pi, thermal labels, physical page sizes and QuickBooks OAuth **must be verified using live equipment and credentials**. The app's build/checks alone do not establish that those integrations are connected.

**Website updates:** Keep the primary WordPress storefront's image management, SKU mappings, price rules, customer-facing URLs (privacy/EULA), theme designs and read-only integrity audits aligned. Separate SiteGround WordPress changes are not implied by a Netlify application deployment.

## 6. Application Guide, employee training and PDF
Open **Tools & Admin → Application Guide**. Revision 1.7 adds documented walkthroughs for legacy CRM matches, shared artwork revisions, readiness scoring, controlled reorders, unverified machine presets and customer-to-print-packet execution.

In **Testing & Guided Training**, use the new role-based lessons. All trainer practice using modernization features should be **read-only unless a manager explicitly authorizes live data**.

The versioned, comprehensive downloadable manual is generated from the same updated guide chapters and tutorials during the application build:
`/skilled-crafting-application-user-guide.pdf`.

## 7. Release acceptance / rollback
- Tests: source-backed recipe draft tests, role-gated endpoint tests, documentation registry, comprehensive PDF generation, lint, Vite build and read-only production smoke.
- DB migration is **additive**: new restricted review tables, unique active CRM customer linkage, and artwork revision trigger. Before adoption, confirm its schema and data audit work without real write tests.
- If a UI page fails, leave the original order/inventory systems operational. Temporarily avoid manual synchronization/backfill actions and fix the gated endpoint; do not roll back historical Woo or Supabase records to solve a display issue.
- Actual browser click-through, exact artwork/camera proof, physical heat presses, lasers and printers require owner acceptance before treating production as fully verified.
