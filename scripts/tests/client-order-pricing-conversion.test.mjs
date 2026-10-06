import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('client order pricing migration is additive and keeps conversion explicit',()=>{
  const sql=read('supabase/migrations/202610070001_client_order_pricing_conversion.sql');
  assert.match(sql,/blank_product_id uuid references public\.blank_products/);
  assert.match(sql,/unit_price numeric/);
  assert.match(sql,/external_invoice_number/);
  assert.match(sql,/manual_order_id bigint/);
  assert.match(sql,/generated_job_id bigint/);
  assert.match(sql,/sc_client_order_items_employee_update/);
  assert.doesNotMatch(sql,/insert into public\.jobs/i);
  assert.doesNotMatch(sql,/insert into public\.inventory_reservations/i);
  assert.doesNotMatch(sql,/blank_inventory_movements/i);
});

test('client order workflow maps and prices before creating production demand',()=>{
  const api=read('src/lib/clientOrdersApi.js');
  assert.match(api,/searchClientOrderBlankProducts/);
  assert.match(api,/priceClientOrderItem/);
  assert.match(api,/markClientOrderQuoteSent/);
  assert.match(api,/markClientOrderApproved/);
  assert.match(api,/markClientOrderPaid/);
  assert.match(api,/convertClientOrderToProduction/);
  assert.match(api,/createManualInvoiceOrder\(manualHeader, manualItems, true\)/);
  assert.match(api,/Record payment before converting/);
  assert.match(api,/Map every line to a blank product before conversion/);
});

test('client order page exposes controlled pricing, invoice handoff, and conversion gates',()=>{
  const page=read('src/ClientOrders.jsx');
  assert.match(page,/Map \+ price submitted items/);
  assert.match(page,/QuickBooks \/ external invoice number/);
  assert.match(page,/Download invoice CSV/);
  assert.match(page,/Mark quote sent/);
  assert.match(page,/Record customer approval/);
  assert.match(page,/Record payment/);
  assert.match(page,/Convert to Production/);
  assert.match(page,/create inventory demand\/reservations/);
});

test('QuickBooks handoff remains an export/reference boundary rather than an unconfigured direct API',()=>{
  const api=read('src/lib/clientOrdersApi.js');
  assert.match(api,/buildClientOrderInvoiceCsv/);
  assert.doesNotMatch(api,/quickbooks\.com|intuit\.com|oauth2\/v1\/tokens/i);
});
