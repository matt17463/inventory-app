# Steps 6–14 Safe Deployment

## Overview

This package completes the remaining recommendations while preserving the live inventory and order system established in Steps 1–5.

| Step | Change | Operational effect |
|---|---|---|
| 6 | WooCommerce status validation and audit | Restricts accepted statuses, reads the current order before changing it, records attempts/outcomes, and avoids unnecessary updates. |
| 7 | Supplier catalog sync hardening | Downloads each supplier source once per run, stores it temporarily in a private bucket, enforces timeout/size limits, and resumes by `run_id`. |
| 8 | Pull-sheet idempotency | Rechecks every mapped job item for an active reservation on every run and repairs missing reservations without overwriting mismatches. |
| 9 | Retire legacy product creation | `/create-product` remains as a compatibility redirect to the current blank-item editor; dormant `bin_items` writers are removed from deployable source. |
| 10 | Route fallback | Unknown employee URLs render a real Not Found page instead of a blank shell or dashboard. |
| 11 | Repository cleanup | Known stale deployable copies are removed and preserved only as `.txt` references under `docs/legacy-code/`. |
| 12 | ESM standardization | Every Netlify JavaScript function uses ESM; a validator rejects future CommonJS function files. |
| 13 | Automated validation | Adds route/security/static tests, SQL safety validation, and a GitHub Actions workflow. |
| 14 | Deployment health | Adds an admin/manager health page and secured Netlify endpoint that checks configuration presence, database objects, storage, build metadata, and optionally WooCommerce connectivity. |

## What remains untouched

The required SQL does not:

- Delete or update existing inventory balances or movements.
- Delete, merge, or renumber jobs, job items, or reservations.
- Change existing WooCommerce product mappings.
- Rebuild supplier catalog data.
- Change existing order statuses.
- Drop tables, views, functions, triggers, policies, or buckets.
- Add a uniqueness constraint to existing job items automatically.

The application changes preserve the existing canonical routes and integration URLs. Compatibility wrappers for the legacy Netlify endpoint names remain deployed.

## SQL files

### Preflight

`supabase/verification/000_steps6_14_preflight_read_only_v3.sql`

The preflight creates only a session-local temporary result table. It checks:

- Required Steps 1–5 relations and migration records.
- Required existing RPC names.
- Live ID types used by the reservation helper.
- Duplicate jobs by WooCommerce order ID.
- Duplicate job items by WooCommerce line-item ID.
- The current state of the `supplier-sync-cache` bucket.

Do not proceed while any row reports `STOP`. Review every `REVIEW` row before deployment.

### Required additive migrations

1. `202607250501_step6_woocommerce_status_audit.sql`
2. `202607250601_step7_supplier_sync_runs_and_cache.sql`
3. `202607250701_step8_pullsheet_idempotency_support.sql`
4. `202607251301_step14_deployment_health.sql`

### Optional hardening

`supabase/optional/202607250702_optional_pullsheet_unique_index.sql`

This creates a unique partial index on `(job_id, woocommerce_line_item_id)`. It aborts without changing anything if duplicate groups exist. Apply it during a low-traffic period only after duplicate review.

### Verification and rollback aids

- `supabase/verification/900_steps6_14_post_install_verification.sql`
- `supabase/tests/002_steps6_14_contract_smoke.sql`
- `supabase/verification/910_steps6_14_optional_rollback.sql`

The rollback file is deliberately commented and limited to newly added metadata objects. Do not use it casually; the code deployment should be rolled back first.

## Required Netlify environment variables

Keep all variables established in Steps 3–5. Confirm at least:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SC_ALLOWED_ORIGINS=https://inventory.skilledcrafting.com

WC_CONSUMER_KEY
WC_CONSUMER_SECRET
WC_WEBHOOK_SECRET

MANUAL_PULLSHEET_SECRET
SC_PULLSHEET_SECRET
SC_ARTWORK_WEBHOOK_SECRET
```

Optional Step 6–7 controls:

```text
WC_STATUS_ALLOWED_STATUSES=pending,processing,on-hold,completed,cancelled,refunded,failed
SUPPLIER_CATALOG_SYNC_CHUNK_SIZE=50
SUPPLIER_CATALOG_SYNC_MAX_CHUNK_SIZE=250
SUPPLIER_CATALOG_DOWNLOAD_TIMEOUT_MS=30000
SUPPLIER_CATALOG_MAX_SOURCE_BYTES=104857600
```

Do not prefix secret or service-role variables with `VITE_`.

## Deployment order

1. Create a current Supabase backup/recovery checkpoint.
2. Preserve the current working Netlify deploy for immediate rollback.
3. Run the preflight and export its result grid.
4. Resolve every `STOP` result.
5. Review duplicate job and line-item groups. Do not delete or merge them as part of this deployment.
6. Run the four required migrations in the listed order.
7. Confirm the `supplier-sync-cache` bucket exists and is private.
8. Deploy the updated application and functions.
9. Run the post-install verification SQL.
10. Open **Tools → Deployment Health**, run the standard check, then run the deep WooCommerce check.
11. Complete all smoke tests below.
12. Keep the previous deploy available until normal order and inventory activity has been observed successfully.

## Smoke tests

### Step 6 — WooCommerce status

Use a non-production-impacting test order where possible.

1. Open the order/pull-sheet workflow as an admin or manager.
2. Request the order’s current status again; expect a successful `changed: false` response.
3. Change to one allowed status; confirm WooCommerce and the app status board agree.
4. Query `sc_woocommerce_status_change_audit` and confirm `attempted` and `succeeded` entries.
5. Submit an invalid status through a test request; expect HTTP 400 and no WooCommerce change.
6. Test as an `operator` or `viewer`; expect HTTP 403.

### Step 7 — Supplier feed

1. Start one feed sync from the app.
2. Confirm a row appears in `sc_supplier_catalog_sync_runs` with `running` status.
3. Confirm the browser/client retains and sends the returned `run_id` for later chunks.
4. Confirm the source file is downloaded once and subsequent chunks read the cached object.
5. Confirm the run becomes `completed` and the cached object is removed.
6. Start two runs for the same feed simultaneously; the second should be rejected rather than overlap.
7. Test a source above the configured maximum or an unavailable source and confirm the run is marked `failed` without changing prior catalog rows from earlier successful chunks.

### Step 8 — Pull sheets

1. Reprocess an existing order whose job items and reservations are already correct.
2. Confirm no duplicate job or job-item rows are created.
3. Confirm existing reservations are counted as `reservations_existing`.
4. In a controlled test, remove only a test job item’s reservation using your existing administrative process, then rerun the pull sheet.
5. Confirm the missing reservation is recreated.
6. Create a controlled mismatch and confirm it is reported for review rather than overwritten.
7. Confirm an in-production job is not reset to `queued` merely because the webhook is delivered again.

### Steps 9–10 — Routes

1. Open an old `/create-product` bookmark; confirm it redirects to `/inventory/edit-blanks`.
2. Open a nonsense employee URL; confirm the Not Found page appears with working recovery links.
3. Confirm customer portal links still render publicly and outside the employee shell.

### Steps 11–13 — Build validation

Run locally or in CI:

```bash
npm ci
npm run functions:esm
npm test
npm run lint
npm run build
```

`npm run check` runs the combined ESM, test, lint, and build sequence.

### Step 14 — Deployment health

1. Sign in as an admin or manager and open `/deployment-health`.
2. Confirm no secret values are displayed.
3. Run the normal check; database relations, functions, migrations, release, storage, and environment presence should pass.
4. Run the deep check; WooCommerce API connectivity should pass.
5. Test as an operator/viewer; expect access to be denied by the function.

## Monitoring queries

```sql
-- Recent WooCommerce status actions
select *
from public.sc_woocommerce_status_change_audit
order by created_at desc
limit 50;

-- Supplier run status
select *
from public.sc_supplier_catalog_sync_runs
order by started_at desc
limit 50;

-- Pull-sheet rerun and repair status
select *
from public.sc_pullsheet_sync_runs
order by created_at desc
limit 50;
```

## Known deployment boundaries

- The migrations were generated from the supplied application and prior migration packages, not executed against the live Supabase project.
- The preflight is the authority for live type compatibility and duplicate conditions.
- The optional unique index is intentionally separate because enforcing uniqueness can fail or block writes when historical duplicates exist.
- Supplier imports are chunked and resumable, but a failed run can retain its private cached object for diagnosis. Remove stale failed-run cache objects only after reviewing the associated run record.
