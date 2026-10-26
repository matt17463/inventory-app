# Client Graphics verification — October 25, 2026

## Decision

**Not ready for production.** Automated verification works and the code passes the available automated checks. The new Client Graphics feature needs isolated end-to-end testing and the release blockers below resolved before production activation. No production deployments, migrations, storefront changes, financial transactions, emails, or inventory writes were performed.

Repository: https://github.com/matt17463/inventory-app
Branch: `feature/client-graphics-production-rules-20261025`
Investigated head: `ed979ed1fd3eccebf631bd81d05937ba2e3a6ad4`.

## Root cause and GitHub Actions

The connector's `fetch_commit_workflow_runs` explicitly filters to pull-request-triggered runs, first page only. The actual runs were successful **push** runs. This was a verification visibility problem, not an execution failure.

- Client Graphics: https://github.com/matt17463/inventory-app/actions/runs/40258812401
- Its job/log: https://github.com/matt17463/inventory-app/actions/runs/40258812401/job/121366440858
- Full application: https://github.com/matt17463/inventory-app/actions/runs/40258812372
- Its job/log: https://github.com/matt17463/inventory-app/actions/runs/40258812372/job/121366440373

The Actions UI and unfiltered repository REST endpoint both exposed these runs. Job logs were retrieved through the authenticated GitHub connector; all required steps succeeded on the exact investigated SHA. The push branch filter matches the branch. GitHub recognized and executed the workflow, establishing operational YAML validity and available runners/permissions for those runs. There is no evidence of a policy, billing, runner, or branch-protection block. Private billing/settings and rules were not independently audited; successful runs do not establish every repository policy.

`workflow_dispatch` is declared, but the workflow file is absent from `main` at `41a3dda42e9c098a0ec173c1269d3cfe160ab5cb`. GitHub requires a default-branch workflow for dispatch: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow . The default branch was not changed to expose dispatch. Push-triggered execution already works.

The repository's Netlify ignore script skips non-production builds unless explicitly overridden. The correction commit uses `[skip netlify]`, which prevents branch deployment without the GitHub-wide `[skip ci]` marker. See https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/ . No PR or deploy preview was created. Hosted Netlify environment variables/settings were not inspected.

## Corrections

- `src/ClientGraphics.jsx`: corrected an over-escaped numeric-ID expression that disabled draft product mapping for valid IDs.
- `netlify/functions/_shared/wooGraphicReconciliation.js`: verified `internal` bindings can no longer authorize customer-selected designs. Only verified, allowed `fixed`/`selectable` bindings qualify.
- `tests/wooGraphicReconciliation.test.js`: added runtime tests using an in-memory database fixture for checkout label/placement preservation, webhook replay identity, restricted bindings, missing/conflicting artwork, and lookup failure.
- `package.json`: `npm test` now includes Client Graphics, avoiding reliance on one branch-specific workflow.
- `.github/workflows/client-graphics-branch-verification.yml`: use full `npm run lint` instead of a hard-coded graphics-file list.
- `supabase/migrations/202610250001_client_graphics_foundation.sql`: explicitly revoke direct browser grants and grant server CRUD. Previously service access depended on environment default privileges. Production inspection confirmed these new tables are absent; this unapplied migration was edited only in source.

## Executed checks

Local runtime: Node 24.16.0. The graphics workflow uses Node 22; full application workflow uses Node 24.

| Command / check | Result |
| --- | --- |
| `npm ci` | First attempt failed on unwritable shared npm cache; `npm ci --cache ../npm-cache` succeeded, 212 packages |
| `npm run test:client-graphics` | Original 23 passed; final 27 passed, zero failures |
| `npm test` | Original 471 passed; final 498 passed, zero failures (now includes graphics) |
| `npm run lint` | Passed, zero errors; existing warnings remain |
| `npm run build:vite` | Passed, real compilation using inert local configuration placeholders |
| `npm run functions:esm` | Passed |
| `npm run validate:steps6-14` | Passed |
| `php -l wordpress/skilled-crafting-graphic-choices/skilled-crafting-graphic-choices.php` | Local attempt unavailable: PHP is not installed; same file passed in the exact-SHA GitHub job above |
| Both SQL migrations in isolated PGlite PostgreSQL | Applied and reapplied successfully; constraints and access checks passed |

The full suite covers manufacturing, grouped travelers, print/QR integrations, WooCommerce storefronts, legacy catalog compatibility, order processing, purchasing/inventory contracts, QuickBooks export/OAuth behavior, artwork/R2, and security helpers. Many existing tests inspect source contracts; passing these does not prove live API interoperability or browser behavior.

## Supabase

Only read-only metadata queries were sent to project `uvqxkjqxcqovhkazaxbq`. No new graphics tables exist there. Confirmed bigint job/job-item/Woo line IDs and UUID artwork/recipe artwork IDs. SQL execution used an isolated in-memory PGlite 0.5.10 database with stub dependency tables and fictional rows, not live business data.

Verified: six tables enable RLS; family/artwork/variant and job-line references; composite variant/family FK; positive dimensions; source/order/line uniqueness; one assignment per job line; restricted referenced-file/job-line deletion; explicit service-role read/write; authenticated role sees no rows and cannot insert even if table grants are supplied without policies; repeat migration application.

This is **partial migration readiness**, not a full schema rehearsal. The fixture does not replicate hosted PostgREST, all production defaults/triggers, or complete recipe/traveler dependencies. Before release, run on a disposable full-schema Supabase database and test API roles. No production advisor changes were attempted. Additional FK indexes (rules.variant_id composite, binding family, selections.family_id, transfer proposed family) should be considered against expected workload; the second migration's nonunique job-item index overlaps its partial unique index.

## Integration and representative scenarios

| Scenario | Evidence and limitation |
| --- | --- |
| A: 10 hoodies, adult/youth artwork | Pure engine independently resolves adult/youth approved variants. **Blocked end to end:** Woo supplies literal sizes (e.g. M/YM) as `size_group`, while UI suggests Adult/Youth. There is no verified classification mapping. Do not infer group from ambiguous size alone. |
| B: three customer choices | PHP plugin renders choices and stores UUID/label metadata; parser and real reconciliation helper preserve family/label into keyed selection rows. Fixture verifies replay stays one row. Not exercised through an actual isolated Woo checkout -> job -> traveler. Live binding activation is intentionally unavailable in current management API. |
| C: placements | Resolver matches `placement_name`; fixture exercises Print location metadata -> left_chest -> exact asset. Recipe UI supports separate placement assets. Multi-placement customer rules are not represented in one order-line resolution snapshot; grouping/readiness only checks primary selected asset membership. Full-front/back multi-placement end-to-end verification remains open. |
| D: fictional QuickBooks/manual invoice | Unit contract passed for fictional INV-42; code verifies existing job/line ownership and invoice number and stores assignment keyed to job_item_id. No actual isolated invoice/job workflow or external QBO API call was run; no real invoice was created. |
| E: historical Woo order | Runtime legacy fixture makes no graphics DB writes. Compatibility allows explicit manual recipe/artwork confirmation. No historical order was migrated. |
| Invalid IDs / conflicts / missing files / preflight | Parser rejects malformed IDs; engine blocks equal-ranked conflicts and unresolved variants; traveler helper blocks absent asset records and failed preflight. File bytes/object existence were not checked against R2. |
| Employees / duplicates | Existing security suite passed. Source uses active employee roles, manager/admin catalog mutation, operator assignments, and viewer exclusion. Reconciliation fixture verifies idempotent upsert. No hosted employee-session matrix was executed. |

## Release blockers (do not activate Client Graphics yet)

1. **Server-authoritative traveler validation is missing.** `sc_create_grouped_traveler` checks roles, approved recipes, and job-line membership but not the new graphic selection/preflight rules. The new checks live in `ProductionTravelers.jsx` and its helper; an authenticated direct RPC call can bypass them. Add atomic database/server enforcement, test rejection through the actual RPC, and freeze the verified selection snapshot with the traveler.
2. **Capture errors can look like legacy orders.** `persistWooGraphicSelections` skips malformed canonical IDs and does not persist a blocking state for rejected bindings/lookups. With no selection row, traveler lookup may classify such a managed order as legacy. Distinguish never-managed historical lines from failed managed capture; block production on invalid/missing managed selection. Feature flag `SC_GRAPHIC_ORDER_CAPTURE_ENABLED` defaults off, so coordinated rollout is required.
3. **Size/context mapping is incomplete.** Literal Woo sizes do not match Adult/Youth group rules. Color-group, garment-type and process context are also not populated in the Woo reconciliation helper. Implement verified catalog-driven normalization and test Scenario A through actual enriched Woo payloads, including unknown sizes and placement aliases.
4. **Revision immutability is incomplete.** Approved variants protect file/dimensions/process/version in one request, but allow `family_id`/`state` edits; returning to draft allows later protected-field changes. Enabled rules can also be edited without the activation validation when `enabled:true` is omitted. Enforce immutable approved revisions, safe retirement, and validation of the resulting rule state. Revalidate stale snapshots/retired variants as specified by the release policy.
5. **Artwork and placement evidence is incomplete.** Preflight currently checks asset records/status, not storage object existence. Traveler comparison requires only one resolved asset to occur somewhere in the recipe and does not enforce placement-specific correspondence or a set of variants per line. Verify exact files, placement, dimensions, and multi-placement rules in an isolated full pipeline.
6. **Hosted integration/physical verification remains undone.** Need disposable Supabase + WooCommerce/QBO fixtures, roles matrix, actual checkout/job/traveler/QR journeys, and physical sample sign-off. No safe hosted fixture was available in this task. Do not use production to fill the gap.

## Continuation instructions

Use the same development branch and inspect its newest head and Actions push runs before making changes. Review this report and the correction commit. Address blockers 1–5 with isolated integration tests, then complete the scenario matrix in disposable services. Keep all storefront selectors/bindings/capture opt-in and disabled until separately approved. Do not merge main, deploy, apply production migrations, create real invoices, send emails, process payments, or alter inventory. Browser ChatGPT can continue from repository source and linked Actions logs; local evidence is included in the accompanying downloadable verification bundle.
