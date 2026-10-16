import test from 'node:test';
import assert from 'node:assert/strict';
import { wooSignatureForBody } from '../../netlify/functions/_shared/cryptoSecurity.js';
import { existingLineUpdate, mayPromoteToReserved } from '../../netlify/functions/_shared/orderSyncReliability.js';

process.env.SUPABASE_URL='https://sync-fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-service-key';
process.env.WC_WEBHOOK_SECRET='test-only-webhook-secret';
const { handler } = await import('../../netlify/functions/woocommerce-webhook.js');
const { handler: manualHandler } = await import('../../netlify/functions/manual-pullsheet.js');
const blankId='00000000-0000-4000-8000-000000000001';
async function replay({jobStatus='in_production',itemStatus='in_production',quantity=2,lease=true,failBoard=false,manual=false,orderStatus='processing'}={}) {
  const calls=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(String(input));
    const name=url.pathname.split('/').at(-1);
    const body=options.body?JSON.parse(options.body):null;
    calls.push({name,method:options.method||'GET',body});
    let data=[];
    if(name==='sc_acquire_order_sync_lease_v1') data=lease?'00000000-0000-4000-8000-000000000009':null;
    else if(name==='sc_release_order_sync_lease_v1') data=null;
    else if(['sc_sync_woocommerce_order_status','sc_recalculate_order_status'].includes(name) && failBoard) return new Response(JSON.stringify({message:'Fixture board failure',code:'XX000'}),{status:500,headers:{'content-type':'application/json'}});
    else if(name==='sc_ensure_job_item_reservation_v1') data={success:true,action:'existing'};
    else if(name==='sc_pullsheet_sync_runs') data=[{id:1}];
    else if(name==='jobs') data=[{id:10,status:body?.status || jobStatus}];
    else if(name==='job_items') data=[{id:20,status:itemStatus,quantity,blank_product_id:blankId}];
    else if(name==='customers'||name==='logos') data=[{id:1}];
    else if(name==='finished_products') data=[{id:blankId}];
    else if(['sc_product_blank_mappings','product_sku_mappings','products'].includes(name)) data=[{blank_product_id:blankId,blank_products:{id:blankId,sku_base:'GILDAN-5000-BLACK-AM',name:'Blank'}}];
    else if(name.startsWith('sc_')) data=[];
    if(new Headers(options.headers).get('accept')?.includes('vnd.pgrst.object') && Array.isArray(data)) data=data[0]||null;
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  };
  try {
    const body=JSON.stringify({id:123,status:orderStatus,billing:{first_name:'Fixture'},line_items:[{id:44,product_id:100,variation_id:101,sku:'GILDAN-5000-BLACK-AM',name:'Test shirt',quantity:2}]});
    const result=await (manual ? manualHandler : handler)({httpMethod:'POST',body:manual ? JSON.stringify({order:JSON.parse(body)}) : body,headers:{'x-manual-pullsheet-secret':process.env.WC_WEBHOOK_SECRET,'content-type':'application/json','x-wc-webhook-signature':wooSignatureForBody(body,process.env.WC_WEBHOOK_SECRET)}});
    return {status:result.statusCode,body:JSON.parse(result.body),calls};
  } finally { globalThis.fetch=originalFetch; }
}

test('delayed webhooks preserve a closed job without touching items or reservations',async()=>{
  const result=await replay({jobStatus:'completed'});
  assert.equal(result.status,200); assert.equal(result.body.action,'terminal_history_refreshed');
  assert(!result.calls.some(c=>c.name==='job_items'||c.name==='sc_ensure_job_item_reservation_v1'));
});
test('a completed line in an active job is never reopened or reserved again',async()=>{
  const result=await replay({itemStatus:'completed'});
  assert.equal(result.status,200);
  assert(!result.calls.some(c=>c.name==='job_items'&&c.method==='PATCH'));
  assert(!result.calls.some(c=>c.name==='sc_ensure_job_item_reservation_v1'));
});
test('replaying an active line preserves its production status and current pairing',async()=>{
  const result=await replay(); assert.equal(result.status,200);
  const update=result.calls.find(c=>c.name==='job_items'&&c.method==='PATCH');
  assert(update); assert(!('status' in update.body)); assert(!('blank_product_id' in update.body));
  assert(!result.calls.some(c=>c.name==='jobs'&&c.body?.status==='reserved'));
  assert.equal(result.body.reservations_existing,1);
});
test('changed order quantities are reported for review without another reservation',async()=>{
  const result=await replay({quantity:1}); assert.equal(result.status,200);
  assert(result.body.errors.some(e=>/quantity changed/i.test(e.error)));
  assert(!result.calls.some(c=>c.name==='sc_ensure_job_item_reservation_v1'));
});
test('a simultaneous order sync receives a retry response before any order mutations',async()=>{
  const result=await replay({lease:false}); assert.equal(result.status,503);
  assert.equal(result.calls.length,1);
});
test('fatal sync errors finish the failed run and release its lease',async()=>{
  const result=await replay({failBoard:true}); assert.equal(result.status,500);
  assert(result.calls.some(c=>c.name==='sc_pullsheet_sync_runs'&&c.body?.outcome==='failed'));
  assert(result.calls.some(c=>c.name==='sc_release_order_sync_lease_v1'));
});
test('production edits and shop-floor pairing overrides survive order enrichment',()=>{
  assert.deepEqual(existingLineUpdate({status:'queued',quantity:3,job_id:1,blank_product_id:'new',pairing_source:'sync',item_name:'Updated'}, {status:'qc',blank_product_id:'shop-choice'}),{item_name:'Updated'});
  for(const status of ['completed','qc','in_production','packing','on_hold']) assert.equal(mayPromoteToReserved(status),false);
  assert.equal(mayPromoteToReserved('queued'),true);
});

test('manual regeneration also preserves closed jobs and active line statuses',async()=>{
  const closed=await replay({manual:true,jobStatus:'completed'}); assert.equal(closed.status,200); assert(!closed.calls.some(c=>c.name==='job_items'||c.name==='sc_ensure_job_item_reservation_v1'));
  const active=await replay({manual:true}); assert.equal(active.status,200); assert(!active.calls.some(c=>c.name==='jobs'&&c.body?.status==='reserved'));
  const update=active.calls.find(c=>c.name==='job_items'&&c.method==='PATCH'); assert(update); assert(!('status' in update.body)); assert(!('blank_product_id' in update.body));
});

test('canonical terminal variants stay closed during delayed imports',async()=>{
 for(const status of ['production_complete','wc-production_complete','fulfilled','archived','removed']){
  const result=await replay({jobStatus:status});assert.equal(result.status,200);assert.equal(result.body.action,'terminal_history_refreshed');assert(!result.calls.some(c=>c.name==='job_items'||c.name==='sc_ensure_job_item_reservation_v1'));
  assert.equal(existingLineUpdate({status:'queued'},{status}),null);
 }
});

test('incoming terminal order statuses close active jobs in both import paths',async()=>{
 for(const manual of [false,true])for(const orderStatus of ['completed','production_complete','wc-completed','refunded']){
  const result=await replay({manual,jobStatus:'queued',orderStatus});assert.equal(result.status,200);assert(!result.calls.some(c=>c.name==='job_items'||c.name==='sc_ensure_job_item_reservation_v1'));
  assert(result.calls.some(c=>c.name==='jobs'&&c.method==='PATCH'&&c.body.status===(orderStatus==='refunded'?'cancelled':'completed')));
 }
});

test('manual board failures remain visible as completed-with-warnings recovery items',async()=>{
 const r=await replay({manual:true,failBoard:true});assert.equal(r.status,200);assert(r.body.errors.some(e=>/board recalculation failed/i.test(e.error)));
 assert(r.calls.some(c=>c.name==='sc_pullsheet_sync_runs'&&c.body?.outcome==='completed_with_warnings'&&c.body.error_message?.includes('Fixture board failure')));
 assert(r.calls.some(c=>c.name==='sc_release_order_sync_lease_v1'));
});
