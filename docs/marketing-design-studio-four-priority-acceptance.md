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
