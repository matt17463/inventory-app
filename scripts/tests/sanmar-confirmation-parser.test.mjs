import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSanMarRows } from '../../netlify/functions/_shared/sanmarConfirmationParser.js';

const HEADERS = [
  'ORDERDATE:', 'CUSTOMER NO:', 'CUSTOMER PO:', 'ATTENTION:', 'ADDRESS 1:',
  'ADDRESS 2:', 'CITY:', 'STATE:', 'ZIPCODE:', 'RESIDENCE:', 'STYLE:',
  'COLOR:', 'SIZE:', 'PIECES:', 'PRICE:', 'AMOUNT:', 'WAREHOUSE:', 'WEIGHT:',
];

test('SanMar XLS rows are normalized into supplier receiving lines', () => {
  const parsed = parseSanMarRows([
    HEADERS,
    ['09/18/26', 'CUST-284170', '', '', '', '', '', '', '', '', '18500', 'Black', 'S', '4', '9.80', '39.20', 'Seattle WA', '6.0'],
    ['', '', '', '', '', '', '', '', '', '', '18500', 'Black', 'M', '3', '9.80', '29.40', 'Seattle WA', '4.5'],
    ['', '', '', '', '', '', '', '', '', '', '18500', 'Sport Grey', '3XL', '2', '20.44', '40.88', 'Seattle WA', '3.2'],
  ], { fileName: '94650165.xls' });

  assert.equal(parsed.supplier_key, 'sanmar');
  assert.equal(parsed.supplier_name, 'SanMar');
  assert.equal(parsed.order_number, '94650165');
  assert.equal(parsed.order_date, '09/18/26');
  assert.equal(parsed.total_lines, 3);
  assert.equal(parsed.total_units, 9);
  assert.equal(parsed.subtotal, 109.48);
  assert.equal(parsed.lines[0].supplier_sku, '18500 | Black | S');
  assert.equal(parsed.lines[0].supplier_line_key, 'sanmar:18500:black:s');
  assert.equal(parsed.lines[0].unit_cost, 9.8);
});

test('SanMar rows split across warehouses aggregate to one stable item line', () => {
  const parsed = parseSanMarRows([
    HEADERS,
    ['09/18/26', 'CUST', 'PO-22', '', '', '', '', '', '', '', '64000', 'White', 'L', 2, 4.25, 8.50, 'Seattle WA', 1],
    ['', '', '', '', '', '', '', '', '', '', '64000', 'White', 'L', 3, 4.25, 12.75, 'Reno NV', 1.5],
  ], { fileName: 'receipt.xls' });

  assert.equal(parsed.po_number, 'PO-22');
  assert.equal(parsed.total_lines, 1);
  assert.equal(parsed.total_units, 5);
  assert.equal(parsed.lines[0].ordered_quantity, 5);
  assert.equal(parsed.lines[0].unit_cost, 4.25);
  assert.match(parsed.lines[0].description, /Seattle WA/);
  assert.match(parsed.lines[0].description, /Reno NV/);
});

test('non-SanMar workbooks are rejected with a useful message', () => {
  assert.throws(
    () => parseSanMarRows([['SKU', 'Qty'], ['ABC', 2]], { fileName: 'other.xls' }),
    /does not match the SanMar receipt format/i,
  );
});
