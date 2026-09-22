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

test('Product Color Manager is authenticated and manager/admin restricted', () => {
  assert.match(files.fn, /authorizeEmployee/);
  assert.match(files.fn, /allowedRoles:\s*\['admin', 'manager'\]/);
  assert.match(files.api, /authenticatedFunctionFetch/);
});

test('replace mode updates existing Woo variation IDs in place without replacing image or SKU', () => {
  assert.match(files.fn, /update:\s*batch\.map/);
  assert.match(files.fn, /id:\s*row\.variation_id/);
  assert.doesNotMatch(files.fn, /id:\s*row\.variation_id,[\s\S]{0,250}image:/);
});

test('add mode copies template color Size × Logo matrix and creates missing variations', () => {
  assert.match(files.fn, /templateVariations/);
  assert.match(files.fn, /action:\s*'create'/);
  assert.match(files.fn, /variations\/batch/);
  assert.match(files.fn, /body:\s*\{\s*create\s*\}/);
  assert.match(files.page, /Add new color/);
  assert.match(files.page, /Size × Logo/);
});

test('add mode requires one uploaded image per logo combination and reuses it across sizes', () => {
  assert.match(files.fn, /imageSlotKey/);
  assert.match(files.fn, /variationLogo/);
  assert.match(files.fn, /slotImages\.get\(row\.image_slot_key\)/);
  assert.match(files.page, /one new garment\/mockup\s*image per Logo combination/i);
  assert.match(files.api, /uploadProductColorImage/);
});

test('variation image uploads use authenticated presigned R2 and supported image types', () => {
  assert.match(files.fn, /presignedR2Put/);
  assert.match(files.fn, /R2 storage is required/);
  assert.match(files.fn, /image\\\/\(png\|jpeg\|webp\)/);
  assert.match(files.api, /method:\s*'PUT'/);
});

test('add mode resolves every new combination to a unique physical blank before apply', () => {
  assert.match(files.fn, /resolveTargetBlank/);
  assert.match(files.fn, /No active \$\{targetColorName\} blank exists/);
  assert.match(files.fn, /candidate \$\{targetColorName\} blanks/);
});

test('new variations receive durable variation and SKU blank mappings', () => {
  assert.match(files.fn, /sc_set_product_blank_mapping_v1/);
  assert.match(files.fn, /woocommerce_variation/);
  assert.match(files.fn, /woocommerce_sku/);
  assert.match(files.fn, /catalog_color_add/);
});

test('partial add-color runs are resumable and reconcile mappings for combinations already created', () => {
  assert.match(files.fn, /reconcile_existing/);
  assert.match(files.fn, /existing_variation_id/);
  assert.match(files.fn, /reconciledExisting/);
  assert.match(files.fn, /Re-preview the product to safely resume only the missing combinations/);
  assert.match(files.fn, /COLOR_IMAGE_META_KEY/);
});

test('replace mode still supports guarded pull-sheet repair', () => {
  assert.match(files.fn, /sc_purchasing_fix_pairing_v1/);
  assert.match(files.fn, /sc_repair_pullsheet_purchasing_integrity_v1/);
  assert.match(files.page, /Repair affected active pull-sheet lines/);
});

test('route and navigation entry remain installed', () => {
  assert.match(files.app, /ProductColorReplacement/);
  assert.match(files.app, /path="\/product-color-replacement"/);
  assert.match(files.nav, /Product Color/);
});
