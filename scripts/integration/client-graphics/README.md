# Isolated Client Graphics verification

This harness runs the repository's actual recipe/traveler migrations, RPC, triggers,
reconciliation helper and Netlify handlers on disposable in-memory PostgreSQL
(PGlite). It never connects to Supabase or any external business service.

From the repository root:

```sh
npm ci
npm ci --prefix scripts/integration/client-graphics
CG_TESTED_SHA=$(git rev-parse HEAD) node --experimental-test-module-mocks scripts/integration/client-graphics/verify.mjs
scripts/integration/client-graphics/node_modules/.bin/php-wasm-cli -l wordpress/skilled-crafting-graphic-choices/skilled-crafting-graphic-choices.php
scripts/integration/client-graphics/node_modules/.bin/php-wasm-cli scripts/integration/client-graphics/wordpress-runtime.php
```

The integration command intentionally returns nonzero for unmet application
requirements. The expanded release-verification cases cover the repaired status/null guards,
legacy/inherited artwork preflight, original checkout capture fallback and retry.
Do not convert these failures to passing expectations merely to make CI green.
See `integration-results.json` for named cases and SQL error messages.

Browser fixtures, with the root dependencies installed:

```sh
node --experimental-test-module-mocks scripts/integration/client-graphics/server.mjs
scripts/integration/client-graphics/node_modules/.bin/php-wasm-cli -S 127.0.0.1:4176 -t scripts/integration/client-graphics
```

Open http://127.0.0.1:4175/client-graphics and
http://127.0.0.1:4176/storefront.php. Both bind only to loopback. The React harness
uses the actual three application components and real handlers, substitutes a
fictional employee session, a query adapter and local artwork URL, and automatically
confirms physical-sample dialogs. This is test simulation, never sample sign-off.
The PHP harness runs actual plugin hooks with minimal WordPress/WooCommerce stubs;
it creates no order and invokes no payment flow.

Schema scope: job/job-item columns use read-only column metadata from the application,
with their PKs and job FK. Recipe, traveler and graphics schema/functions/triggers
come from repository SQL unchanged. Relevant role functions are loaded from source.
Artwork/project and material dependency table definitions also come from source.
Unrelated inventory/customer FK targets, pre-existing job triggers, hosted Auth,
PostgREST, storage-object existence and complete Supabase defaults are not reproduced.
Graphics migrations are applied and reapplied in a single transaction while holding
ACCESS EXCLUSIVE locks on the parent traveler and traveler-line tables. This tests
a rollout plan that prevents writes between migrations 003 and 004; it does not
apply the plan to production. The inheritance fixture uses normal draft/manager
approval, leaves the original revision unchanged and never disables a trigger.
The pgcrypto CREATE EXTENSION is omitted because UUID generation is built into the
PostgreSQL runtime. No production rows, credentials or database dump are included.

The query adapter is a fixture, not the Supabase client or PostgREST. Netlify handler
authorization is replaced with a deterministic employee role; SQL RPC authorization
uses the actual role tables/functions and authenticated/anonymous database roles.
Node module mocks require the experimental flag. Native PHP can run the PHP tests
instead of PHP.wasm. PHP.wasm 3.1.60 declares a newer Node 24 engine than the local
24.16 runtime; execution succeeded locally and CI uses the latest Node 24.

## Storage receipts (migration 005)

The fixture includes the actual artwork ALTER TABLE block from the earlier R2
storage migration. Receipt tests apply 005 separately, leaving the existing 54-case
behavioral suite independent of storage attestations. Run:

```sh
node scripts/integration/client-graphics/verify-storage-receipts.mjs
node --experimental-test-module-mocks scripts/integration/client-graphics/verify-storage-endpoint.mjs
```

The second command exercises the real preflight handler and SQL trigger together.
Its R2 HEAD and Supabase download responses and handler authentication are simulated;
no object-store credentials or network calls are used. PostgreSQL roles, constraints,
receipts and traveler RPC are real isolated database operations. A zero-byte R2
object currently exposes a production defect: a receipt and traveler are accepted.
The failing assertion is retained for browser-side remediation.
