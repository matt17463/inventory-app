import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Product Type Manager is routed and supports sortable bulk classification', () => {
  const app = read('src/App.jsx');
  const nav = read('src/navigationConfig.js');
  const page = read('src/ProductTypeManager.jsx');
  assert.match(app, /ProductTypeManager/);
  assert.match(app, /\/product-type-manager/);
  assert.match(nav, /Product Type Manager/);
  assert.match(page, /All brands/);
  assert.match(page, /Unclassified/);
  assert.match(page, /Select all visible rows/);
  assert.match(page, /Apply to/);
  assert.match(page, /Create Type/);
  assert.match(page, /Scan Woo Matches/);
});

test('brand plus style classification is authoritative for On-site Sales', () => {
  const sql = read('deployment/sql/56_PRODUCT_TYPE_MANAGER.sql');
  assert.match(sql, /sc_brand_style_item_types/);
  assert.match(sql, /primary key \(brand_id, product_type_id\)/);
  assert.match(sql, /coalesce\(bst\.item_type_id,pt\.sc_item_type_id\)/);
  assert.match(sql, /sc_onsite_inventory_search_v2/);
  assert.doesNotMatch(sql, /update public\.blank_products.*quantity/is);
});

test('Product Type Manager creates types and synchronizes existing Woo products', () => {
  const fn = read('netlify/functions/product-type-manager.js');
  assert.match(fn, /authorizeEmployee/);
  assert.match(fn, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn, /create-type/);
  assert.match(fn, /sc_blank_item_types/);
  assert.match(fn, /sc_brand_style_item_types/);
  assert.match(fn, /products\?status=any/);
  assert.match(fn, /products\/batch/);
  assert.match(fn, /_sc_blank_item_type/);
  assert.match(fn, /Item Type/);
  assert.match(fn, /sync_woo/);
});

test('Mockup Studio writes new classifications to the brand plus style mapping', () => {
  const catalog = read('netlify/functions/_shared/mockupBlankCatalog.js');
  assert.match(catalog, /sc_brand_style_item_types/);
  assert.match(catalog, /brand_id: brand\.id/);
  assert.match(catalog, /product_type_id: style\.id/);
  assert.match(catalog, /item_type_id: itemType\.id/);
  assert.match(catalog, /onConflict: 'brand_id,product_type_id'/);
});
