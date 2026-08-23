import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { installPdfTextRuntimeCompatibility } from '../../netlify/functions/_shared/pdfTextExtractor.js';
import { parseSupplierConfirmationPages, supplierMatchKey, supplierSizeCandidates } from '../../netlify/functions/_shared/supplierConfirmationParser.js';
import { matchSupplierColor } from '../../netlify/functions/_shared/supplierColorMatcher.js';

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
