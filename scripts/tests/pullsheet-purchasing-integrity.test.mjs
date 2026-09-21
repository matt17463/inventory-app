import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const list = fs.readFileSync('src/PullSheetList.jsx', 'utf8');
const view = fs.readFileSync('src/PullSheetView.jsx', 'utf8');
const inventoryApi = fs.readFileSync('src/lib/inventoryApi.js', 'utf8');
const integrityApi = fs.readFileSync(
  'src/lib/pullSheetPurchasingIntegrityApi.js',
  'utf8'
);
const fn = fs.readFileSync(
  'netlify/functions/pullsheet-purchasing-integrity.js',
  'utf8'
);
const sql = fs.readFileSync(
  'deployment/sql/63_PULLSHEET_PURCHASING_INTEGRITY.sql',
  'utf8'
);
const verify = fs.readFileSync(
  'deployment/sql/64_VERIFY_PULLSHEET_PURCHASING_INTEGRITY.sql',
  'utf8'
);

test('pull sheet list visibly exposes pull sheet number', () => {
  assert.match(list, /<th>Pull Sheet #<\/th>/);
  assert.match(list, /\/pullsheets\/\$\{job\.id\}/);
  assert.match(list, />#\{job\.id\}</);
});

test('PullSheetView audits and can reconcile Purchasing integrity', () => {
  assert.match(view, /getPullSheetPurchasingIntegrity/);
  assert.match(view, /repairPullSheetPurchasingIntegrity/);
  assert.match(view, /purchasingIntegrityByLine/);
  assert.match(view, /Reconcile Purchasing/);
});

test('Purchasing merges DB integrity adjustments after authoritative calculations', () => {
  assert.match(inventoryApi, /getPullSheetPurchasingIntegrityFallbackRows/);
  assert.match(
    inventoryApi,
    /sc_missing_pullsheet_purchasing_demand_v1/
  );
  assert.match(
    inventoryApi,
    /mergePullSheetPurchasingIntegrityFallbackRows/
  );
  assert.match(inventoryApi, /integrityFallbackRows/);
  assert.match(inventoryApi, /applyAuthoritativePurchasingInventory/);
});

test('repair endpoint is authenticated and admin-manager restricted', () => {
  assert.match(integrityApi, /authenticatedFunctionFetch/);
  assert.match(fn, /authorizeEmployee/);
  assert.match(fn, /\['admin', 'manager'\]/);
});

test('SQL provides audit, adjustment, repair, and mapping reconciliation', () => {
  assert.match(sql, /sc_pullsheet_purchasing_integrity_v1/);
  assert.match(sql, /sc_missing_pullsheet_purchasing_demand_v1/);
  assert.match(sql, /sc_repair_pullsheet_purchasing_integrity_v1/);
  assert.match(
    sql,
    /sc_reconcile_product_mapping_to_open_pullsheet_v1/
  );
});

test('repair never mutates physical inventory movement history', () => {
  assert.doesNotMatch(
    sql,
    /insert\s+into\s+public\.blank_inventory_movements/i
  );
  assert.doesNotMatch(
    sql,
    /insert\s+into\s+public\.inventory_movements/i
  );
  assert.doesNotMatch(
    sql,
    /update\s+public\.blank_inventory_movements/i
  );
  assert.doesNotMatch(
    sql,
    /update\s+public\.inventory_movements/i
  );
  assert.match(sql, /physical_inventory_changed[^;]*false/s);
});

test('placeholder manual SKUs are excluded from durable mapping reconciliation', () => {
  assert.match(sql, /\^MANUAL-\[0-9\]\+-LINE-\[0-9\]\+\$/);
});

test('browser cannot call repair RPC directly', () => {
  assert.match(
    sql,
    /revoke all on function public\.sc_repair_pullsheet_purchasing_integrity_v1\(bigint,uuid\)[\s\S]*from public, anon, authenticated/i
  );
  assert.match(verify, /browser_repair_blocked/);
});

test('verification specifically includes Pull Sheet 272', () => {
  assert.match(
    verify,
    /sc_pullsheet_purchasing_integrity_v1\(272\)/
  );
});
