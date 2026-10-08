import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('public client order requires an explicit confirmation review',()=>{
  const form=read('src/PublicClientOrderForm.jsx');
  const fn=read('netlify/functions/client-order-submit.js');
  assert.match(form,/Confirm Your Order Details/);
  assert.match(form,/Names and numbers will be printed exactly as entered/);
  assert.match(form,/spelling, capitalization/);
  assert.match(form,/Approve & submit order request/);
  assert.match(form,/confirmationApproved/);
  assert.match(fn,/customer_confirmation\?\.approved !== true/);
});

test('confirmation synopsis shows every personalization field',()=>{
  const form=read('src/PublicClientOrderForm.jsx');
  assert.match(form,/Garment color/);
  assert.match(form,/Name on back/);
  assert.match(form,/Name text color/);
  assert.match(form,/Jersey \/ employee #/);
});

test('client conversion keeps customer-entered personalization in manual order notes',()=>{
  const api=read('src/lib/clientOrdersApi.js');
  assert.match(api,/Client personalization/);
  assert.match(api,/Garment Color/);
  assert.match(api,/Name on Back/);
  assert.match(api,/Name Text Color/);
  assert.match(api,/Jersey \/ Employee #/);
  assert.match(api,/clientCustomizationText\(item\)/);
});

test('QuickBooks and invoice exports use explicit client personalization labels',()=>{
  const api=read('src/lib/clientOrdersApi.js');
  assert.match(api,/buildClientOrderQuickBooksCsv/);
  assert.match(api,/clientCustomizationText\(item, '; '\)/);
  assert.match(api,/buildClientOrderInvoiceCsv/);
});

test('manual invoice screen and QBO export surface client details clearly',()=>{
  const page=read('src/ManualInvoicedOrders.jsx');
  const api=read('src/lib/manualOrdersApi.js');
  assert.match(page,/manual-line-client-details/);
  assert.match(api,/Details:/);
});
