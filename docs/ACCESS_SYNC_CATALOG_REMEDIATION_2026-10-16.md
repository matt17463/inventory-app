# Database access, sync reliability and catalog cleanup

Release 1.4.42 · October 16, 2026

This follow-up addresses the access and integration findings in the shop workflow audit. The database migrations have been applied to the inventory Supabase project. The application and server changes are prepared for GitHub deployment review.

## Database access

- Anonymous clients cannot read internal tables or execute internal RPCs. The only two anonymous RPCs are the current customer portal and its compatibility alias; both return the same limited, token-scoped fields.
- Access uses the current active employee record. Viewers can read operational screens; operators can do shop work; managers/admins can perform catalog repairs and configuration. Deactivation takes effect without waiting for the browser token to expire. Existing ownership policies remain in place.
- Privileged legacy implementations are in the non-exposed `sc_internal` schema. Guarded public wrappers preserve existing signatures and apply role checks. Server-only RPCs remain server-only. WordPress retains service-role access.
- Public schema creation is revoked from app roles, mutable function search paths are pinned, and the remaining unsafe view uses invoker rights. A viewer board read no longer attempts an operator-only cache refresh.

Verification: rolled-back checks cover anonymous, unassigned, inactive, viewer, operator, admin and service access. Nine real viewer read workflows pass, including both production boards, receiving, pull sheets, Shop Touch and catalog reports. Customer portal tests cover valid/expired links, hidden fields, hidden events, cross-customer isolation and direct-table denial.

The security advisor still lists the two intentionally public portal RPCs and 274 authenticated privileged entry points; these are not evidence of anonymous exposure. Role guards and targeted tests are the enforcement layer. Sixty-five tables intentionally have RLS without client policies, including private maintenance/service tables. Leaked-password protection remains an Auth configuration follow-up. No mutable-path or unsafe-view findings remain. References: [anonymous definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Sync reliability

- Per-order leases prevent webhook/manual-refresh overlap. Reservation retries also serialize per order line. Leases expire after five minutes, and release requires the correct token.
- Replaying an order preserves completed jobs/lines, shop-floor blank overrides, existing production quantities and advanced production stages. Quantity changes are reported for review rather than silently changing reservations.
- Fatal order/date/board errors finish the run as failed and release the lease. The sync screen distinguishes failed/incomplete runs from successful imports and provides a manager-only refresh using the current authoritative WooCommerce order.
- The obsolete inventory callback targeted a nonexistent WordPress route and performed network work inside inventory transactions. It is removed. Fifty-three stale internal bin events were retained and classified as ignored; internal inventory is not published as storefront stock.
- Product and attribute imports remain WordPress workflows. The app shows lookup observations separately from order attempts and does not imply that a lookup timestamp proves a complete product import.
- A real global attribute sync exposed a pre-existing new-brand bug: the RPC referenced a nonexistent `brands.created_at` column and failed to recognize an HTML-encoded Port&Co name. The corrected RPC preserves its ID/code, handles exact ampersand encodings, inserts against the actual schema, and never returns success with a missing brand. New-brand creation and repeat imports passed rolled-back tests.
- The full WordPress attribute sync was rerun after the fix: 13 customers, 12 global logos, 28 brands, 53 styles, 59 colors and 28 sizes synchronized with zero failures. Archived aliases remained inactive and inventory quantities/value remained unchanged. Local product logo selections remain a separate source handled by the previously shipped logo discovery.

Eight handler integration tests cover closed jobs, completed lines, production/pairing preservation, quantity changes, concurrent sync rejection, fatal run logging/lease release and manual regeneration. Database fixtures also cover exclusive leases, wrong-token release, terminal reservation skips and open-order-only mapping propagation.

## Catalog results

| Change | Result |
|---|---:|
| Exact missing product-to-blank links repaired | 440 |
| Duplicate lookup entries archived as aliases | 37 |
| Duplicate blank groups resolved using the existing review workflow | 11 |
| Parent aggregate products excluded from physical pairing | 167 |
| Ambiguous duplicate groups saved for review | 2 |
| Physical units before and after | 1,447 |
| Inventory movement rows before and after | 2,284 |
| Estimated inventory value before and after | $10,807.36 |

All per-bin totals were checked, not only the aggregate unit count. Three survivor costs use the saved source quantities/costs to preserve original inventory value exactly; those records are marked for cost review. No movement quantity was rewritten. Historical SKU aliases, lookup names and affected row snapshots are retained.

The remaining duplicate identities contain conflicting costs: Gildan 18500 / Forest / AXL ($10.09 versus $25.00) and Atlantis / NA / Forest / One Size ($14.00 versus $3.00). Review these in **Operations Integrity → Duplicate Workbench**. They are not automatically merged.

Product Data Health now checks barcodes/UPCs and costs on physical blanks, excludes archived rows and approved services/parent aggregates, and provides uncapped totals with pagination. Optional barcodes are informational. The verified post-cleanup snapshot has 1,267 inventory-requiring missing-link findings, 725 missing-cost findings and 1,970 optional-barcode findings. Remaining incomplete or ambiguous source identities require catalog decisions; fuzzy color matches and new inventory were not invented to clear warnings.

Catalog Workbench provides the existing tools in a single sequence and offers bounded exact-only repair batches. Active lookup filters prevent archived aliases from appearing as new choices. Set-based non-inventory matching and indexed open-order reconciliation replace repeated full-catalog/payload scans. Closed order lines are excluded from mapping propagation.

## Verification and release

- Full `npm run check`: existing tests plus eight new behavioral tests, lint (zero errors; five existing warnings), production build and bundle verification passed.
- `npm run validate:steps6-14`: passed.
- Isolated PostgreSQL checks validated 268 guarded legacy signatures and a 5,002-row health fixture, including the final page beyond the old 5,000-row cap.
- Each data migration was exercised in a rolled-back live transaction before application, with inventory invariants checked. Later viewer and brand fixes received targeted rollback tests before application.
- The guide and guided training cover employee permissions, safe sync recovery, exact repairs and health pagination. Training actions do not send order refreshes or catalog repair writes.

The verification SQL is in `supabase/verification/960_access_sync_catalog_read_only.sql`. Database backups and prior definitions are stored only in private `sc_maintenance` tables. Do not export or blindly restore legacy function definitions: a removed callback contained a legacy credential. A rollback should be a narrowly scoped reviewed migration; it must not reopen anonymous access or replay ignored stock events. Application code can revert independently, but the new Sync Health endpoint and health pagination require the matching frontend/server release.

Storefront plugin deactivation and checkout/export cutovers remain separate work. No active WooCommerce plugin was disabled as part of this cleanup.

## Final release follow-up

Release 1.5.0 also includes the complete Marketing & Client Growth workspace; see `MARKETING_CLIENT_GROWTH_1_5.md`. The final sync review consolidated terminal statuses, including Production Complete, fulfilled/archived variants and WooCommerce-prefixed values, so imports, reservations and mapping repair agree. Eleven sync handler tests now cover incoming terminal orders and recorded manual-board failures as well as the original replay cases. Warning summaries are retained in Sync Health instead of disappearing with a request response.
