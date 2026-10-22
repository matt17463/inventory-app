# Commerce integrity report validation — October 22, 2026

This PR adds sanitized audit reports only. It does not change runtime source, registry verification states, prior audit status, plugin settings or generated public guide assets. The original conversation owns final guide/training/PDF integration.

| Check | Result | Scope / limitation |
|---|---|---|
| Dependency installation | Pass on offline retry | Initial network fetch timed out and npm exited unsuccessfully; `npm ci --offline --ignore-scripts --cache ../npm-cache` then completed. No lockfile changed |
| `npm run docs:audit` | Pass with existing open live QA | `VALID WITH OPEN LIVE QA`; no failures; 11 dialogs / 2 live verified, 51 registered plugins / 0 fully live verified, 93 screens awaiting review; broad audit remains incomplete |
| `npm run test:workflow-first` | **87 passed, 0 failed** | Includes documentation audit, WordPress storefront, commerce-integrity and audit-integration tests. Earlier dependency-incomplete focused run failed to import a package; superseded by this successful run |
| `npm run lint` | Pass, **0 errors / 34 warnings** | Existing runtime warnings; reports-only changes introduce no JavaScript changes |
| `npm run guide:pdf` | Build pass | 226 pages, 417,564 bytes; 93 screens, 35 additional components, 1,240 controls, 18 chapters, 51 plugins, 42 inspected screens / 405 observed fields. Retains `auditStatus:partial` |
| PDF structural/text check | Pass | Opens unencrypted through pypdf; all 226 pages contain extractable text |
| PDF visual spot check | **Open layout issue** | Rendered pages 205, 206, 226. SKU/shipping sections and headers/footers readable on 205–206. Existing page 226 “Important remaining work,” item 4 extends past the right edge; final integration should repair wrapping and re-render. This is not a full visual certification of 226 pages |
| Report link/JSON/whitespace and privacy review | Pass | Required report files present; local links resolved; completion JSON parsed; no raw screenshots, coupon redemption details, customer records or secret values included |
| Netlify preview | Not performed | No preview/deployment triggered by audit commands |
| Production/staging mutation tests | Not performed | Explicitly prohibited on production; no staging copy available for selected SiteGround installation |

Generated PDF, source-scan catalog and documentation audit export were moved to local scratch after checking; they are not proposed for publication in this PR. The regenerated guide reflects main's previous dated baseline, **not these new reports**. Do not cite its old unknowns as superseding the new installed-code findings. Final integration must update the narrative/alias diagnostics and resolve the observed PDF wrapping issue while preserving all unperformed acceptance gates.
