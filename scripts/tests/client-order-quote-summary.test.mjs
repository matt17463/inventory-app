import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const page=fs.readFileSync(path.join(root,'src/ClientOrders.jsx'),'utf8');

test('copied client-order quote summary uses current browser line pricing',()=>{
  const start=page.indexOf('function quoteSummary');
  const end=page.indexOf('export default function ClientOrders',start);
  const fn=page.slice(start,end);
  assert.match(fn,/const subtotal=items\.reduce/);
  assert.match(fn,/const total=subtotal\+shipping\+tax/);
  assert.doesNotMatch(fn,/request\.quote_subtotal/);
  assert.doesNotMatch(fn,/request\.quote_total/);
});
