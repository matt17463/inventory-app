import test from 'node:test';
import assert from 'node:assert/strict';
import { mockupBlankCatalogInternals } from '../../netlify/functions/_shared/mockupBlankCatalog.js';

test('automatic blank matrix keys use the same normalized Woo option identity', () => {
  const { normalized, matrixKey } = mockupBlankCatalogInternals;
  assert.equal(normalized('Sport Grey'), 'sport grey');
  assert.equal(normalized('Sport-Grey'), 'sport grey');
  assert.equal(normalized('Black & White'), 'black and white');
  assert.equal(matrixKey('Sport-Grey', 'A2XL'), JSON.stringify(['sport grey', 'a2xl']));
});

test('automatic blank SKUs are stable and readable', () => {
  const { skuPiece } = mockupBlankCatalogInternals;
  assert.equal(skuPiece('Gildan'), 'GILDAN');
  assert.equal(skuPiece('6400 Softstyle'), '6400-SOFTSTYLE');
  assert.equal(skuPiece('Black & White'), 'BLACK-WHITE');
});
