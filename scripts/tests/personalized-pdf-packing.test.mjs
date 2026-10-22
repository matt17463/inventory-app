import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('Complete PDF manual covers source-derived screens and interface controls',()=>{
 const script=read('../../scripts/build-application-guide-pdf.mjs');
 const pkg=JSON.parse(read('../../package.json'));
 assert.match(pkg.scripts.prebuild,/guide:pdf/);
 assert.match(pkg.scripts['guide:pdf'],/build-application-guide-pdf\.mjs/);
 for(const key of ['guideChapters','navSections','trainingTutorials','controlsIn','screens','WordPress','Part IV','Part V','Part VI','jsPDF'])
  assert(script.includes(key),'Missing PDF manual part '+key);
 assert.match(script,/public.*skilled-crafting-application-user-guide\.pdf/);
});
test('Application Guide offers in-browser reader and download',()=>{
 const src=read('../../src/ApplicationGuide.jsx');
 assert.match(src,/Download PDF user guide/);
 assert.match(src,/Open or print PDF/);
 assert.match(src,/iframe title="Skilled Crafting PDF user guide"/);
 assert.match(src,/download="Skilled-Crafting-Complete-User-Guide\.pdf"/);
});
test('Packing is line-item-specific, append-only and restricted by RLS',()=>{
 const sql=read('../../supabase/migrations/202610220008_guided_packing_signoff_art_versions.sql');
 for(const table of ['sc_job_packing_line_events','sc_job_pickup_acknowledgments','sc_job_artwork_revision_checks']){
  assert(sql.includes('alter table public.'+table+' enable row level security'));
  assert(sql.includes('revoke all on public.'+table+' from public,anon,authenticated'));
 }
 assert.match(sql,/new\.packed_quantity>coalesce\(item\.quantity,0\)/);
 assert.match(sql,/item\.job_id=new\.job_id|id=new\.job_item_id and job_id=new\.job_id/);
 assert.match(sql,/packing count/i);
 assert.doesNotMatch(sql,/grant update|grant delete/i);
});
test('Pickup acknowledgment is an atomic signed record requiring latest passing QC and exact packing counts',()=>{
 const sql=read('../../supabase/migrations/202610220008_guided_packing_signoff_art_versions.sql');
 assert.match(sql,/sc_record_job_pickup_acknowledgment/);
 assert.match(sql,/p_consent is distinct from true/);
 assert.match(sql,/from public\.phase5_qc_checklists/);
 assert.match(sql,/from public\.sc_job_packing_line_events/);
 assert.match(sql,/coalesce\(q\.packed_quantity,-1\)<>coalesce\(i\.quantity,0\)/);
 assert.match(sql,/insert into public\.sc_job_pickup_acknowledgments/);
 assert.match(sql,/insert into public\.sc_job_fulfillment_checks/);
 assert.match(sql,/for update/);
});
test('Artwork revision checkpoints point to an already-linked handoff',()=>{
 const sql=read('../../supabase/migrations/202610220008_guided_packing_signoff_art_versions.sql');
 assert.match(sql,/sc_guard_art_revision_check/);
 assert.match(sql,/sc_job_artwork_links l/);
 assert.match(sql,/approval_reference/);
 assert.match(sql,/revision_label/);
});
test('New packing/signature UI prevents training writes and does not adjust stock or invoice',()=>{
 const ui=read('../../src/GuidedPackingSignoff.jsx');
 const api=read('../../src/lib/guidedJobApi.js');
 assert.match(ui,/shouldSimulateWrites/);
 assert.match(ui,/sc_record_job_pickup_acknowledgment/);
 assert.match(ui,/sc_job_packing_line_events/);
 assert.match(ui,/sc_job_artwork_revision_checks/);
 assert.match(ui,/recipient.*full name/i);
 assert.match(api,/sc_job_pickup_acknowledgments/);
 assert.match(api,/sc_job_artwork_revision_checks/);
 assert.doesNotMatch(ui,/update-stock|inventory_movements|wooRequest|from\('client_orders'\)\.update/);
});
test('Family training uses fake scenarios, local state, and never calls network or database',()=>{
 const content=read('../../src/JobTrainingSimulator.jsx');
 assert.match(content,/Example U12 Falcons/);
 assert.match(content,/Example Woodland School/);
 assert.match(content,/Example Panthers Club/);
 assert.match(content,/No.*touch real inventory/i);
 assert.doesNotMatch(content,/fetch\(|supabase|authenticatedFunctionFetch|localStorage/);
});
