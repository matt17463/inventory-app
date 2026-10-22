import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {closeoutReadiness,closeoutMessage,latestPackingByItem} from '../../src/lib/jobCloseout.js';
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const job={id:91,customer_name:'Example Team',woocommerce_order_id:155,woo_payment_status:'paid',status:'ready_to_ship'};
const items=[{id:21,quantity:4,selected_size:'M',status:'open'},{id:22,quantity:2,status:'open'}];
const data={job,items,qc:[{passed:true,qc_completed_at:'2026-10-20T17:00:00Z'}],
 packing:[{job_item_id:21,packed_quantity:4,created_at:'2026-10-20T12:00:00Z'},
          {job_item_id:22,packed_quantity:2,created_at:'2026-10-20T12:00:00Z'}],
 fulfillment:[],pickup:[],deliveryConfirmations:[],unavailable:{}};
test('one source of truth: exact packing, paid Woo and passed QC permit ready, not delivered',()=>{
 assert.equal(latestPackingByItem(data.packing).size,2);
 const r=closeoutReadiness(data);
 assert.equal(r.kind,'ready');assert.equal(r.packingComplete,true);
 assert.equal(r.hasPickup,false);assert.equal(r.isWoo,true);
});
test('missing line, mismatched count or latest QC fail blocks release',()=>{
 const missing=closeoutReadiness({...data,packing:[data.packing[0]]});
 assert.equal(missing.readyForRelease,false);
 const bad=closeoutReadiness({...data,packing:[...data.packing,{job_item_id:22,packed_quantity:1,created_at:'2026-10-21T12:00:00Z'}]});
 assert.equal(bad.readyForRelease,false);
 const qc=closeoutReadiness({...data,qc:[...data.qc,{passed:false,qc_completed_at:'2026-10-21T17:00:00Z'}]});
 assert.equal(qc.qcPassed,false);
});
test('unpaid invoices never inherit Woo payment, and cancelled jobs remain stopped',()=>{
 assert(closeoutReadiness({...data,job:{id:91,manual_order_id:9,order_source:'manual_invoice',payment_received:false}}).blockers.some(x=>x.includes('QuickBooks')));
 assert.equal(closeoutReadiness({...data,job:{...job,status:'cancelled'}}).readyForRelease,false);
});
test('shipment is dispatch, not carrier delivery; separate proof required',()=>{
 const shipped=closeoutReadiness({...data,fulfillment:[{kind:'shipped',carrier_reference:'UPS-TEST-1234'}]});
 assert.equal(shipped.kind,'dispatched');
 const proof=closeoutReadiness({...data,fulfillment:[{kind:'shipped',carrier_reference:'UPS-TEST-1234'}],
  deliveryConfirmations:[{id:'confirm',proof_reference:'POD-TEST',created_at:'2026-10-21T12:00:00Z'}]});
 assert.equal(proof.kind,'delivered');
});
test('pickup acknowledgment differs from packing and existing shipment without tracking',()=>{
 const p=closeoutReadiness({...data,pickup:[{recipient_name:'Test Recipient'}]});
 assert.equal(p.kind,'collected');
 assert.equal(closeoutReadiness({...data,fulfillment:[{kind:'shipped'}]}).kind,'review');
});
test('notification templates never imply an email is automatically sent',()=>{
 const msg=closeoutMessage({kind:'ready_for_pickup',job,channel:'unselected'});
 assert.match(msg.subject,/ready for pickup/i);
 assert.match(msg.body,/confirm the pickup time/i);
 assert.throws(()=>closeoutMessage({kind:'shipped',job,channel:'pickup'}),/dispatch/);
});
test('migration enforces role-specific immutable delivery proof and manual send deduplication',()=>{
 const sql=file('../../supabase/migrations/202610220009_job_closeout_communications.sql');
 for(const name of ['sc_job_delivery_confirmations','sc_job_customer_messages']){
  assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on public\\.'+name+' from public,anon,authenticated'));
 }
 assert.match(sql,/sc_guard_delivery_confirmation/);
 assert.match(sql,/phase5_qc_checklists/);
 assert.match(sql,/sc_job_packing_line_events/);
 assert.match(sql,/source_draft_id/);
 assert.match(sql,/unique index if not exists sc_customer_message_once_idx/);
 assert.doesNotMatch(sql,/grant update|grant delete|insert into public\.jobs/i);
});
test('UI prints PDF locally and requires human confirmation for outbound messages',()=>{
 const src=file('../../src/JobCloseoutCenter.jsx');
 const pdf=file('../../src/lib/closeoutPdf.js');
 assert.match(src,/downloadJobManifest/);assert.match(src,/downloadPackageLabels/);
 assert.match(src,/Copy email to send/);assert.match(src,/actually sent/);
 assert.match(src,/shouldSimulateWrites/);
 assert.match(pdf,/jsPDF/);assert.match(pdf,/qrcodegen/);
 assert.match(pdf,/NOT A CARRIER POSTAGE LABEL/);
 assert.doesNotMatch(src,/sendEmail|smtp|resend\.com|from\('jobs'\)\.update|update-stock/);
});
test('new section is integrated into Work Hub and evidence query',()=>{
 const src=file('../../src/WorkHub.jsx'),api=file('../../src/lib/guidedJobApi.js');
 assert.match(src,/JobCloseoutCenter/);
 assert.match(api,/sc_job_delivery_confirmations/);
 assert.match(api,/sc_job_customer_messages/);
});
