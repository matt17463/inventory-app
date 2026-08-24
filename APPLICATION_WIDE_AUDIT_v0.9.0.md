# Skilled Crafting Inventory — Application-Wide Review

Version reviewed: 0.8.14 cumulative source  
Upgrade produced: 0.9.0  
Review date: August 24, 2026

## Executive summary

The application is broad and operationally valuable, but its greatest long-term risk is product identity fragmentation: brand, style, color, size, supplier SKU, internal SKU, barcode, and WooCommerce IDs can be resolved by several different screens and functions. Most individual workflows are guarded, but the same real-world blank can still become more than one database record when close matches are interpreted differently.

Version 0.9.0 adds a safe, read-only Product Integrity Center so these conflicts can be measured before any cleanup is attempted. It also removes a vulnerable spreadsheet dependency, bounds spreadsheet and ZIP imports, improves supplier matching at larger catalog sizes, updates vulnerable dependencies, reduces the initial browser bundle, and prevents incomplete local/CI builds.

No production inventory, projects, images, orders, or lookup values are changed by this upgrade. The SQL migration is additive and read-only.

## Review scope

The review covered:

- 128 browser JavaScript/React files.
- 82 application routes.
- 38 Netlify JavaScript files, including 28 deployed function entry points.
- 25 SQL migration/audit files, including the new diagnostic migration.
- Inventory, receiving, supplier catalog, product matching, bin transfers, pull sheets, production, purchasing, WooCommerce, customer portals, artwork, Mockup Studio, R2 storage, authentication, navigation, deployment, and automated tests.

## Verification results

| Check | Result |
| --- | --- |
| Automated tests | 64 passed, 0 failed |
| Netlify module validation | 38 files passed |
| Production build | Passed |
| Required-feature bundle verification | Passed across 88 JavaScript chunks |
| Production dependency audit | 0 known vulnerabilities |
| ESLint | 0 errors, 40 warnings |
| Initial JavaScript entry | Reduced from about 1.68 MB to about 467 KB uncompressed |
| SQL behavior in this release | Additive, idempotent, read-only diagnostics |

The remaining lint warnings are documented technical debt, mainly older React effect dependency warnings and unused legacy helpers. They do not stop the verified build, but should be resolved screen-by-screen with workflow testing rather than by a blind automated rewrite.

## Changes included in 0.9.0

### 1. Product Integrity Center

A new **Tools & Admin → Product Integrity Center** page reports:

- Multiple blank products with the same Brand + Style + Color + Size identity.
- Duplicate normalized internal SKUs.
- Duplicate normalized barcodes/UPCs.
- Blank products missing identity fields.
- Duplicate normalized brand, style, color, or size lookup names.
- Blank products that still reference an archived color.

The page is intentionally read-only. It does not guess which product is correct, merge records, rewrite inventory history, or delete anything.

### 2. Safer supplier matching

The supplier confirmation parser no longer loads only the first 5,000 blank products and searches that truncated list in memory. It now:

- Uses saved supplier mappings first.
- Uses supplier catalog mappings second.
- Fetches mapped blank IDs directly.
- Looks up complete Brand + Style + Color + Size identities exactly.
- Stops at two candidates so an ambiguous identity is sent to review instead of guessed.
- Limits parallel database lookups to avoid a request burst.
- Treats stale mappings to missing blank products as review items.

This directly addresses missed matches and accidental product creation after the catalog grows beyond an arbitrary row limit.

### 3. Safer spreadsheet and archive imports

The vulnerable `xlsx` package was removed and replaced with `read-excel-file` plus a small RFC-style CSV/TSV parser.

Safeguards now include:

- XLSX, XLSM, CSV, TSV, and TXT support.
- A 15 MB spreadsheet limit.
- A 50,000-row spreadsheet limit.
- Stable unique headers when a supplier file repeats column names.
- Quoted commas, quoted line breaks, and escaped quotes in CSV.
- A 50 MB ZIP upload limit.
- A 25 MB per-entry extraction limit.
- A 150 MB total extracted-data limit.
- Existing nested archive depth protection.

Legacy binary XLS files must be saved as XLSX or CSV before import.

### 4. Faster application startup

Application pages are now loaded by route instead of placing every screen in the initial JavaScript bundle. The initial entry fell from roughly 1.68 MB to 467 KB uncompressed, while route chunks load only when opened.

The remaining largest front-end opportunities are the global CSS file, the 231 KB logo asset, shared inventory API code, and the largest Mockup Studio/manual-order route chunks.

### 5. Build and dependency safeguards

- React Router, Sharp, Vite, and related dependencies were updated.
- The production dependency audit now reports zero known vulnerabilities.
- Local and CI builds use inert build-only Supabase placeholders when a local `.env` is absent. Netlify still uses the real configured values.
- The existing feature verifier still checks every generated JavaScript chunk before permitting deployment.

## Prioritized remaining findings

### High priority

| Finding | Risk | Recommended next phase |
| --- | --- | --- |
| Product identity rules are distributed across multiple screens/functions | Close matches can create duplicate blanks or conflicting supplier/WooCommerce mappings | Create one server-side Product Identity Resolver used by every product-creation/import workflow |
| Duplicate prevention is diagnostic, not yet enforced | New exact duplicates can still be created after review | Clean confirmed duplicates first, then add canonical identity keys and narrowly scoped unique constraints |
| Several browser screens write directly to core tables | Multi-step updates can partially succeed; correctness depends heavily on RLS | Move inventory/product mutations to transactional RPCs or authorized Netlify functions |
| RLS/role coverage is not proven by automated integration tests | A signed-in user could see or change more than intended if a policy drifts | Add a seeded staging database test that verifies each role against every sensitive table/RPC |
| Remaining fixed query limits exist | Large catalogs can silently omit choices or records | Replace limits with server-side search or paginated iteration, prioritizing inventory and sample screens |

Do not add a global unique constraint before the Product Integrity Center has been reviewed. Existing conflicts would make the migration fail and an automatic merge could corrupt inventory history.

### Medium priority

| Finding | User impact | Recommended improvement |
| --- | --- | --- |
| 34 browser prompt/confirm/alert calls | Inconsistent feedback and accidental clicks | Replace with standard reviewed dialogs, validation summaries, and undo where possible |
| 40 lint warnings | Stale closures or unnecessary reloads may hide in older screens | Resolve by workflow group with tests; do not auto-fix all hooks at once |
| Limited end-to-end tests | Static contracts cannot prove real Supabase/WooCommerce behavior | Add Playwright smoke tests against staging and contract tests with seeded Supabase data |
| Large operations have mixed background-job behavior | Timeouts and duplicate retries remain possible outside upgraded workflows | Standardize job records, idempotency keys, progress, retry, and cancellation |
| Logs are fragmented | Troubleshooting requires matching Netlify, browser, WooCommerce, and Supabase timestamps | Add correlation IDs and an employee-visible integration activity log |
| Import review does not show a single confidence vocabulary everywhere | Operators may interpret “matched” differently between tools | Standardize exact, remembered, suggested, ambiguous, and new statuses with evidence |

### Lower priority and usability improvements

- Add a global unsaved-changes warning on long receiving, product, and mockup forms.
- Add keyboard-first receiving controls and a “next unresolved row” action.
- Add saved import drafts and resume-after-refresh behavior.
- Add a preview showing exactly which new brands, styles, colors, sizes, and products will be created before committing.
- Add accessible focus management and screen-reader announcements to async status changes.
- Add a mobile/tablet pass for the widest data tables.
- Add automated backup verification and a documented restore drill.
- Optimize the logo and split global CSS after visual regression coverage exists.

## Recommended product-identity design

The next major data-quality phase should use one canonical sequence:

1. Normalize supplier and internal identifiers without discarding the originals.
2. Match an exact saved supplier SKU mapping.
3. Match an exact internal SKU or barcode.
4. Match a remembered supplier color/size alias.
5. Match one exact canonical Brand + Style + Color + Size identity.
6. If several candidates remain, require an operator decision and remember it.
7. If none remain, preview the proposed new lookup/product records before creation.
8. Write the product, mapping, and receiving transaction atomically with an idempotency key.

After existing duplicates are reviewed, store a canonical identity key and enforce it only for active blank products. Preserve historical source text and aliases for auditability.

## Safe rollout recommendation

1. Deploy 0.9.0 and install the additive SQL migration.
2. Open Product Integrity Center and export or record the high-priority groups.
3. Do not delete or merge records yet.
4. Verify a supplier confirmation, inventory spreadsheet, supplier ZIP, pull sheet, Mockup Studio project, and WooCommerce draft.
5. Use the diagnostic results to design a controlled merge plan with transaction-level history preservation.
6. Only after cleanup should duplicate-prevention constraints be proposed.
