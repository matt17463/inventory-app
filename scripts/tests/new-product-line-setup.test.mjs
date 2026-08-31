import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('new product-line SQL is preview-first and creates no inventory movement', () => {
  const sql = read('deployment/sql/46_NEW_PRODUCT_LINE_SETUP.sql');
  assert.match(sql, /sc_preview_new_product_line_v1/);
  assert.match(sql, /sc_apply_new_product_line_v1/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /ambiguous_active/);
  assert.match(sql, /archived_match/);
  assert.match(sql, /sku_conflict/);
  assert.match(sql, /sc_create_blank_product_safe_v1/);
  assert.doesNotMatch(sql, /insert\s+into\s+public\.inventory_movements/i);
  assert.match(sql, /inventory_movements_created', 0/);
});

test('new product-line apply is server-only and maps exact Woo product rows', () => {
  const sql = read('deployment/sql/46_NEW_PRODUCT_LINE_SETUP.sql');
  assert.match(sql, /revoke all on function public\.sc_apply_new_product_line_v1[\s\S]+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.sc_apply_new_product_line_v1[\s\S]+to service_role/);
  assert.match(sql, /update public\.products[\s\S]+set blank_product_id = v_blank_id/);
  assert.match(sql, /brand_id = p_brand_id[\s\S]+product_type_id = p_product_type_id[\s\S]+color_id[\s\S]+size_id/);
});

test('authenticated UI and endpoint are routed and shipped together', () => {
  const app = read('src/App.jsx');
  const nav = read('src/navigationConfig.js');
  const page = read('src/NewProductLineSetup.jsx');
  const endpoint = read('netlify/functions/new-product-line.js');
  assert.match(app, /NewProductLineSetup/);
  assert.match(app, /path="\/new-product-line"/);
  assert.match(nav, /New Product Line Setup/);
  assert.match(page, /zero on hand/i);
  assert.match(page, /ActionButton type="submit"[^>]*>[^{]*\{working \? 'Checking…' : 'Preview product line'\}/);
  assert.match(endpoint, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(endpoint, /sc_preview_new_product_line_v1/);
  assert.match(endpoint, /sc_apply_new_product_line_v1/);
});
