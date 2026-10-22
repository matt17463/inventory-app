import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wordPressAuditChapters} from '../../src/application-guide/wordpressAuditLearning.js';
import {wordpressAuditTutorials} from '../../src/application-guide/wordpressAuditTraining.js';
import {guideChapters} from '../../src/application-guide/guideData.js';
import {trainingTutorials} from '../../src/application-guide/trainingData.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const audit=JSON.parse(read('../../src/application-guide/wordpressPluginAudits.json'));
const record=JSON.parse(read('../../docs/wordpress-audit/AUDIT_COMPLETE.json'));
test('WordPress real audit explicitly remains partial with consistent observed counts',()=>{
 assert.equal(record.status,'partial');assert.equal(audit.auditStatus,'partial');
 assert.equal(audit.plugins.length,record.auditedCounts.installedPlugins);
 assert.equal(audit.plugins.filter(p=>p.activationStatus==='active').length,record.auditedCounts.activePlugins);
 const screens=audit.plugins.flatMap(p=>[...(p.adminScreens||[]),...(p.publicScreens||[])]);
 assert.equal(screens.length,record.auditedCounts.screenSectionRecords);
 assert.equal(screens.reduce((n,s)=>n+(s.controls?.length||0),0),record.auditedCounts.controlRecords);
 assert.equal(record.auditedCounts.fullyLiveVerifiedPlugins,0);
});
test('online guide includes observed plugin field details and marks uninspected entries explicitly',()=>{
 const chapters=wordPressAuditChapters();
 assert.equal(chapters.length,2);
 const pages=chapters[1].sections;
 assert(pages.length>=70);
 const documented=pages.filter(x=>x.steps.some(step=>step.includes('For beginners:')));
 assert(documented.length>=20);
 assert(pages.some(p=>p.title.includes('Client Storefronts')&&p.steps.some(s=>s.includes('control')||s.includes('For beginners:'))));
 assert(pages.some(p=>p.title.includes('plugin inventory only')));
 assert(guideChapters.some(c=>c.id==='wordpress-audit-field-reference'));
 const all=JSON.stringify(chapters);
 for(const warning of ['0.1.2','0.1.3','200','Legacy','Replacement','SKU','shipping'])assert(all.includes(warning),warning);
});
test('training has six read-only role modules on observed plugin screens',()=>{
 const tutorials=wordpressAuditTutorials();
 assert.equal(tutorials.length,6);
 for(const t of tutorials){
  assert(t.steps.length>=3,t.id);
  assert.equal(t.safeMode,'guided-read-only');
  assert(t.steps.every(s=>s.readOnly===true));
  assert(t.steps.every(s=>!s.instruction.includes('Click Save')));
  assert(trainingTutorials.some(x=>x.id===t.id));
 }
});
test('PDF separates source scanning, verified WordPress screens and missing outcomes',()=>{
 const script=read('../../scripts/build-application-guide-pdf.mjs');
 assert.match(script,/auditHandoff/);
 assert.match(script,/auditHandoff\.status/);
 assert.match(script,/Part VIII - WordPress Audit Evidence and Open Verification/);
 assert.match(script,/full per-field novice and advanced descriptions are in Part III/i);
 assert.match(script,/Twenty-nine installed plugins/);
 assert.doesNotMatch(script,/The live WordPress plugin inventory and actual admin-screen walkthrough have not yet been verified by ChatGPT Work/);
});
test('admin and novice users get access without treating live observations as tested effects',()=>{
 const page=read('../../src/ApplicationGuide.jsx');
 const audit=read('../../src/application-guide/DocumentationAuditPanel.jsx');
 assert.match(page,/WordPress documentation updated from the October 22 audit/);
 assert.match(audit,/advancedNotes/);
 assert.match(audit,/screen\.verified\?'Screen controls visually observed/);
 assert.match(audit,/29 plugins have inventory-only coverage/);
});
