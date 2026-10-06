import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('operations calendar routes operational commitments',()=>{
  const app=read('src/App.jsx');
  const calendar=read('src/OperationsCalendar.jsx');
  assert.match(app,/operations-calendar/);
  assert.match(calendar,/Month/);
  assert.match(calendar,/Week/);
  assert.match(calendar,/Agenda/);
  assert.match(calendar,/listCalendarData/);
  assert.match(calendar,/purchaseOrders/);
  assert.match(calendar,/artwork/);
  assert.match(calendar,/clientOrders/);
});

test('public client order form is intentionally unpriced and supports bulk intake',()=>{
  const app=read('src/App.jsx');
  const form=read('src/PublicClientOrderForm.jsx');
  assert.match(app,/team-order/);
  assert.match(form,/Pricing is added after Skilled Crafting reviews/);
  assert.match(form,/Import CSV/);
  assert.match(form,/attachments/);
  assert.doesNotMatch(form,/price_per_item|unit_price|order_total/);
});

test('client order submission is server-side and does not create production demand',()=>{
  const fn=read('netlify/functions/client-order-submit.js');
  assert.match(fn,/sc_client_order_requests/);
  assert.match(fn,/sc_client_order_request_items/);
  assert.match(fn,/sc_client_order_submission_guard/);
  assert.match(fn,/putOperationalObject/);
  assert.doesNotMatch(fn,/inventory_reservations|job_items|manual_invoice_orders|purchasing/);
});

test('migration protects public intake tables with RLS',()=>{
  const sql=read('supabase/migrations/202610060001_operations_calendar_client_orders.sql');
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.sc_client_order_requests from anon/);
  assert.match(sql,/security_invoker = true/);
  assert.match(sql,/sc_client_order_attachments/);
});
