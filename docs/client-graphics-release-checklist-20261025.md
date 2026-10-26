# Client Graphics production release review and rollout checklist

Release candidate: `feature/client-graphics-production-rules-20261025`
Verified starting revision: `7cdd47786bf3b6f608a4ee23960e768b19bdd007` (2026-10-25).
**Planning only: not authorization to merge, migrate or deploy.**

## Evidence already accepted
- All three GitHub Actions workflows passed on the stated tested SHA: 508 full application tests, 54 isolated integration tests, 15 PHP plugin-hook checks. The 37 graphics unit tests are included in the 508.
- The four prior SQL/capture regressions passed in isolated PGlite.
- Hosted Supabase/PostgREST was intentionally excluded. Simulated Woo/QBO is not external interoperability.
- Any commits after the verified SHA require fresh workflow results.

## Required R2 storage gate
1. Choose disposable/noncustomer artwork objects in the authorized R2 test bucket, including one approved file and deliberately absent/wrong-key cases.
2. Validate the DB artwork record points to the correct provider, bucket, storage key and immutable production revision; test the **original production asset**, not a preview.
3. From an authenticated authorized employee session, exercise `signedAssetUrl(row, 3600, {preferPreview:false})`, the Netlify signing handler, and an actual HTTP fetch. Check nonempty payload, expected MIME type and verified byte/content hash if available.
4. Confirm expired URLs fail as intended; unauthorized or unauthenticated signer requests are rejected.
5. Confirm an absent R2 object (even when its DB preflight status is passed) blocks *production traveler creation*, including direct RPC calls. Current SQL guards consult metadata only; this is **not yet proven**. Design an authenticated server-side object-presence attestation or equivalent durable verified evidence before declaring this check passed. Never add network calls inside PostgreSQL triggers.
6. Remove only disposable objects when done; do not modify real customer assets.

## External and physical gates
- In an isolated WooCommerce environment, verify selectable and fixed designs, checkout canonical UUID and line data, order sync, capture retry, and traveler selection. No live carts, payments or inventory changes.
- If within release scope, verify QuickBooks sandbox OAuth and manual/invoice mappings using fictional transactions only. No real invoices.
- Obtain signed shop sample checks for adult/youth print dimensions, exact front/back/left-chest placement, neckline offsets, halftones, real production file appearance, and physical traveler QR print/scan.
- Hosted Supabase test omission must be explicitly recorded and accepted by release owner; do not create paid resources without authorization.

## Deployment sequence — separate approval required
1. Freeze candidate SHA and receive passing application, graphics and isolated-integration CI results for that exact SHA. Record backup/restore evidence, responsible operator and rollback decision point.
2. Confirm the Client Graphics storefront selector remains disabled; staged bindings remain disallowed, and `SC_GRAPHIC_ORDER_CAPTURE_ENABLED` remains off until a coordinated activation.
3. Assess transaction duration and locks off-hours. Apply graphics migrations `202610250001` through `202610250004` **together in one transaction** with appropriate exclusive traveler-table locks, as rehearsed; no traveler writes between 003 and 004. Capture exact schema migration log and verify RLS, grants, trigger status, RPC and dependency tables before permitting production traffic.
4. Deploy the verified application once after separately approved migration/release plan. Keep existing Woo graphics and customer store mappings unchanged.
5. Run read-only authenticated smoke checks, followed by **explicitly authorized** controlled fictional test order and traveler checks. Monitor webhook failures, capture outcomes, R2 signing, RPC errors, QR routes, and inventory reconciliation.
6. Activate storefront choice and webhook capture only after dedicated approval and source-product binding verification. Do not migrate historical customer mappings automatically.

## Rollback planning
- Before migration, document database backup/PITR availability; do not assume an unapplied DDL migration can be safely reversed by dropping tables/triggers.
- On application issues, disable new selectors/capture and roll back application code to the prior verified production release as authorized. Preserve graphics selection and audit records.
- For database issues, decide on restore/forward-fix based on the backed-up prechange state and dependency inventory; do not remove production records blindly.

## Sign-offs
- [ ] Actual R2 object and missing-object blocking
- [ ] Authorized signed download and role denial
- [ ] Isolated WooCommerce end-to-end
- [ ] QuickBooks sandbox or explicit scoped omission
- [ ] Physical artwork and QR sample
- [ ] Hosted Supabase limitation accepted
- [ ] Exact-SHA CI recheck
- [ ] Atomic migration/backup/rollback approval
- [ ] Separate production deployment authorization
