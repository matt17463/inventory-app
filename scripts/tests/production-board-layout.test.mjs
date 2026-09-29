import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const board = fs.readFileSync(new URL('../../src/ProductionBoard.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/ProductionBoard.css', import.meta.url), 'utf8');

test('production board exposes comfortable and compact density controls', () => {
  assert.match(board, /density.*comfortable/s);
  assert.match(board, /setDensity\('compact'\)/);
  assert.match(board, /sc-production-kanban--\$\{density\}/);
});

test('production board uses readable horizontal kanban lanes', () => {
  assert.match(css, /grid-auto-columns:\s*minmax\(320px,\s*320px\)/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /scroll-snap-type:\s*x proximity/);
  assert.match(css, /\.sc-production-column[\s\S]*min-width:\s*320px/);
});

test('production cards cannot overflow neighboring lanes', () => {
  assert.match(css, /\.sc-production-card[\s\S]*min-width:\s*0/);
  assert.match(css, /\.sc-production-card[\s\S]*overflow:\s*hidden/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('zero-value operational metrics are suppressed', () => {
  assert.match(board, /Number\(row\.unpaired_required_lines \|\| 0\) > 0/);
  assert.match(board, /Number\(row\.resolved_lines \|\| 0\) > 0/);
  assert.match(board, /Inventory ready/);
});
