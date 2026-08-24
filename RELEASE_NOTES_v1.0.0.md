# Skilled Crafting Inventory v1.0.0 Release Notes

## Outcome

Version 1.0.0 turns the v0.9 diagnostic foundation into an operational integrity platform. It prevents deterministic duplicate creation, routes core product and pull-sheet writes through authorized server code, persists parsed supplier confirmations as resumable inbox records, and gives employees one place to review data quality and background work.

## New capabilities

- **Central Product Identity Resolver** — ranks remembered supplier SKU, barcode, SKU, complete identity, and partial identity matches.
- **Product Creation Preview** — returns `create allowed`, `use existing`, or `ambiguous` before creation.
- **Guarded Product Creation and Editing** — serializes creation by normalized SKU, blocks deterministic conflicts, and writes before/after audit records.
- **Duplicate Resolution Workbench** — creates review cases with product snapshots, reference counts, proposed survivor, evidence, and status. It never auto-merges.
- **Supplier Receiving Inbox** — saves parsed confirmations in review status before receiving.
- **Faster Supplier Review** — adds row search, review-only filtering, and bulk bin/color/size assignment.
- **Shared Supplier Identity Memory** — approved supplier SKU mappings are copied into the central alias registry.
- **Integration Job Center** — combines application jobs with Mockup Studio AI, WooCommerce mockup export, color lifecycle, and supplier-feed jobs; application-owned jobs support retry/cancel requests.
- **Inventory Reconciliation Center** — reports product conflicts, unlocated movement references, and negative purchasing demand without rewriting the ledger.
- **Team-Store Workflow** — tracks request, artwork, mockup, approval, WooCommerce draft, publication, and completion stages.
- **Server-verified AuthGate** — signed-in users must also have an active application role.
- **Guarded pull-sheet mutations** — status, line status, source-bin, and purchasing-report changes are authorized and audited; line removal preserves the row as cancelled.
- **Clean lint baseline** — the prior React hook and unused-code warnings were resolved; lint now completes with zero warnings.

## Existing functionality used by the coordinated workflow

- Mockup Studio remains the artwork/mockup work surface and uses private Cloudflare R2 storage.
- Existing WooCommerce draft export remains the staged publishing boundary; the team-store workflow records when a store reaches WooCommerce draft and ready-to-publish stages.
- Existing inventory receive/transfer/reservation/completion RPCs remain authoritative for inventory movements.

## Deliberate safety boundary

Version 1.0.0 does not automatically merge duplicate products. A correct merge must account for inventory movements, reservations, pull sheets, WooCommerce records, supplier mappings, and historical evidence. The workbench gathers those references and stages the decision; an employee must review the survivor and evidence. This prevents a “cleanup” feature from silently corrupting inventory history.

## Database changes

Added by `28_APPLICATION_INTEGRITY_PLATFORM.sql`:

- `sc_product_identity_aliases`
- `sc_product_review_cases`
- `sc_product_review_case_items`
- `sc_product_change_previews`
- `sc_integration_jobs`
- `sc_integration_job_events`
- `sc_team_store_workflows`
- `sc_core_mutation_audit`
- product candidate, creation preview, guarded product, and guarded pull-sheet RPCs

No existing inventory quantity, movement, product, job, or reservation row is changed by the migration.

## Verification completed for the package

- Netlify functions validated as ESM.
- Application-integrity contract tests added.
- Complete automated test suite run.
- ESLint run with zero warnings.
- Vite production build run.
- Production dependency audit run.
