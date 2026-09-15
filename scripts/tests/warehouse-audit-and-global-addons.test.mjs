import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('warehouse audit provides XLS and PDF exports with per-bin PDF pages and requested sorting', async () => {
  const source = await fs.readFile(
    new URL('../../src/WarehouseAuditReport.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /Download XLS/);
  assert.match(source, /Download PDF/);
  assert.match(source, /application\/vnd\.ms-excel/);
  assert.match(source, /new jsPDF/);
  assert.match(source, /autoTable/);
  assert.match(source, /doc\.addPage/);

  assert.match(source, /quantity-asc/);
  assert.match(source, /quantity-desc/);
  assert.match(source, /Product name/);
  assert.match(source, /Style/);
  assert.match(source, /Color/);

  assert.match(source, /Product Name/);
  assert.match(source, /System Qty/);
  assert.match(source, /Actual Count/);
});

test('Mockup Studio explicitly controls WooCommerce global Product Add-Ons', async () => {
  const [studio, publisher] = await Promise.all([
    fs.readFile(new URL('../../src/MockupStudio.jsx', import.meta.url), 'utf8'),
    fs.readFile(
      new URL('../../netlify/functions/mockup-publish-woocommerce.js', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(studio, /use_global_add_ons: saved\.use_global_add_ons !== false/);
  assert.match(studio, /Use applicable global add-ons/);
  assert.match(studio, /checked=\{form\.use_global_add_ons !== false\}/);

  assert.match(
    publisher,
    /exclude_global_add_ons: config\.use_global_add_ons === false/,
  );

  assert.match(publisher, /_sc_use_global_add_ons/);
});
