import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {deriveGuidedProgress} from '../../src/lib/guidedJobProgress.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const job={id:23,woocommerce_order_id:101,status:'ready_to_ship',woo_payment_status:'paid'};
const base={job,items:[],reservations:[],travelers:[],qc:[{passed:true,created_at:'2026-10-21T12:00:00Z'}],handoffs:[],artworkLinks:[],fulfillment:[],photos:[],notes:[],unavailable:{}};
test('job-specific QC link deep-links using job query rather than requiring a second lookup',()=>{
 const progress=deriveGuidedProgress({job_id:23,saved_job_status:'qc'},{...base,qc:[]});
 assert.equal(progress.priority.href,'/qc-checklist?job=23');
 const qc=read('../../src/QcChecklist.jsx');
 assert.match(qc,/params\.get\('job'\)/);assert.match(qc,/data\.find\(r=>Number\(r\.job_id\)===requestedJob\)/);
});
test('packing is not falsely classified as shipped',()=>{
 const p=deriveGuidedProgress({job_id:23,saved_job_status:'ready_to_ship'},{...base,fulfillment:[{kind:'packing_checked'}]});
 assert.equal(p.steps.find(x=>x.id==='delivery').state,'linked');
 assert.match(p.priority.title,/package line|handoff/);
});
test('recorded customer collection provides evidence without completing the job',()=>{
 const p=deriveGuidedProgress({job_id:23,saved_job_status:'ready_to_ship'},{...base,fulfillment:[{kind:'picked_up'}]});
 assert.equal(p.steps.find(x=>x.id==='delivery').state,'verified');
 assert.equal(p.priority.href,'/production-board');
});
test('artwork handoff linkage is an auditable reference, not automatic customer approval',()=>{
 const p=deriveGuidedProgress({job_id:23,saved_job_status:'ready_to_produce'},{...base,artworkLinks:[{handoff:{approved_file_url:'https://example.invalid/art.png',automation_status:'ready'}}]});
 assert.equal(p.steps.find(x=>x.id==='artwork').state,'linked');
 assert.match(p.steps.find(x=>x.id==='artwork').reason,/verify.*customer approval/i);
});
test('new fulfillment and artwork link tables use restricted append-only access',()=>{
 const sql=read('../../supabase/migrations/202610220007_guided_job_fulfillment_artwork.sql');
 for(const table of ['sc_job_fulfillment_checks','sc_job_artwork_links'])assert(sql.includes('alter table public.'+table+' enable row level security'));
 assert.match(sql,/revoke all on public\.sc_job_fulfillment_checks from public,anon,authenticated/);
 assert.match(sql,/revoke all on public\.sc_job_artwork_links from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant update|grant delete/i);
});
test('drill is local read-only and cannot change production or financial state',()=>{
 const s=read('../../src/GuidedJobPhaseTwo.jsx');
 assert.match(s,/shouldSimulateWrites\(\)/);
 assert.match(s,/sc_job_fulfillment_checks/);
 assert.match(s,/sc_job_artwork_links/);
 assert.match(s,/drillStep/);
 assert.doesNotMatch(s,/updateProductionBoardStatus|phase5_save_qc_checklist|update-stock/);
});
