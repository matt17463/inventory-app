# Step 2 Safe Deployment — Complete Migration Baseline and Contract

## Purpose

Step 2 establishes a repeatable database migration workflow without reconstructing the live database from guesses.

The application is already tracking production inventory and orders. Therefore:

- The current live Supabase schema remains the source of truth for the initial baseline.
- The Step 2 SQL creates only `sc_schema_contract_*`, `sc_application_schema_versions`, and read-only introspection functions.
- No operational table, view, function, policy, storage bucket, inventory row, order row, reservation, movement, or mapping is replaced by the required migrations.
- Missing operational objects are reported, not automatically created.

## Files installed by Step 2

### Required migrations

1. `supabase/migrations/202607250101_step2_schema_contract_registry.sql`
2. `supabase/migrations/202607250102_step2_schema_introspection_helpers.sql`
3. `supabase/migrations/202607250103_step2_schema_version_marker.sql`

### Required verification

1. `supabase/verification/000_step2_preflight_read_only.sql`
2. `supabase/verification/900_step2_post_install_verification.sql`

### Contract artifacts

- `supabase/contract/application_database_contract.json`
- `supabase/contract/relations.csv`
- `supabase/contract/columns.csv`
- `supabase/contract/rpc_functions.csv`
- `supabase/contract/storage_buckets.csv`

### Baseline tools

- `scripts/step2_capture_production_baseline.sh`
- `scripts/step2_migration_status.sh`
- `scripts/step2_db_push_dry_run.sh`
- `scripts/step2_generate_types.sh`

## Required deployment sequence

### 1. Create a recovery point

Create a fresh managed Supabase backup or confirm point-in-time recovery before database work.

Also preserve:

- The currently deployed Netlify build
- Current Netlify environment-variable names
- Current WordPress plugin build
- A screenshot or export of current inventory totals and open jobs

### 2. Run the read-only preflight

Run only:

```text
supabase/verification/000_step2_preflight_read_only.sql
```

The script creates a temporary session table and reads database metadata. It does not change production objects or business rows.

Stop when:

- `sc_inventory_model_registry` returns `STOP`
- The report shows a relation or RPC missing that is actively used by a working page
- Existing Step 1 objects are unexpectedly absent

A `REVIEW` result is not permission to create a guessed table or function. Save the report so the missing object can be compared to the production baseline.

### 3. Capture the exact production baseline

From the application directory:

```bash
export SUPABASE_PROJECT_REF=your-project-ref
bash scripts/step2_capture_production_baseline.sh
```

This performs schema inspection and export only. It does not run `db push`, `db pull`, `migration repair`, or `db reset`.

Review and retain:

- `supabase/baseline/*_production_public_schema.sql`
- `supabase/baseline/*_migration_status.txt`
- `src/types/database.generated.ts`
- The checksum file

Commit the schema-only baseline and generated types after checking that no credentials or row data are present.

### 4. Align migration history carefully

Run:

```bash
bash scripts/step2_migration_status.sh
```

Step 1 was applied before the migration workflow was established. If the remote migration list does not contain the Step 1 versions but the Step 1 database objects are confirmed present, the versions may be marked as applied:

```bash
npx supabase migration repair 202607250001 --status applied
npx supabase migration repair 202607250002 --status applied
```

Do not run either repair command when the version is already present remotely or when the corresponding objects are not installed. Migration repair changes history records; it does not install SQL.

### 5. Dry-run the Step 2 deployment

Run:

```bash
bash scripts/step2_db_push_dry_run.sh
```

Expected pending versions:

- `202607250101`
- `202607250102`
- `202607250103`

Stop if the dry run proposes any unexpected migration.

### 6. Apply the required migrations

Preferred CLI method after the history is aligned:

```bash
npx supabase db push
```

SQL Editor method:

Run the three required migration files one at a time in numeric order. If they are applied manually and the project will use CLI migrations afterward, verify the objects and then mark those exact versions as applied in migration history.

### 7. Run post-install verification

Run:

```text
supabase/verification/900_step2_post_install_verification.sql
```

Save these results:

- Application schema contract report
- Contract version summary
- Application schema-version ledger
- Schema fingerprint
- Updated inventory-model registry row

## Reading the contract report

### PASS

All required literal relations, columns, RPC names, expected RPC arguments, and storage buckets referenced by the source were found.

### REVIEW

One or more source references do not match the live schema. Common reasons include:

- A dormant exported helper remains in a compiled library
- A feature page exists but its optional migration was never installed
- An RPC was renamed or its parameter names changed
- A view exposes a different column set
- A storage bucket is missing

Do not create or alter the object until its intended definition is recovered from the production baseline, prior SQL, or the working function behavior.

## Optional storage SQL

Run these only when the contract report shows the corresponding bucket is missing:

- `supabase/optional/202607250003_optional_sample_image_bucket.sql`
- `supabase/optional/202607250104_optional_production_photo_bucket.sql`

Both scripts preserve existing buckets and existing policies.

## Smoke tests after Step 2

Because the required migrations are metadata-only, all existing business behavior should remain unchanged. Verify:

1. Blank Inventory totals match the pre-deployment totals.
2. One known bin displays the same contents.
3. Existing open pull sheets load.
4. One existing order displays the same line mappings and reservations.
5. Receiving one test blank creates one expected movement.
6. No duplicate job, job item, reservation, or movement is created.
7. Standalone samples load and retain their images.
8. Production photos still upload and display.
9. Customer, artwork, purchasing, and production pages still load.
10. `sc_schema_contract_report_v1()` returns the saved contract version.

## Prohibited production command

Do not run:

```bash
npx supabase db reset --linked
```

A linked reset can remove the remote user-created schema before replaying local migrations. Use local or isolated staging databases for reset testing.

## Rollback

The limited rollback is:

```text
supabase/rollback/202607250101_step2_limited_rollback.sql
```

It removes only Step 2 metadata and introspection objects. It does not alter operational inventory, orders, samples, mappings, reservations, or storage files.

## Official references

- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/reference/cli/supabase-inspect-db
- https://supabase.com/docs/guides/api/rest/generating-types
