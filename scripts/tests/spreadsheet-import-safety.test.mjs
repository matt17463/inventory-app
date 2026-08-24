import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { matrixToObjects, parseDelimitedText, spreadsheetLimits } from '../../src/lib/spreadsheetFiles.js';

const root = path.resolve('.');

test('CSV parser preserves quoted commas, lines, and escaped quotes', () => {
  const matrix = parseDelimitedText('Brand,Description,Notes\r\nGildan,"18500, Hoodie","Customer said ""rush"""\r\nSport-Tek,"Two\nlines",Ready');
  assert.deepEqual(matrix, [
    ['Brand', 'Description', 'Notes'],
    ['Gildan', '18500, Hoodie', 'Customer said "rush"'],
    ['Sport-Tek', 'Two\nlines', 'Ready'],
  ]);
});

test('matrix conversion produces stable unique column names', () => {
  assert.deepEqual(matrixToObjects([
    ['SKU', 'SKU', ''],
    ['ONE', 'TWO', 'THREE'],
  ]), [{ SKU: 'ONE', 'SKU (2)': 'TWO', 'Column 3': 'THREE' }]);
});

test('spreadsheet imports use bounded parsing without the vulnerable xlsx package', () => {
  const inventoryImport = fs.readFileSync(path.join(root, 'src/InventoryImport.jsx'), 'utf8');
  const supplierImport = fs.readFileSync(path.join(root, 'src/SupplierCatalogImport.jsx'), 'utf8');
  const zip = fs.readFileSync(path.join(root, 'src/lib/zipCsvExtract.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.dependencies.xlsx, undefined);
  assert.ok(packageJson.dependencies['read-excel-file']);
  assert.match(inventoryImport, /readSpreadsheetSheets/);
  assert.match(supplierImport, /readSpreadsheetSheets/);
  assert.match(zip, /MAX_TOTAL_EXTRACTED_BYTES/);
  assert.match(zip, /MAX_ENTRY_BYTES/);
  assert.equal(spreadsheetLimits.maxBytes, 15 * 1024 * 1024);
  assert.equal(spreadsheetLimits.maxRows, 50000);
});
