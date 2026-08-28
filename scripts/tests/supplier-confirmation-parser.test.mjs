import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { installPdfTextRuntimeCompatibility } from '../../netlify/functions/_shared/pdfTextExtractor.js';
import { parseSupplierConfirmationPages, supplierMatchKey, supplierSizeCandidates } from '../../netlify/functions/_shared/supplierConfirmationParser.js';
import { matchSupplierColor } from '../../netlify/functions/_shared/supplierColorMatcher.js';
import { parseOptionalUnitCost, requireUnitCost } from '../../src/lib/unitCost.js';

test('validates optional and required supplier unit costs', () => {
  assert.equal(parseOptionalUnitCost(''), null);
  assert.equal(parseOptionalUnitCost('5.60'), 5.6);
  assert.equal(requireUnitCost('0', 'sample item'), 0);
  assert.throws(() => parseOptionalUnitCost('-0.01'), /zero or greater/);
  assert.throws(() => requireUnitCost('', 'SKU 123'), /Enter the unit cost for SKU 123/);
});

test('carries supplier cost into new blanks and preserves existing product costs', async () => {
  const [receivingPage, inventoryApi, serverAction, migration, verification] = await Promise.all([
    fs.readFile(new URL('../../src/AddItemToBin.jsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/lib/inventoryApi.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/supplier-receiving-action.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../deployment/sql/40_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../deployment/sql/41_VERIFY_SUPPLIER_RECEIVING_UNIT_COST_SAFETY.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(receivingPage, /unit_cost: unitCost/);
  assert.match(receivingPage, /requireUnitCost/);
  assert.match(inventoryApi, /unit_cost: unitCost \?\? 0/);
  assert.match(inventoryApi, /hasOwnProperty\.call\(input \|\| \{\}, 'unit_cost'\)/);
  assert.match(serverAction, /p_unit_cost: optionalUnitCost\(item\.row\.unit_cost\)/);
  assert.match(migration, /alter column unit_cost set default 0/i);
  assert.match(migration, /v_unit_cost := v_before\.unit_cost/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.blank_products/i);
  assert.match(verification, /no_null_product_costs/);
});

test('supplier receiving function ships its complete local dependency chain', async () => {
  const requiredFiles = [
    '../../netlify/functions/_shared/security.js',
    '../../netlify/functions/_shared/cryptoSecurity.js',
    '../../netlify/functions/_shared/supplierConfirmationParser.js',
    '../../netlify/functions/_shared/operationalStorage.js',
    '../../netlify/functions/_shared/mockupStorage.js',
  ];

  for (const relativePath of requiredFiles) {
    const contents = await fs.readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.ok(contents.length > 0, `${relativePath} must be included in the deployment package`);
  }
});

test('initializes PDF.js without optional Node canvas polyfills', async () => {
  const original = Object.getOwnPropertyDescriptor(process, 'getBuiltinModule');
  Object.defineProperty(process, 'getBuiltinModule', { configurable: true, value: () => undefined });
  try {
    installPdfTextRuntimeCompatibility();
    const pdfJs = await import('../../netlify/functions/_vendor/pdfjs/pdf.mjs?netlify-runtime-test');
    assert.equal(typeof pdfJs.getDocument, 'function');
    assert.equal(typeof globalThis.DOMMatrix, 'function');
  } finally {
    if (original) Object.defineProperty(process, 'getBuiltinModule', original);
    else delete process.getBuiltinModule;
  }
});

test('uses the Netlify-packaged PDF worker location', async () => {
  installPdfTextRuntimeCompatibility();
  const pdfJs = await import('../../netlify/functions/_vendor/pdfjs/pdf.mjs?worker-path-test');
  const expected = pathToFileURL(path.join(
    process.env.LAMBDA_TASK_ROOT || process.cwd(),
    'netlify/functions/_vendor/pdfjs/pdf.worker.mjs',
  )).href;
  pdfJs.GlobalWorkerOptions.workerSrc = expected;
  assert.equal(pdfJs.GlobalWorkerOptions.workerSrc, expected);
});

test('supplier receiving creates only missing brand and style lookups', async () => {
  const [server, client] = await Promise.all([
    fs.readFile(new URL('../../netlify/functions/supplier-receiving-action.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/SupplierConfirmationReceiving.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(server, /action === 'ensure_lookups'/);
  assert.match(server, /ensureLookup\(supabase, 'brands'/);
  assert.match(server, /ensureLookup\(supabase, 'product_types'/);
  assert.doesNotMatch(server, /ensureLookup\(supabase, 'colors'/);
  assert.doesNotMatch(server, /ensureLookup\(supabase, 'sizes'/);
  assert.match(client, /Create missing Brands and Styles when receiving/);
});

test('normalizes supplier matching aliases', () => {
  assert.equal(supplierMatchKey('Dark Heather Grey'), 'darkheathergray');
  assert.equal(supplierMatchKey('S&S Activewear'), 'sandsactivewear');
  assert.deepEqual(supplierSizeCandidates('M', 'youth'), ['M', 'YM']);
});

test('matches supplier colors to an existing WooCommerce color', () => {
  const colors = [
    { id: 10, name: 'Dark Heather Gray', code: 'DHG' },
    { id: 20, name: 'Black', code: 'BLK' },
  ];
  assert.deepEqual(matchSupplierColor('Dark Heather Grey', colors, []), {
    color_id: '10',
    color_match_method: 'WooCommerce color exact match',
  });
});

test('uses active color pairing rules to choose the canonical WooCommerce color', () => {
  const colors = [
    { id: 10, name: 'Dark Heather Grey', code: 'DHG-OLD' },
    { id: 11, name: 'Dark Heather Gray', code: 'DHG' },
  ];
  const rules = [{
    source_color_id: 10,
    source_color_name: 'Dark Heather Grey',
    canonical_color_id: 11,
    canonical_color_name: 'Dark Heather Gray',
    status: 'active',
  }];
  assert.deepEqual(matchSupplierColor('Dark Heather Grey', colors, rules), {
    color_id: '11',
    color_match_method: 'WooCommerce color pairing rule',
  });
});

test('does not guess when WooCommerce color matches remain ambiguous', () => {
  const result = matchSupplierColor('Black', [
    { id: 20, name: 'Black', code: 'BLK' },
    { id: 21, name: 'Black', code: 'BLACK' },
  ], []);
  assert.equal(result.color_id, '');
  assert.equal(result.color_match_method, 'ambiguous WooCommerce color');
});

test('prefers a remembered supplier pairing and ignores archived canonical colors', () => {
  const colors = [
    { id: 30, name: 'Forest', code: 'FOR', is_active: false },
    { id: 31, name: 'Forest Green', code: 'FG', is_active: true },
  ];
  const aliases = [{
    source_system: 'ss_activewear', source_value: 'Forest', source_key: 'forest',
    canonical_color_id_text: '31',
  }];
  assert.deepEqual(matchSupplierColor('Forest', colors, [], aliases, 'ss_activewear'), {
    color_id: '31',
    color_match_method: 'remembered supplier color pairing',
  });
  assert.equal(matchSupplierColor('Forest', colors, [], [], 'ss_activewear').color_id, '');
});

test('color lifecycle archives unused choices and keeps canonical pairings protected', async () => {
  const [sql, lifecycle, inventoryApi, catalogImport, feedSync] = await Promise.all([
    fs.readFile(new URL('../../deployment/sql/26_COLOR_LIFECYCLE_AND_IMPORT_ALIASES.sql', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/color-lifecycle.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/lib/inventoryApi.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/SupplierCatalogImport.jsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/supplier-catalog-feed-sync.js', import.meta.url), 'utf8'),
  ]);
  assert.match(sql, /create or replace view public\.sc_active_colors/i);
  assert.match(sql, /create table if not exists public\.sc_import_color_aliases/i);
  assert.match(sql, /sc_reactivate_referenced_color/i);
  assert.match(lifecycle, /usageCount === 0 && !canonical/);
  assert.match(lifecycle, /woo_product_count/);
  assert.match(inventoryApi, /from\('sc_active_colors'\)/);
  assert.match(catalogImport, /Pair Unrecognized Supplier Colors/);
  assert.match(catalogImport, /saveImportColorAliases/);
  assert.match(feedSync, /canonicalizeChunkColors/);
  assert.match(feedSync, /Supplier feed stopped before import/);
});

test('runs WooCommerce color scans and cleanup outside the synchronous request window', async () => {
  const [sql, toml, fastFunction, backgroundFunction, clientApi, reviewPage] = await Promise.all([
    fs.readFile(new URL('../../deployment/sql/27_COLOR_LIFECYCLE_BACKGROUND_JOBS.sql', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify.toml', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/color-lifecycle-fast.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/color-lifecycle-background.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/lib/colorLifecycleApi.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/ColorAliasReview.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(sql, /create table if not exists public\.sc_color_lifecycle_jobs/i);
  assert.match(sql, /create table if not exists public\.sc_color_woo_term_snapshot/i);
  assert.match(sql, /sc_color_lifecycle_usage_counts/i);
  assert.match(toml, /\[functions\."color-lifecycle-background"\]\s+background = true/);
  assert.match(fastFunction, /status: 'queued'/);
  assert.match(backgroundFunction, /terms\/batch/);
  assert.match(backgroundFunction, /Number\(latest\?\.count \|\| 0\) !== 0/);
  assert.match(clientApi, /color-lifecycle-fast/);
  assert.match(clientApi, /color-lifecycle-background/);
  assert.match(reviewPage, /WooCommerce color scan started in the background/);
});

test('supplier receiving offers only active canonical colors and identifies ready rows', async () => {
  const [receivingPage, confirmationPage, parser, action] = await Promise.all([
    fs.readFile(new URL('../../src/AddItemToBin.jsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../src/SupplierConfirmationReceiving.jsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/supplier-confirmation-parse.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../../netlify/functions/supplier-receiving-action.js', import.meta.url), 'utf8'),
  ]);
  assert.match(receivingPage, /from\('sc_active_colors'\)/);
  assert.match(receivingPage, /sourceIds\.has/);
  assert.doesNotMatch(receivingPage, /loadLookupTable\('colors'\)/);
  assert.match(confirmationPage, /Select Ready Rows/);
  assert.match(confirmationPage, /selected line\(s\) still need review/);
  assert.match(confirmationPage, /missingReceivingFields/);
  assert.match(parser, /from\('sc_active_colors'\)/);
  assert.match(parser, /canonical_color_review/);
  assert.match(action, /from\('sc_active_colors'\)/);
});

test('supplier confirmation matching does not truncate the blank catalog at 5,000 rows', async () => {
  const parser = await fs.readFile(new URL('../../netlify/functions/supplier-confirmation-parse.js', import.meta.url), 'utf8');
  assert.doesNotMatch(parser, /from\('blank_products'\)[\s\S]{0,180}limit\(5000\)/);
  assert.match(parser, /\.eq\('brand_id', ids\.brand_id\)/);
  assert.match(parser, /\.eq\('product_type_id', ids\.product_type_id\)/);
  assert.match(parser, /\.eq\('color_id', ids\.color_id\)/);
  assert.match(parser, /\.eq\('size_id', ids\.size_id\)/);
  assert.match(parser, /\.limit\(2\)/);
});

test('parses a representative S&S confirmation row', () => {
  const pages = [{ pageNumber: 1, cells: [
    { x: 100, y: 760, str: 'S&S Activewear' },
    { x: 340, y: 750, str: 'Order Confirmation: 75436493' },
    { x: 370, y: 700, str: '8/20/2026' },
    { x: 32, y: 568, str: '22060504' },
    { x: 80, y: 568, str: 'Gildan - Unisex Heavy Blend Hooded Sweatshirt - 18500' },
    { x: 355, y: 565, str: 'Black' }, { x: 435, y: 568, str: 'M' },
    { x: 505, y: 568, str: '2' }, { x: 530, y: 568, str: '10.30' }, { x: 570, y: 568, str: '20.60' },
  ] }];
  const result = parseSupplierConfirmationPages(pages);
  assert.equal(result.order_number, '75436493');
  assert.equal(result.total_lines, 1);
  assert.equal(result.total_units, 2);
  assert.equal(result.lines[0].style, '18500');
  assert.equal(result.lines[0].color, 'Black');
});

test('parses Momentec rows whose line number and SKU share a PDF cell', () => {
  const pages = [{ pageNumber: 1, cells: [
    { x: 100, y: 760, str: 'ORDER CONFIRMATION' }, { x: 100, y: 740, str: 'momentecbrands.com' },
    { x: 300, y: 720, str: '0054780121' }, { x: 300, y: 700, str: '08/10/2026' },
    { x: 300, y: 680, str: 'Purchase Order Number' }, { x: 300, y: 660, str: '08102026' },
    { x: 31, y: 473, str: '10 520000.B080.XSBLACK' }, { x: 193, y: 473, str: 'XS' },
    { x: 453, y: 473, str: '7' }, { x: 494, y: 473, str: '3.90' }, { x: 543, y: 473, str: '27.30' },
    { x: 50, y: 460, str: 'YOUTH C2 TEE' },
  ] }];
  const result = parseSupplierConfirmationPages(pages);
  assert.equal(result.total_lines, 1);
  assert.equal(result.lines[0].supplier_sku, '520000.B080.XS');
  assert.equal(result.lines[0].color, 'BLACK');
  assert.equal(result.lines[0].audience, 'youth');
});
