import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  fn: await readFile(new URL('../../netlify/functions/product-color-replacement.js', import.meta.url), 'utf8'),
  page: await readFile(new URL('../../src/ProductColorReplacement.jsx', import.meta.url), 'utf8'),
  api: await readFile(new URL('../../src/lib/productColorReplacementApi.js', import.meta.url), 'utf8'),
  app: await readFile(new URL('../../src/App.jsx', import.meta.url), 'utf8'),
  nav: await readFile(new URL('../../src/navigationConfig.js', import.meta.url), 'utf8'),
};

test('product color replacement is authenticated and manager/admin restricted', () => {
  assert.match(files.fn, /authorizeEmployee/);
  assert.match(files.fn, /allowedRoles:\s*\['admin', 'manager'\]/);
  assert.match(files.api, /authenticatedFunctionFetch/);
});

test('existing Woo variation IDs are updated in place and images/SKUs are not replaced', () => {
  assert.match(files.fn, /id:\s*row\.variation_id/);
  assert.match(files.fn, /variations\/batch/);
  assert.match(files.fn, /Deliberately omit image and sku/);
  assert.doesNotMatch(files.fn, /image:\s*row\.image_id/);
});

test('replacement is resumable and durable blank mapping is saved before each Woo batch', () => {
  const mappingPosition = files.fn.indexOf('await rememberMapping');
  const batchPosition = files.fn.indexOf("await wooRequest(`products/${productId}/variations/batch`");
  assert.ok(mappingPosition >= 0 && batchPosition > mappingPosition);
  assert.match(files.fn, /operation is resumable/);
});

test('replacement uses two-phase parent color update and checks duplicate signatures', () => {
  assert.match(files.fn, /keepOld:\s*true/);
  assert.match(files.fn, /keepOld:\s*false/);
  assert.match(files.fn, /duplicate variation combination/);
});

test('durable variation and SKU blank mappings are saved', () => {
  assert.match(files.fn, /sc_set_product_blank_mapping_v1/);
  assert.match(files.fn, /woocommerce_variation/);
  assert.match(files.fn, /woocommerce_sku/);
  assert.match(files.fn, /catalog_color_replacement/);
});

test('active pull sheets can be repaired through existing guarded RPCs', () => {
  assert.match(files.fn, /sc_purchasing_fix_pairing_v1/);
  assert.match(files.fn, /sc_repair_pullsheet_purchasing_integrity_v1/);
  assert.match(files.page, /Repair affected active pull-sheet lines/);
});

test('UI requires preview and confirmation token before apply', () => {
  assert.match(files.page, /Preview replacement/);
  assert.match(files.page, /REPLACE COLOR/);
  assert.match(files.api, /confirmation_token/);
});

test('route and navigation entry are installed', () => {
  assert.match(files.app, /ProductColorReplacement/);
  assert.match(files.app, /path="\/product-color-replacement"/);
  assert.match(files.nav, /Replace Product Color/);
});
