import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('operational creation paths use the R2 gateway', async () => {
  const files = await Promise.all([
    source('src/SampleInventory.jsx'),
    source('src/lib/phase6Api.js'),
    source('netlify/functions/supplier-confirmation-parse.js'),
    source('netlify/functions/supplier-catalog-feed-sync.js'),
  ]);
  assert.match(files[0], /uploadOperationalImage\(file, 'samples'\)/);
  assert.match(files[1], /uploadOperationalImage\(file, 'production'\)/);
  assert.match(files[2], /putOperationalObject/);
  assert.match(files[3], /putOperationalObject/);
});

test('storage provider fails closed instead of silently selecting Supabase', async () => {
  const operational = await source('netlify/functions/_shared/operationalStorage.js');
  const mockups = await source('netlify/functions/_shared/mockupStorage.js');
  assert.match(operational, /ASSET_STORAGE_PROVIDER must be r2/);
  assert.match(mockups, /MOCKUP_STORAGE_PROVIDER must be r2/);
  assert.doesNotMatch(mockups, /return requested \|\|/);
});

test('migration is dry-run-first and removes legacy files last', async () => {
  const migration = await source('scripts/migrate-operational-assets-to-r2.mjs');
  assert.match(migration, /const execute = process\.argv\.includes\('--execute'\)/);
  const updatePosition = migration.indexOf(`.update(update)`);
  const removePosition = migration.indexOf(`.remove([legacyPath])`);
  assert.ok(updatePosition > -1 && removePosition > updatePosition);
  assert.ok(migration.indexOf(`if (!execute)`) < migration.indexOf(`.download(legacyPath)`));
  assert.match(migration, /R2 checksum verification failed/);
});

test('SQL installs provider metadata and legacy-bucket inventory', async () => {
  const sql = await source('deployment/sql/32_R2_EGRESS_COMPLETION.sql');
  for (const token of ['image_storage_provider', 'document_storage_provider', 'cache_storage_provider', 'sc_asset_storage_inventory', 'sc_storage_bucket_inventory_v1']) {
    assert.ok(sql.includes(token), `Expected SQL token ${token}`);
  }
});

test('health page and function are routed', async () => {
  const [app, nav, fn] = await Promise.all([
    source('src/App.jsx'), source('src/navigationConfig.js'), source('netlify/functions/asset-storage-health.js'),
  ]);
  assert.match(app, /asset-storage-health/);
  assert.match(nav, /Asset Storage Health/);
  assert.match(fn, /migration_complete/);
});

test('large image lists sign R2 URLs in bounded batches', async () => {
  const api = await source('src/lib/assetStorageApi.js');
  assert.match(api, /index \+= 200/);
  assert.match(api, /references\.slice\(index, index \+ 200\)/);
});
