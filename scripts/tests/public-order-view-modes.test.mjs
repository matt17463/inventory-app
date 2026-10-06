import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('public client order form offers compact, card, and spreadsheet row views',()=>{
  const form=read('src/PublicClientOrderForm.jsx');
  assert.match(form,/setDetailView/);
  assert.match(form,/>Compact</);
  assert.match(form,/>Cards</);
  assert.match(form,/>Spreadsheet</);
  assert.match(form,/sc-order-sheet/);
});

test('public order add-row action has an explicit high-contrast class',()=>{
  const form=read('src/PublicClientOrderForm.jsx');
  const css=read('src/operationsFeatures.css');
  assert.match(form,/sc-add-row-button/);
  assert.match(css,/\.sc-order-line-footer \.sc-add-row-button/);
  assert.match(css,/background:#12324a!important/);
  assert.match(css,/color:#fff!important/);
});

test('compact public order rows reduce density for larger orders',()=>{
  const css=read('src/operationsFeatures.css');
  assert.match(css,/sc-order-view-compact/);
  assert.match(css,/grid-template-columns:1\.35fr 1\.15fr/);
  assert.match(css,/padding:10px 12px/);
});


test('public order size selector includes One Size and NA',()=>{
  const form=read('src/PublicClientOrderForm.jsx');
  assert.match(form,/One Size/);
  assert.match(form,/'NA'/);
});
