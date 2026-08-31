import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('on-site sale is routed, responsive, authenticated, and atomically deducts inventory', () => {
  assert.match(read('src/App.jsx'), /OnsiteSales/);
  assert.match(read('src/navigationConfig.js'), /On-site Sales/);
  assert.match(read('netlify/functions/onsite-sales.js'), /authorizeEmployee/);
  const sql = read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql');
  assert.match(sql, /sc_complete_onsite_sale_v1/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /quantity_change.*-1/s);
  assert.match(sql, /sc_onsite_production_orders/);
});

test('purchasing uses authoritative movement-ledger availability', () => {
  const sql = read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql');
  assert.match(sql, /sum\(quantity_change\)/);
  assert.match(sql, /sc_purchasing_authoritative_inventory_v3/);
  assert.match(read('src/lib/inventoryApi.js'), /applyAuthoritativePurchasingInventory/);
});

test('color mapping supports master drop zone and same-name distinct IDs', () => {
  assert.match(read('src/ColorAliasReview.jsx'), /Master color drop zone/);
  assert.match(read('src/ColorAliasReview.jsx'), /text\/sc-color-id/);
  const sql = read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql');
  assert.match(sql, /source_color_id <> canonical_color_id/);
  assert.doesNotMatch(sql, /normalized value/);
});

test('product integrity includes WooCommerce blank reconciliation', () => {
  assert.match(read('src/ProductIntegrityCenter.jsx'), /WooCommerce ↔ blank reconciliation/);
  assert.match(read('deployment/sql/50_ONSITE_SALES_PURCHASING_AND_CATALOG_RECONCILIATION.sql'), /sc_catalog_reconciliation_v2/);
});
