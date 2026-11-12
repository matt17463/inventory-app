# Marketing Document Builder — final release acceptance and rollback runbook

**Status:** Blocked until actual finished artwork, client-specific authenticated tests, physical print proofs and owner sign-off are supplied. This is a development checklist, NOT a deployment authorization.

## Repository and isolation
- Development is isolated in draft pull request #246, branch `feature/marketing-flyer-preflight-20261111`.
- Never merge into `main` or deploy production without satisfying the manual release gate and obtaining a fresh explicit owner go-ahead.
- Use sandbox/staging client records. Do not publish test material to real WooCommerce clients, send customer notifications, create billable orders or change existing approved client artwork.
- Existing marketing CRM/database has **company-wide employee-role RLS**, not one-user-per-client RLS. Client selection is intentionally enforced by client-scoped queries, private asset paths, approval checks and links between CRM account, WooCommerce customer, Mockup Studio project and stored image. Test those boundaries at the application/API layer. Never claim a signed-in employee cannot view a different CRM account via the general authorized employee interface.

## 1. Automated CI and document parity
Run `npm run test:marketing`, `npm run build` and the browser fixture workflow. The 35 legacy marketing templates already have automated native DOCX/PDF exports; `scripts/tests/marketing-native-exports.test.mjs` asserts all 35, section text, no private wholesale cost/AI text, school brochure PDF pagination and editable Word structure. Keep legacy document types functioning while improving graphical flyers.

Capture all eight named CI workflow conclusions at the **same commit SHA**. Job success on an older commit is not sufficient. External `onnxruntime-node` download timeouts are environmental, but must be rerun successfully before release.

## 2. Authenticated client separation — no production writes
Prepare two isolated staging CRM accounts, each linked to a distinct customer and Mockup Studio project, and a published/simulated WooCommerce product (sharing the same product ID is an intentionally adversarial case). For every test use staff-issued sessions; no copied passwords or private access tokens in screenshots or evidence artifacts.

- Client A product selection must return *only* Client A's approved outputs, names, color variants, customer-retail pricing and relevant ordering URLs. Repeat for Client B.
- Attempt to import an output ID from B while client A is selected: the private asset-signing function must return a denial. Retry with unapproved output, unrelated project path, wrong bucket and expired URL.
- Save a draft under A, switch selected client to B and attempt to reopen A's draft **through B's app workflow**: no A imagery/content may appear. This tests UI/account scoping; it does not change the company's employee-wide RLS authorization model.
- Reopen an A draft normally: restore concept images, labels, layout, locked sections and category, but NOT previous approval confirmation. Verify caption edits and individual positioning invalidate approval.
- Confirm the `marketing-artwork-asset` and `marketing-shared-asset` endpoints return `Cache-Control: no-store, private` and short-lived URLs. Confirm authorized logging does not disclose sensitive credentials.
- Save screenshots plus sanitized test request IDs and failure codes; don't store actual client-sensitive data in GitHub.

## 3. Visual references and print art direction
Use **real, expressly authorized** mascot/crest files and approved decorated mockup photos, not synthetic TEST fixtures. Complete side-by-side US Letter review for all cases:
1. Sequim High School; 2. Greywolf Elementary; 3. Helen Haller Elementary.
4. Team/club; 5. Business; 6. Nonprofit; 7. Wedding; 8. Event; 9. General promotion.

For each, review 3 school concepts or 1 category concept, product identity and colors, professional visual hierarchy, headline legibility, realistic product photography, readability on screen and printed page, 200+ effective-DPI client logos/product photography, 150+ effective-DPI background, footer/contact, no overlap, and approved factual claims. Compare against the original rich Sequim design target — synthetic vector fixtures alone must not pass this visual gate. Review optional paid visual scenes only after approving API cost and verifying server configuration; photos, identity and numbers must remain independently editable.

## 4. Physical PDF and Word validation
- Generate US Letter PDF through the browser print workflow with 100% scale, zero print margins and background graphics enabled. Inspect actual resulting PDF page count and trim-safe area; print at least one actual physical sheet.
- Confirm text selection, legible font sizes and no clipping/overlap. Reject an image-only screenshot masquerading as a native editable Word document.
- Validate all 35 existing formal templates with native DOCX/PDF regression tests and manually smoke-test at least one school brochure, quote, product catalog, brand guide, coach package and event proposal. Check client/approved asset correctness and no leaked wholesale supplier cost.
- Confirm the design Studio HTML export is not misrepresented as a Word file. It currently exports print-ready HTML and browser-generated PDF via print; the native Word/PDF pathway is the separately tested classic 35-template builder.

## 5. Release dossier and owner authorization
Fill a private JSON dossier following the data shape in `scripts/tests/marketing-release-gate.test.mjs`; use **actual** artifact links, reviewer names and validated outcomes, not fabricated success flags. Run:
```bash
npm run marketing:release-gate -- /path/to/reviewed-evidence.json <exact-40-character-commit-sha>
```
The check fails closed until all 9 audience visual reviews, 8 passing workflows, authenticated client-scoping tests, 35 native template exports, real print inspection, documented rollback and **owner sign-off matching the exact commit** are present. It does not deploy.

## 6. Rollback and post-release validation
Before eventual approval, record the preceding known-good production deploy identifier, immutable commit and database schema state. Since the present PR adds no DB migrations, rollback should usually be reverting the application deploy to the known-good Netlify version; verify WooCommerce integrations and Netlify functions have not changed incompatibly. After separate authorization, run post-deploy smoke tests with nonbillable sandbox clients and inspect errors. If a critical client-mixup, auth failure or print-regression appears, restore the prior production deploy and document affected references. Do not mutate sales, customer approvals, invoices or inventory while rolling back marketing visuals.

**Open external dependencies:** Real approved high-resolution school/client assets; user-authorized visual sign-off; isolated authenticated staging clients; a working physical printer; and successful premium API credentials/provider execution when that optional pathway is desired. These cannot be truthfully marked complete by synthetic fixtures alone.
