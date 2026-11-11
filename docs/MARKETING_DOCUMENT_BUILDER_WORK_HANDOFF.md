# Skilled Crafting Marketing Document Builder — Work Implementation and Production Handoff

## Assignment
Complete the full production-quality rebuild of the Marketing Document Builder. User explicitly authorized implementation, routine remediation, testing and production deployment. Do not ask for routine approvals. Stop only for unavoidable high-risk/destructive changes, external costs, or missing credentials.

## Environment
- GitHub: matt17463/inventory-app
- Production branch: main
- Work branch: feature/marketing-document-library-rebuild-20261110
- Production: https://inventory.skilledcrafting.com
- Supabase production project: uvqxkjqxcqovhkazaxbq
- React/Vite, Supabase/PostgreSQL/RLS, Netlify, Cloudflare R2, WooCommerce, QuickBooks.
- Existing DTF/Gemini live verification prebuild gate may block Netlify builds. Investigate underlying 503 verification failure; never bypass safety gate to deploy.

## Changes already committed (not tested or deployed)
1. src/lib/marketingDocumentBlueprints.js — editorial stage, purpose, theme and sections for all 35 templates.
2. src/MarketingDocumentStudio.jsx — displays document-specific purpose and section checklist.
3. scripts/tests/marketing-document-blueprints.test.mjs — coverage assertion.
Review these commits, run tests, and correct anything necessary. Do not assume that displaying a section checklist means the sections are already implemented.

## Primary existing code
- src/MarketingDocumentStudio.jsx — main builder, client selection, uploads, saved drafts, HTML download.
- src/lib/marketingDocumentContent.js — template completeness checks and HTML rendering.
- src/lib/marketingCatalogPolicy.js — authoritative 35-template registry.
- src/MarketingProgramDesigner.jsx — school brochure and product-catalog specialized workflow.
- src/MarketingBrochureStudio.jsx — school brochure design.
- src/ClientMarketingStarterKit.jsx — existing shared assets.
- src/MarketingSupplierCompare.jsx, src/MarketingStorePreview.jsx — supporting workflows.
- src/lib/marketingAI.js — AI copy; keep artwork out of model prompts.
- Netlify marketing-artwork-asset, marketing-shared-asset, marketing-review-link and marketing-review-admin functions.
- Existing sc_growth_documents and client/store/mockup tables; inspect schema and RLS before changes.
- docs/MARKETING_SCHOOL_BROCHURE_CATALOG.md and related marketing docs.
- package.json scripts: npm run test:marketing, npm run lint, npm run build, npm run check.

## Requirements: implement all 35 documents
Use the blueprint registry for editorial scope, but replace generic shared bodies with purpose-specific complete content and design. All user-completed documents must be distribution-ready, with accurate pricing, terms, CTA, and appropriate content for marketing stage. Missing facts must be user-editable fields, not invented text.

Priority implementations:
1. Client product catalog: retrieve ALL products selected for the client's store/assortment; integrate approved Mockup Studio product images; group by product type and style, consolidate sizes and colors, large hero mockup plus small color thumbnails, available specifications and approved customer prices. Never expose supplier costs or unrelated clients' assets.
2. Product description/listing: expanded single style with decorated mockups in all offered colors, size chart where verified, fit/fabric/care/decoration details, pricing, ordering CTA. Reuse verified catalog data.
3. Brand usage guide: actual client logo variants, clear space, minimum size, palette (verified HEX/RGB, CMYK/Pantone only if verified), fonts, correct/incorrect usage, background rules, embroidery/DTF/UV/print applications, assets, version and approval. Reference NFHS https://assets.nfhs.org/umbraco/media/4295090/nfhs-company-brand-guidelines_public.pdf and school guide https://files-backend.assets.thrillshare.com/documents/asset/uploaded_file/3857/Pcps/e3d92339-7ba2-4a31-91c7-aae10638f9bd/Logo-and-Brand-Guide.pdf?disposition=inline. Treat unavailable source as unverified.
4. Artwork placement/sizing: garment-specific front/back/sleeve/hat images; measurement origin, artwork dimensions and allowable ranges by garment and youth/adult sizes, method limitations, approval. Do not invent physical production specs.
5. All remaining templates: document-specific completeness and layout, especially quotes, proposals, fundraising, onboarding, outreach and events.

## Exports
- Generate BOTH native .docx and .pdf for every template, from a shared structured content model. HTML-only download is insufficient.
- Preserve images, swatches, headings, page breaks, tables, hyperlinks, and document metadata. Verify Word and PDF content parity.
- Choose server-side generation if image/data security and consistent fonts require it. Reuse existing libraries where practical; avoid a new paid API.
- Never distribute drafts with missing required information as final. Keep draft preview/download distinguishable from approved export.
- For saved documents, securely resolve R2 images server-side with client authorization; do not persist raw base64 in Supabase or expose private signed URLs in long-lived artifacts.

## Branding and UI
- Early marketing: Skilled Crafting palette.
- Later client-specific: verified client brand palette, approved fonts and logo; optionally accept a website reference, but suggest inferred values for user confirmation, not as facts.
- Events: sports, wedding, business, recognition theme families.
- Offer consistent professional templates (e.g. editorial, catalog grid, premium proposal, technical spec), page headers/footers and accessible type.
- Guided wizard: choose purpose > client > import verified records > fill missing fields > preview > check readiness > export/save/share.
- Clearly distinguish optional vs required fields and verified vs suggested values; include useful inline help, validation and responsive layout.

## Integration, security and data
- Inspect actual client/store, mockup, product, R2 and growth-document schemas first; reuse existing records and functions, avoid duplicate systems.
- Preserve account isolation, RLS, private artwork access, role-based approval, document version history and review links.
- Keep supplier costs/margins out of client exports. Verify prices are customer-approved; never fabricate inventory, sizes, colors, availability, or print specifications.
- Sanitize HTML/text and validate uploaded images, URLs, asset ownership, font licensing, and document content.
- Make export endpoints authenticated and account-scoped; rate-limit large exports; avoid unbounded image memory use.
- Add migrations only when necessary, with rollback/compatibility strategy.

## Verification and deployment
1. Check out branch and inspect live main for drift, merge conflicts and existing work.
2. Inventory all 35 templates against blueprint; implement sections, inputs, data connectors and rendering.
3. Add unit, integration and security tests: 35-template coverage; DOCX/PDF content parity; catalog grouping/variants; mockup ownership; price redaction; client isolation; approval; malformed/missing data; large images; empty collections; XSS.
4. Run npm ci, npm run test:marketing, relevant tests, npm run lint, npm run build and ideally npm run check. Investigate any failures. Do not bypass DTF live verification prebuild gate.
5. Inspect Supabase schema/RLS and migrations; apply compatible migrations safely, verify access controls.
6. Validate representative outputs visually: school brochure, catalog with multi-color variants, product sheet, comprehensive brand guide, placement guide, quote, wedding package, and other template families. Check actual Word and PDF output.
7. Review Netlify environment and deploy pipeline, rollback and production branch; open PR, review checks, merge to main only after gates pass.
8. Verify Netlify production deploy and live website, authentication, document generation, mockup integration, saved drafts and downloads; report actual deploy ID, commit SHA and evidence.
9. Update user guide, technical docs and troubleshooting.

## Acceptance criteria
- Every one of 35 document types has distinct purpose-specific sections and meaningful professional layout.
- All completed fields yield accurate, complete client-ready DOCX and PDF; draft/approval states enforced.
- Catalog and product listing integrate authorized client store/mockup products, grouped and decorated as specified.
- Brand and placement guides reflect verified client/production data and clearly flag unknowns.
- All source/customer financial data protected; no cross-client leakage.
- Tests, build, migrations and production smoke checks pass; rollback available.
- Final report distinguishes implemented, tested, deployed and verified with evidence.

## Related independent work
There is an unrelated open PR #226 for optional equipment/material recipe drafts. Do not combine it with this feature or deploy its migration accidentally; coordinate separately.

## Reporting
Return summary of implementation, test results, PR and commit, database changes, deployment evidence, live URL checks, and remaining issues. Do not claim success based solely on a GitHub push.

## Current branch workflow

In Marketing Document Builder, choose a template and client, then complete the template's required sections with confirmed details. For an existing storefront, select Product Catalog or Product Description and use **Import client store products and approved mockups**. A product description requires choosing one imported product. The catalog includes all products returned from the linked live store campaigns. Confirm prices, sizes, colors and specifications before generating the draft.

Select **Generate draft** and check the required-content list. **Download Word draft** and **Download PDF draft** produce files labeled for internal review. Save the draft under the client to request manager approval. Once a complete new-format document is approved, use its **Download approved Word** or **Download approved PDF** action. Saved images are resolved through the existing private artwork and shared-asset functions at download time.

### Import troubleshooting

The CRM account must link to a customer record. A live store campaign must link to that customer's Mockup Studio project. Each selected store product must have a WooCommerce product ID linked to a project for the same customer, a confirmed USD selling price, and at least one selected and approved mockup. The import stops if a selected product fails those checks. Review the item's sizes and colors against the store before distribution. The import verifies the live WooCommerce listing, captures purchasable variants and their customer prices, and matches offered colors to selected and approved mockups. Simple products use verified published pricing and linked blank metadata for size and color. The import includes visible fabric, fit, care, decoration, material and size-chart attributes when the listing provides them.

### Brand and placement guides

Enter the application or placement rows in the order shown, with one row per line. Upload approved examples and enter one caption per image in the same order. Record the revision, date and approving party. For placement, enter the garment and size range, placement, measurement origin and offset, finished artwork dimensions, allowed range or tolerance, and decoration method. For brand use, enter the mark, background, minimum size and applicable restrictions for each verified production method. Confirm any Pantone, CMYK or thread values against the client's source. Both Word and PDF include the specification table and captioned images.

### Release verification still required

- Verify an isolated storefront with multiple products, decorated color variants and two distinct client accounts through import, saved draft, manager approval, client review and both downloads. Production had no selected storefront product records or customer-linked Mockup Studio projects during the read-only inspection.
- Verify store variation, product specification and approved image coverage with a representative live or staging assortment. Verify that shared asset storage paths and R2 access work through a private review and approved export.
- Verify the new commit's required checks and the production-context Netlify release gate before merging. After release, check the production deploy record and authenticated workflow.
