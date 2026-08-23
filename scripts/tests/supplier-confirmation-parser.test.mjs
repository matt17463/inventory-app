import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { installPdfTextRuntimeCompatibility } from '../../netlify/functions/_shared/pdfTextExtractor.js';
import { parseSupplierConfirmationPages, supplierMatchKey, supplierSizeCandidates } from '../../netlify/functions/_shared/supplierConfirmationParser.js';

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

test('normalizes supplier matching aliases', () => {
  assert.equal(supplierMatchKey('Dark Heather Grey'), 'darkheathergray');
  assert.equal(supplierMatchKey('S&S Activewear'), 'sandsactivewear');
  assert.deepEqual(supplierSizeCandidates('M', 'youth'), ['M', 'YM']);
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
