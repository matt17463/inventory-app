# Audit validation

Local checks on 2026-10-22, based on the repository main branch cloned for this audit. No Netlify CLI, preview deployment or hosting mutation was used.

| Check | Result | Limits |
|---|---|---|
| `npm run docs:audit` | PASS: VALID WITH OPEN LIVE QA, no failures | 51 registered plugins, zero fully live-verified plugins; 11 dialog records, two narrowly verified WordPress dialog cases; comprehensive WordPress coverage remains incomplete |
| Focused documentation audit tests | PASS, 6/6 | Updated starter-only assertions to require installation evidence, exact count agreement, explicit missing conditions and full control metadata; preserves application source-only statuses |
| `npm test` | PASS, 387 tests across existing script suites | Local contracts/tests do not certify live plugin behavior |
| `npm run lint` | PASS with 33 warnings, zero errors | Existing application unused-variable/style warnings remain; no automatic fixes applied |
| `npm run guide:pdf` | PASS | Generated local compatibility-check PDF: 191 pages, 327,324 bytes; generated artifacts deliberately excluded from audit PR so original conversation owns final integration |
| PDF structural/text check | PASS | `pdfinfo`: valid unencrypted Letter PDF, 191 pages; pypdf extracted nonempty text from every page |
| PDF sample rendering | PASS on sampled pages 144, 178, 191 | New shipping-dialog reference, shipping controls and final open-audit warning visually inspected; no obvious clipping/overlap in those samples. This is not a full 191-page visual certification |
| `git diff --check` | PASS | Whitespace check only |

The PDF generator currently emits an outdated generic warning saying the live inventory/admin walkthrough has not yet been verified, even though this audit now supplies partial verified evidence. Its “Live reviewed” screen wording also does not display the full new verification boundaries, and its control output omits some advanced/options metadata. The original conversation must reconcile those messages, preserve partial coverage, and complete guide/training/PDF integration. No generator changes are included in this documentation handback.

Dependency installation initially hit an unwritable shared npm cache. Re-running with a workspace-owned cache succeeded without changing global permissions or package versions. Poppler initially lacked a writable font cache/configuration; a temporary workspace font configuration resolved the sample rendering. No dependency or lockfile changes are included.
