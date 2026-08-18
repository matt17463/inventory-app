# Step 2 Application Database Contract

## Contract summary

The contract was generated from the React import graph beginning at `src/main.jsx` plus every JavaScript file inside `netlify/functions`.

It currently records:

- 74 relations referenced by the compiled application or deployed functions
- 230 explicit columns observed in selects, filters, sorting, relationships, and literal mutations
- 143 RPC names, of which 137 are referenced by the compiled application or deployed functions
- 2 Supabase Storage buckets
- 74 declared application routes

## What the contract proves

The contract can identify whether a literal source reference has a corresponding live database object.

It checks:

- Table or view existence
- Explicit referenced column existence
- RPC name existence
- Whether an RPC overload contains the source-referenced argument names
- Storage bucket existence

## What the contract does not infer

The source code is not sufficient to safely reconstruct all production DDL. The contract intentionally does not guess:

- Column data types
- Nullability
- Default values
- Foreign-key delete behavior
- Unique constraints
- Trigger bodies
- Complete view definitions
- RPC return types or implementation bodies
- Row-level security policy intent
- Grants required by server-side service-role operations

Those definitions must come from the production schema baseline.

## Why missing objects are not automatically created

Creating a table or RPC from an incomplete source inference could:

- Select the wrong ID type, such as `uuid` versus `bigint`
- Break an existing foreign key
- Duplicate inventory quantities
- Change pull-sheet idempotency
- Expose data through incorrect grants or policies
- Replace a working RPC with an incomplete implementation

Step 2 therefore reports drift and preserves all working operational definitions.

## Regenerating the contract after source changes

Run:

```bash
npm run schema:contract
```

This runs:

1. `scripts/build_database_contract.py`
2. `scripts/generate_step2_sql.py`

Review the generated CSV and JSON changes before creating a new migration version. Do not overwrite a migration that has already been applied to production; create a new timestamped migration instead.

## New database objects created by required Step 2 SQL

### Tables

- `sc_schema_contract_versions`
- `sc_schema_contract_relations`
- `sc_schema_contract_columns`
- `sc_schema_contract_functions`
- `sc_schema_contract_storage_buckets`
- `sc_application_schema_versions`

### Functions

- `sc_schema_contract_report_v1(text)`
- `sc_schema_snapshot_v1()`
- `sc_schema_fingerprint_v1()`

These objects are isolated from the inventory and order processing model.
