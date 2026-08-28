# Purchasing Demand Deduplication v1.1.2 Manifest

## Application changes

- Reads both the deployed `demand_sources` field and the legacy `sources`
  field.
- Reads both prefixed and legacy demand-source summary fields.
- Uses reservation quantities even when a legacy `quantity` field is zero.
- Deduplicates Pending Stock and non-inventory additions by `job_item_id`.
- Prefers `sc_purchasing_demand_sources_v2` and safely falls back to the v1
  view while deployment is in progress.

## Database changes

- Adds `sc_purchasing_demand_sources_v2` as a non-destructive compatibility
  view.
- Preserves reservation and pull-sheet identifiers.
- Repairs demand quantities using `quantity_reserved` when required.
- Makes no changes to existing operational records.

## Tests

- Supports current and legacy Supabase response shapes.
- Confirms `quantity_reserved` is used when `quantity` is zero.
- Confirms Pullsheet 195's quantity 3 is not added twice.
- Confirms genuinely new Pending Stock demand remains included.

## Included files

- `package.json`
- `package-lock.json`
- `src/lib/inventoryApi.js`
- `src/lib/purchasingDemandSources.js`
- `scripts/tests/purchasing-demand-deduplication.test.mjs`
- `deployment/sql/38_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql`
- `deployment/sql/39_VERIFY_PURCHASING_DEMAND_SOURCE_DEDUPLICATION.sql`
- `deployment/PURCHASING_DEMAND_DEDUPLICATION_V1.1.2_DEPLOYMENT_GUIDE.md`
- `deployment/PURCHASING_DEMAND_DEDUPLICATION_V1.1.2_MANIFEST.md`
