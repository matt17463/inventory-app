# Marketing Design Studio — four-priority implementation gate (November 2026)

This branch is a **draft**. Do not merge or deploy it until CI, visual review, authenticated integration and the user's final release approval are complete.

## A. Richer illustrated school composition
- Three selectable US Letter compositions retain separately editable client text and an exact approved client logo.
- The generated text-free artwork now appears in the actual proof/export rather than being discarded.
- The athletic composition layers client-supplied merchandise photos at controlled offsets and adds shadows; no invented decorated products are generated.
- School, sports, business, nonprofit, wedding and general client categories have distinct illustrative motifs and client-relevant headings/benefits.
- **Not yet accepted**: compare against the original Sequim High School, Greywolf and Helen Haller reference PDFs at identical dimensions. Obtain authorized high-resolution mascot files and approved realistic decorated product images. The offline artwork is still illustrative vector geometry, not photorealistic production artwork.

## B. Selective editing and AI layout
- A validated layout plan now controls ordering of products, benefits and steps.
- The user can move a selected section to the top, lock placements and regenerate only one concept.
- Layout locks persist with the client draft (v3); reopening requires re-confirming release facts.
- All verified contact details, approved images and logos remain separate from AI-generated backgrounds.
- **Not yet accepted**: arbitrary bounded drag/drop grid placement, collision avoidance, per-element AI editing, and genuine generative photorealistic backgrounds with controlled model cost.

## C. Cross-client template families
- The printed Studio text reflects school, sports/team, business, nonprofit, wedding/event and general clients.
- Category visual motifs vary without altering approved identity. No generated financial promises or supplier costs.
- The existing classic document builder and 35-template library remain in place for purpose-specific formal documents.
- **Not yet accepted**: human review of representative finished flyers for each audience, and full parity with Word/PDF export requirements for every existing formal template.

## D. Print quality, protection and CI
- School PDF workflow checks approved artwork, basic pricing, required contacts and intrinsic source image effective DPI.
- AI Studio export requires verified client, exact approved logo data, approved merchandise image(s), headline and contact.
- Conservative single-page text limits and browser overflow checks prevent known clipped content from being printed.
- Explicit human confirmation of rights/approval is required before print/HTML export; editing invalidates the confirmation. This is not a substitute for a server-side manager approval workflow.
- Tests: marketing-school-flyer-preflight, marketing-flyer-print-preflight, marketing-ai-layout-editing are included in `npm run test:marketing`.
- No database migration is introduced by this batch.

## Acceptance before production
1. Wait for GitHub Actions to finish; require passing Marketing Document Builder Regression, visual fixtures, build/lint, and isolated production activation jobs.
2. Authenticated staging test with two different client accounts; confirm cross-client R2 access is rejected and saved/reopened drafts restore images without granting approval.
3. Render all three school references plus at least one business, nonprofit, team and wedding flyer; review both preview and exported PDF side by side, including margin/contrast/font/overflow checks.
4. Verify real product images are approved and accurate, logo rights and use restrictions, price/customer terms and all required copy.
5. Validate print at US Letter, background graphics enabled, screen and actual printer; enforce at least 300 DPI for full-page bitmap covers.
6. Smoke-test legacy brochure/catalog export and approved Word/PDF documents; verify existing production workflow unaffected.
7. Merge to `main` only after the broader project completes, with safe rollback and post-deploy smoke tests. Do not treat a green CI job as visual approval.

No production deployment is authorized by this document.

## Follow-up development: bounded layout and approved store assets
- Operators can adjust hero height (2.80–3.65 in), merchandise gallery height (1.50–2.50 in), vertical gap (0.06–0.22 in), and layered vs grid product placement independently for each concept. Values are normalized; raw CSS and unbounded model coordinates are rejected. Settings persist with v4 client drafts.
- The AI Studio can load verified products from the marketing account's live WooCommerce assortment and pick approved Mockup Studio output images. `marketing-store-assortment` verifies linked customer, live product, availability, customer prices and approved matching colors; `marketing-shared-asset` rechecks customer ownership/approval before signing each download. An operator must still review the image and final copy.
- Print prepares embedded assets, generated scene and fonts before checking layout clipping. Contrast-safe brand colors protect white-on-light text.
- New regression tests: `marketing-studio-layout-controls.test.mjs`; additional layout, approval, storefront and contrast checks in `marketing-ai-layout-editing.test.mjs`.
- An earlier CI run reported two incorrect assertion failures in `marketing-ai-layout-editing.test.mjs` (escaped HTML and a CSS class selector); both were corrected and committed, but the latest full CI result must still be verified.

**Open release blockers:** True rich mascot-led school renderings with approved photorealistic merchandise, granular collision-aware element positioning, authenticated real-client R2/store integration verification and security, and visual comparisons at print resolution. There is still no production release.

## School flyer content parity — verified illustrative fundraising and annual design options
- Each of the three school concept HTML variants now includes a visible artwork refresh, seasonal collection, and sport-/club-specific design options strip. These are offered as possibilities, not AI-generated representations of existing approved logos.
- A school-only opt-in fundraising illustration reads operator-verified decorated wholesale, approved retail and illustrative unit quantity. It calculates the retail-minus-decorated-wholesale difference in integer cents and includes tax, transaction, shipping, refund and approval caveats.
- The flyer does not silently populate or infer prices. Invalid opt-in inputs block client export, and unapproved values are not printed.
- The optional inputs are stored with a private Studio draft (v5) and reopening invalidates staff approval for export.
- Unit cases are in `scripts/tests/marketing-school-fundraising.test.mjs`.
- `scripts/render-marketing-flyer-fixtures.mjs` now emits synthetic Studio HTML for the three school variants plus team, business, nonprofit, wedding and general designs. These are test fixtures, not permitted client-ready exports. Review their typography, spacing and full-page overflow alongside the earlier PDF reference fixtures.
- The Product & Event Center workflow previously failed downloading `onnxruntime-node` (external network timeout before tests). A failed-job rerun was requested; do not represent this as passing until it completes.
