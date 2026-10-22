import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAddress,normalizeParcel,formatRates,carrierConfig} from '../../netlify/functions/_shared/easypostCarrier.js';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const address={name:'Example Customer',street1:'123 Example Street',city:'Port Orchard',state:'wa',zip:'98366',phone:'360-555-0100'};
test('carrier integration defaults to test mode with no accidental production keys',()=>{
 const c=carrierConfig();
 assert.equal(c.mode,'test');
 assert.equal(c.canBuy,true); // Only test account purchases can proceed without explicit live flag
 assert.equal(c.enabled,false);
});
test('validates US address without inventing delivery details',()=>{
 assert.equal(normalizeAddress(address).state,'WA');
 assert.throws(()=>normalizeAddress({...address,zip:'ABC'}),/US domestic/);
 assert.throws(()=>normalizeAddress({...address,phone:'abc'}),/phone/);
 assert.throws(()=>normalizeAddress({...address,name:''}),/needs name/);
});
test('parcel fields require actual packed measurements and ounces',()=>{
 const p=normalizeParcel({length:12,width:10,height:4,weight:16});
 assert.equal(p.weight,16);
 assert.throws(()=>normalizeParcel({length:0,width:10,height:4,weight:16}),/length/);
 assert.throws(()=>normalizeParcel({length:12,width:10,height:4,weight:0}),/weight/);
});
test('shipping quotes sorted by lowest cost and only valid USD rates',()=>{
 const rates=formatRates({rates:[
  {id:'rate_second',rate:'18.36',currency:'USD',carrier:'UPS',service:'Ground'},
  {id:'rate_first',rate:'5.82',currency:'USD',carrier:'USPS',service:'GroundAdvantage'},
  {id:'rate_ignore',rate:'2.12',currency:'CAD',carrier:'Bad'},
 ]});
 assert.equal(rates.length,2);assert.equal(rates[0].carrier,'USPS');assert.equal(rates[1].amount,18.36);
});
test('a USPS Click-N-Ship account does not require the direct USPS Labels API or BYOCA charges',()=>{
 const fn=source('../../netlify/functions/carrier-labels.js');
 const sql=source('../../supabase/migrations/202610220010_carrier_labels.sql');
 assert.match(fn,/register_click_n_ship/);assert.match(fn,/external_labels/);
 assert.match(fn,/externalRow\(sb,id,index\)/);
 assert.match(fn,/already recorded for this package/);
 assert.match(sql,/sc_external_usps_labels/);
 assert.match(sql,/unique\(tracking_code\)/);
 assert.match(sql,/unique\(job_id,package_index\)/);
 assert.match(sql,/sc_external_usps_labels enable row level security/);
});
test('live EasyPost purchase requires manager auth, explicit exact price and idempotent claim',()=>{
 const f=source('../../netlify/functions/carrier-labels.js');
 assert.match(f,/allowedRoles:\['admin','manager'\]/);
 assert.match(f,/SC_EASYPOST_LIVE_BUY_ENABLED/);
 assert.match(f,/confirm_buy!==true/);
 assert.match(f,/confirm_cost/);
 assert.match(f,/\.eq\('state','quoted'\)/);
 assert.match(f,/purchase_unknown/);
 assert.match(f,/Recover label/);
});
test('warehouse handoff and customer email functions remain separate',()=>{
 const f=source('../../netlify/functions/carrier-labels.js');
 assert.doesNotMatch(f,/sendEmail|smtp|update-stock|wooc.*order.*update|QuickBooksInvoice/);
 const ui=source('../../src/CarrierShippingLabels.jsx');
 assert.match(ui,/Click-N-Ship/);
 assert.match(ui,/Testing Mode/);
 assert.match(ui,/Quote|quote/);
 assert.match(ui,/not mark an order shipped/i);
 assert.match(source('../../src/WorkHub.jsx'),/CarrierShippingLabels/);
});
test('dedicated carrier ledger rejects browser writes and stores no API credentials',()=>{
 const sql=source('../../supabase/migrations/202610220010_carrier_labels.sql');
 for(const t of ['sc_carrier_label_jobs','sc_external_usps_labels']){
  assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on public\\.'+t+' from public,anon,authenticated'));
 }
 assert.doesNotMatch(sql,/grant insert|grant update|API_KEY/);
});
