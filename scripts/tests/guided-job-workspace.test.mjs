import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deriveGuidedProgress,dueRisk,jobIdentity,GUIDED_STEPS} from '../../src/lib/guidedJobProgress.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const job={id:250,manual_order_id:15,order_source:'manual_invoice',payment_received:false,status:'ready_to_produce'};
const line={id:301,job_id:250,quantity:4,inventory_required:true,blank_product_id:'1e345d68-c32b-4df1-9c47-bd7dc96ac33e',status:'open'};
const base={job:{...job},items:[line],reservations:[{id:'r',quantity_reserved:4,status:'reserved'}],travelers:[],qc:[],handoffs:[],notes:[],unavailable:{}};

test('unpaid manual invoices are given an explicit finance action before production',()=>{
 const r=deriveGuidedProgress({job_id:250,saved_job_status:'ready_to_produce'},base);
 assert.equal(r.manual,true);
 assert.match(r.priority.title,/invoice payment/i);
 assert.equal(r.priority.href,'/client-orders');
 assert.equal(r.steps.find(s=>s.id==='order').state,'attention');
});
test('blank mismatches outrank recipe creation on paid Woo orders',()=>{
 const r=deriveGuidedProgress({job_id:250,saved_job_status:'ready_to_produce'},{...base,
   job:{id:250,woocommerce_order_id:180,woo_payment_status:'paid'},
   items:[{...line,blank_product_id:null}]});
 assert.equal(r.indicators.unpaired,1);
 assert.match(r.priority.title,/Pair/);
 assert.equal(r.priority.href,'/pullsheets/250');
});
test('existing Production Board blockers override app-inferred next-step suggestions',()=>{
 const r=deriveGuidedProgress({job_id:250,saved_job_status:'ready_to_produce',blocking_issues:[{message:'Missing supplier stock'}]},{
   ...base,job:{id:250,woocommerce_order_id:180,woo_payment_status:'paid'}});
 assert.equal(r.priority.kind,'blocked');
 assert.match(r.priority.reason,/supplier stock/);
});
test('artwork file linked does not falsely imply signed customer approval',()=>{
 const r=deriveGuidedProgress({job_id:250,saved_job_status:'ready_to_produce'},{
   ...base,job:{id:250,woocommerce_order_id:180,woo_payment_status:'paid'},
   handoffs:[{approved_file_url:'https://example.invalid/art.png'}]});
 assert.equal(r.steps.find(s=>s.id==='artwork').state,'linked');
 assert.match(r.steps.find(s=>s.id==='artwork').reason,/verify.*customer approval/i);
 assert.match(r.priority.title,/recipe and QR traveler/i);
});
test('production and completed steps use saved authoritative statuses without changing them',()=>{
 const completed=deriveGuidedProgress({job_id:250,saved_job_status:'completed'},{
   ...base,job:{id:250,woocommerce_order_id:180,woo_payment_status:'paid'},
   qc:[{passed:true}],travelers:[{job_item_id:301}],handoffs:[{approved_file_url:'https://example.invalid/art.png'}]});
 assert.equal(completed.priority.kind,'done');
 assert.equal(completed.steps.find(s=>s.id==='qc').state,'verified');
 assert.equal(completed.steps.find(s=>s.id==='delivery').state,'verified');
 assert.equal(completed.steps.length,GUIDED_STEPS.length);
});
test('QC stage cannot falsely mark QC complete without a passed record',()=>{
 const r=deriveGuidedProgress({job_id:250,saved_job_status:'qc'},{
   ...base,job:{id:250,woocommerce_order_id:180,woo_payment_status:'paid'},handoffs:[{approved_file_url:'https://example.invalid/art.png'}],travelers:[{job_item_id:301}]});
 assert.equal(r.priority.href,'/qc-checklist');
 assert.equal(r.steps.find(s=>s.id==='qc').state,'attention');
});
test('inaccessible evidence is marked unknown rather than interpreted as absence',()=>{
 const r=deriveGuidedProgress({job_id:250,saved_job_status:'ready_to_produce'},{
   ...base,job:{id:250,woocommerce_order_id:180,woo_payment_status:'paid'},
   unavailable:{items:'RLS denied',travelers:'Unable to read',qc:'missing'}});
 assert.equal(r.steps.find(s=>s.id==='stock').state,'unknown');
 assert.equal(r.steps.find(s=>s.id==='recipe').state,'unknown');
 assert.equal(r.steps.find(s=>s.id==='qc').state,'unknown');
});
test('shop-local due dates have no UTC-midnight off-by-one errors',()=>{
 assert.equal(dueRisk('2026-10-22',new Date('2026-10-22T12:00:00')).kind,'soon');
 assert.equal(dueRisk('2026-10-21',new Date('2026-10-22T12:00:00')).kind,'late');
 assert.equal(dueRisk('bad-date').kind,'unscheduled');
 assert.equal(jobIdentity({job_id:'250'}),250);
});
test('audit notes are append-only, internal-only and tied to authoritative jobs',()=>{
 const sql=read('../../supabase/migrations/202610220006_guided_work_handoffs.sql');
 assert.match(sql,/references public\.jobs\(id\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all .* from public,anon,authenticated/);
 assert.match(sql,/created_by=\(select auth\.uid\(\)\)/);
 assert.match(sql,/grant select,insert .* to authenticated/);
 assert.doesNotMatch(sql,/grant .*update|grant .*delete/i);
});
test('Work Hub shows evidence-based next actions and never mutates job state directly',()=>{
 const jsx=read('../../src/WorkHub.jsx');
 const api=read('../../src/lib/guidedJobApi.js');
 assert.match(jsx,/deriveGuidedProgress/);
 assert.match(jsx,/loadGuidedJobEvidence/);
 assert.match(jsx,/addGuidedJobNote/);
 for(const table of ['job_items','inventory_reservations','sc_job_travelers','phase5_qc_checklists','sc_approval_production_handoffs'])
   assert(api.includes("from('"+table+"')"),table);
 assert.doesNotMatch(jsx,/updateProductionBoardStatus|sc_set_production_board_status/);
 assert.doesNotMatch(api,/from\('jobs'\)\.update|from\('inventory_reservations'\)\.update/);
});
