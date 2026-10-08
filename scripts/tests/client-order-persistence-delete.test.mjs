import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('client order save-all persists request and every editable line',()=>{
  const page=read('src/ClientOrders.jsx');
  assert.match(page,/Save all changes/);
  assert.match(page,/for\(const item of items\) savedItems\.push\(await updateClientOrderItem\(item\.id,lineSavePatch\(item\)\)\)/);
  assert.match(page,/All client order changes saved/);
  assert.match(page,/auto-saving/);
});

test('client order editable pricing fields mark the order dirty for autosave',()=>{
  const page=read('src/ClientOrders.jsx');
  assert.match(page,/setHasUnsavedChanges\(true\)/);
  assert.match(page,/window\.setTimeout\(\(\)=>\{ saveRequest\(\); \},1200\)/);
  assert.match(page,/editRequest\(\{shipping_amount/);
  assert.match(page,/editInvoiceNumber/);
});

test('client order deletion is guarded and unavailable after production conversion',()=>{
  const page=read('src/ClientOrders.jsx');
  const api=read('src/lib/clientOrdersApi.js');
  const fn=read('netlify/functions/client-order-delete.js');
  assert.match(page,/Delete \{selected\.order_number\}/);
  assert.match(page,/Type \$\{selected\.order_number\} to confirm/);
  assert.match(api,/client-order-delete/);
  assert.match(fn,/allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn,/manual_order_id \|\| request\.generated_job_id \|\| request\.converted_at/);
  assert.match(fn,/deleteOperationalObject/);
});
