import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('client order production conversion has a hard simulated-write boundary',()=>{
  const api=read('src/lib/clientOrdersApi.js');
  const start=api.indexOf('export async function convertClientOrderToProduction');
  const end=api.indexOf('function csvCell',start);
  const fn=api.slice(start,end);
  assert.match(api,/shouldSimulateWrites/);
  assert.match(api,/previewClientOrderProductionConversion/);
  assert.match(fn,/if \(shouldSimulateWrites\(\)\)/);
  assert.ok(fn.indexOf('if (shouldSimulateWrites())') < fn.indexOf('createManualInvoiceOrder('));
  assert.match(api,/databaseChanged: false/);
  assert.match(api,/inventoryChanged: false/);
});

test('client order simulated mode keeps page workflow local',()=>{
  const page=read('src/ClientOrders.jsx');
  assert.match(page,/getTestingModeSettings/);
  assert.match(page,/simulateWrites/);
  assert.match(page,/status change simulated in this browser only/);
  assert.match(page,/line .* save simulated in this browser only/);
  assert.match(page,/payment simulated/);
  assert.match(page,/Simulate Production Conversion/);
  assert.match(page,/Zero database, inventory, reservation, purchasing, or job records were changed/);
});

test('client order test mode exposes a clear dry-run result',()=>{
  const page=read('src/ClientOrders.jsx');
  assert.match(page,/TEST MODE conversion preview/);
  assert.match(page,/No Manual Invoiced Order, job, reservation, purchasing demand, inventory movement, or client-order database update was created/);
});

test('testing mode settings describe Client Orders support',()=>{
  const settings=read('src/TestingMode.jsx');
  assert.match(settings,/Client Orders conversion/);
  assert.match(settings,/fully non-mutating browser simulation/);
});


test('client order blank search normalizes customer-friendly sizes and reports inline results',()=>{
  const api=read('src/lib/clientOrdersApi.js');
  const page=read('src/ClientOrders.jsx');
  assert.match(api,/normalizeClientOrderSize/);
  assert.match(api,/replace\(\/\^youth/);
  assert.match(api,/progressively relax only the intake-derived filters/);
  assert.match(page,/Searching inventory…/);
  assert.match(page,/possible blank match/);
  assert.match(page,/No blank matches found/);
});
