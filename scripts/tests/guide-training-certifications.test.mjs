import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSteps,validateReview,certificationCurrent} from '../../netlify/functions/_shared/trainingRecords.js';
import {TRAINING_VERSION,trainingTutorials} from '../../src/application-guide/trainingData.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('training source contains finite approved tutorials and current version',()=>{
 assert.equal(TRAINING_VERSION,'1.7.0');
 assert(trainingTutorials.length>=14);
 const ids=trainingTutorials.map(t=>t.id);
 assert.equal(ids.length,new Set(ids).size);
 assert(trainingTutorials.every(t=>t.steps.length>0&&t.steps.length<=500));
});
test('completed steps reject duplicate, negative, noninteger or out of range indices',()=>{
 assert.deepEqual(validateSteps([2,0,1],3),[0,1,2]);
 for(const x of [[0,0],[-1],[1.5],[4],['garbage']]){
  assert.throws(()=>validateSteps(x,3),/Completed steps/);
 }
 assert.throws(()=>validateSteps('0',3),/Invalid/);
});
test('manager certification is not displayed for edited or stale curriculum',()=>{
 const p={completed:true,curriculum_version:'1.6.0',updated_at:'2026-10-22T15:00:00Z'};
 const c={curriculum_version:'1.6.0',signed_off_at:'2026-10-22T15:01:00Z'};
 assert(certificationCurrent(p,c,'1.6.0'));
 assert(!certificationCurrent({...p,updated_at:'2026-10-22T15:05:00Z'},c,'1.6.0'));
 assert(!certificationCurrent(p,{...c,curriculum_version:'1.5'},'1.6.0'));
 assert(!certificationCurrent({...p,completed:false},c,'1.6.0'));
});
test('QA triage is not verification certification',()=>{
 const x=validateReview({targetType:'wordpress-plugin',targetId:'skilled-crafting-client-storefronts',
  reviewState:'evidence-captured',evidenceReference:'PR-123',reviewerNote:'Screens seen; checkout not tested'});
 assert.equal(x.review_state,'evidence-captured');
 assert(!('verified' in x));
 for(const bad of ['live-verified','certified','passed']){
  assert.throws(()=>validateReview({targetType:'wordpress-plugin',targetId:'foo',reviewState:bad}),/Unrecognized/);
 }
 assert.throws(()=>validateReview({targetType:'application-route',targetId:'<script>',reviewState:'blocked'}),/Unrecognized/);
});
test('migration denies client grants, enables RLS, keeps server-only tables',()=>{
 const sql=read('../../supabase/migrations/20261022202700_training_guide_certifications.sql');
 for(const table of ['sc_training_progress','sc_training_certifications','sc_documentation_qa_reviews']){
  assert.match(sql,new RegExp('create table if not exists public\\.'+table));
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on public\\.'+table+' from public,anon,authenticated'));
 }
 assert(!/grant .* to authenticated|security definer/i.test(sql));
});
test('server-side auth binds progress to token user and management to manager role',async()=>{
 const src=read('../../netlify/functions/training-certifications.js');
 assert.match(src,/authorizeEmployee/);
 assert.match(src,/allowedRoles:\[\]/);
 assert.match(src,/user_id:user.id/);
 assert.match(src,/if\(!manager\)return fail\(event,403/);
 assert.match(src,/validateSteps\(progress.completed_steps,tutorial.steps.length\)/);
 assert.match(src,/sc_app_user_roles/);
 assert(!/upsert\(row.*user_id:input.userId/.test(src));
 const {handler}=await import('../../netlify/functions/training-certifications.js');
 const opts=await handler({httpMethod:'OPTIONS',headers:{}});
 assert.equal(opts.statusCode,204);
 const noAccess=await handler({httpMethod:'POST',headers:{},body:JSON.stringify({
   action:'certify',employeeId:'fake',tutorialId:'fake'
 })});
 assert.equal(noAccess.statusCode,401);
});
test('frontend writes only through privileged Netlify API; step completion is server-first',()=>{
 const ui=read('../../src/ApplicationGuide.jsx');
 const board=read('../../src/application-guide/TrainingCertificationBoard.jsx');
 const audit=read('../../src/application-guide/DocumentationQaTriage.jsx');
 assert.match(ui,/getMyTraining\(\)/);
 assert.match(ui,/await saveTrainingProgress\(/);
 assert(ui.indexOf('await saveTrainingProgress(')<ui.indexOf('setProgress(prev=>'));
 assert.match(ui,/Manager qualification is recorded separately/);
 assert.match(board,/certifyTraining/);
 assert.match(audit,/saveDocumentationQa/);
 assert.match(audit,/does not mark a plugin or dialog live-verified/);
});
test('PDF generation triggers on plugin, guide, guided training and audits',()=>{
 const workflow=read('../../.github/workflows/application-user-guide-pdf.yml');
 for(const target of ['wordpress/skilled-crafting-client-stores/**',
  'docs/wordpress-audit/**','src/lib/guidedTraining.js','netlify/functions/training-certifications.js']){
  assert(workflow.includes(target),target);
 }
});
