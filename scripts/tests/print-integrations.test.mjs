import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeManualPrintSource} from '../../src/lib/printModel.js';
import {reconcileQboInvoice} from '../../netlify/functions/_shared/qboPrint.js';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');

test('QBO paid invoice is verified only when original number and totals align',()=>{
 const manual=normalizeManualPrintSource({id:7,invoice_number:'QBO-204',customer_name:'School',total_payment_amount:110},[
  {item_name:'School tee',quantity:2,price_per_item:50}
 ]);
 const result=reconcileQboInvoice(manual,{
  Id:'456',DocNumber:'QBO-204',TotalAmt:110,Balance:0,CustomerRef:{value:'42',name:'School'},
  Line:[{Id:'1',DetailType:'SalesItemLineDetail',Description:'Tee',Amount:100,SalesItemLineDetail:{Qty:2,UnitPrice:50}},
   {Id:'2',DetailType:'SalesItemLineDetail',Description:'Sales Tax',Amount:10,SalesItemLineDetail:{Qty:1,UnitPrice:10}}],
  TxnTaxDetail:{TotalTax:0},
 });
 assert.equal(result.financialVerified,true);
 assert.equal(result.paid,true);
 assert.equal(result.total,110);
 assert.equal(result.lines.length,2);
 assert.equal(result.lines[1].name,'Sales Tax');
 assert.equal(result.tax,0); // QBO Sales Tax service line is not duplicated as native tax
});
test('QBO mismatch never verifies a draft and preserves true billing amount',()=>{
 const manual=normalizeManualPrintSource({id:4,invoice_number:'QB-X',total_payment_amount:30},[
  {item_name:'Hoodie',quantity:1,price_per_item:30}
 ]);
 const invoice={Id:'9',DocNumber:'QB-X',TotalAmt:31,Balance:31,
  Line:[{DetailType:'SalesItemLineDetail',Amount:31,Description:'Hoodie'}]};
 const result=reconcileQboInvoice(manual,invoice);
 assert.equal(result.financialVerified,false);
 assert.equal(result.total,31);
 assert.equal(result.paid,false);
 assert.match(result.warnings.join(' '),/differs/);
});
test('Print agent uses outbound HTTPS poll and direct CUPS execFile without shell',()=>{
 const code=read('scripts/print-agent.mjs');
 assert.match(code,/\.startsWith\('https:\/\/'\)/);
 assert.match(code,/exec\('lp'/);
 assert.match(code,/queueMap/);
 assert.match(code,/action:'lease'/);
 assert.match(code,/action:'ack'/);
 assert.doesNotMatch(code,/shell:\s*true/);
});
test('Dispatch service enforces disabled-by-default, private storage and agent authorization',()=>{
 const code=read('netlify/functions/print-dispatch.js');
 assert.match(code,/SC_PRINT_DISPATCH_ENABLED/);
 assert.match(code,/SC_PRINT_AGENT_TOKEN/);
 assert.match(code,/timingSafeEqual/);
 assert.match(code,/sc-private-print-pdfs/);
 assert.match(code,/\.eq\('status','queued'\)/);
 assert.match(code,/\.eq\('lease_id',body.leaseId\)/);
 assert.match(code,/authorizeEmployee\(event/);
 assert.match(code,/allowedRoles:\['admin','manager'\]/);
 const migration=read('supabase/migrations/20261023024000_print_integrations.sql');
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public/);
 assert.match(migration,/sc_qbo_print_connection/);
 assert.match(migration,/sc_print_layout_profiles/);
 assert.match(migration,/sc_product_production_profiles/);
});
test('QuickBooks OAuth controls state, encrypts tokens and preserves refresh rotation',()=>{
 const oauth=read('netlify/functions/qbo-print-connect.js');
 const qbo=read('netlify/functions/_shared/qboPrint.js');
 assert.match(oauth,/allowedRoles:\['admin'\]/);
 assert.match(oauth,/sc_qbo_print_oauth_states/);
 assert.match(oauth,/\.delete\(\)/);
 assert.match(qbo,/createCipheriv\('aes-256-gcm'/);
 assert.match(qbo,/encrypted_refresh_token/);
 assert.match(qbo,/token_version/);
 assert.match(qbo,/grant_type:'refresh_token'/);
});
test('Workflow mapping only accepts approved physically verified recipes',()=>{
 const settings=read('netlify/functions/print-workflow-settings.js');
 assert.match(settings,/verified_sample/);
 assert.match(settings,/\.eq\('status','approved'\)/);
 assert.match(settings,/sc_product_production_profiles/);
 assert.match(settings,/sc_job_travelers/);
 const ui=read('src/PrintCenter.jsx');
 assert.match(ui,/PrintIntegrations/);
 assert.match(ui,/Queue invoice pair to Epson/);
 assert.match(ui,/Queue production packet to Epson/);
});
