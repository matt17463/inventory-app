import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {documentationCoverage} from '../../src/application-guide/documentationCoverage.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const dialogs=JSON.parse(read('../../src/application-guide/conditionalDialogs.json'));
const wp=JSON.parse(read('../../src/application-guide/wordpressPluginAudits.json'));

test('source coverage never impersonates actual browser verification',()=>{
 const r=documentationCoverage({screens:[{path:'/work-hub',title:'Work Hub',controls:[{label:'Save'}]},
  {path:'/client-orders',title:'Client Orders',controls:[{label:'Invoice'}]}],
  dialogs:[{id:'x',title:'Confirm',route:'/work-hub',trigger:'Save',fields:[{name:'Amount',meaning:'What amount'}],result:'Read only',status:'source-reviewed'}],
  plugins:[{slug:'plugin',reviewStatus:'source-only',adminScreens:[{name:'Settings',verified:false}],publicScreens:[]}]});
 assert.equal(r.sourceControlCount,2);
 assert.equal(r.liveVerifiedDialogs,0);
 assert.equal(r.pluginsLive,0);
 assert.equal(r.pluginScreensVerified,0);
 assert.equal(r.routes[0].status,'partial-conditional-reference');
 assert.equal(r.routes[1].status,'source-inventory-only');
});
test('conditional dialogs contain novice field definitions, triggers, risks and read-only exercises',()=>{
 assert(dialogs.dialogs.length>=8);
 const ids=new Set();
 for(const d of dialogs.dialogs){
  assert(!ids.has(d.id),'Duplicate dialog '+d.id);ids.add(d.id);
  for(const key of ['sourceFile','route','title','trigger','visibleWhen','result','trainingScenario','status'])
   assert(d[key],d.id+' is missing '+key);
  assert(d.fields?.length>0,d.id+' lacks field definitions');
  assert(['source-reviewed','needs-live-review','live-verified'].includes(d.status));
 }
 const r=documentationCoverage({screens:[],dialogs:dialogs.dialogs,plugins:[]});
 assert.deepEqual(r.invalid,[]);
 assert.equal(r.liveVerifiedDialogs,0,'Source examples cannot claim live verification');
});
test('WordPress inventory makes no unverified installation claims',()=>{
 assert.equal(wp.auditStatus,'awaiting-live-wordpress-review');
 assert(wp.pluginCandidatesToCheck.some(x=>x.includes('WooCommerce')));
 assert(wp.plugins.every(p=>p.reviewStatus==='source-only'||p.reviewStatus==='unverified'));
 assert(wp.plugins.every(p=>p.activationStatus==='unverified'));
});
test('admin audit is hidden from marketing users, and publicly served screenshots are forbidden',()=>{
 const guide=read('../../src/ApplicationGuide.jsx');
 const panel=read('../../src/application-guide/DocumentationAuditPanel.jsx');
 assert.match(guide,/const canAudit = access\?\.role === 'admin' \|\| access\?\.role === 'manager'/);
 assert.match(guide,/canAudit&&<button/);
 assert.match(guide,/DocumentationAuditPanel/);
 assert.match(panel,/private audit repository/);
 assert.doesNotMatch(panel,/<img loading="lazy"/);
});
test('PDF generator includes conditional dialog annex, plugin records and coverage export',()=>{
 const pdf=read('../../scripts/build-application-guide-pdf.mjs');
 assert.match(pdf,/documentation-audit-report\.json/);
 assert.match(pdf,/Part VIII - Conditional Dialogs & External WordPress Plugin Audit/);
 assert.match(pdf,/WORDPRESS AUDIT OPEN/);
 assert.match(pdf,/liveVerifiedDialogs/);
 assert.match(pdf,/pluginScreens/);
});
test('reviewer handoff instructs no transactional testing, redaction, and original chat return',()=>{
 const handoff=read('../../docs/wordpress-audit/WORK_HANDOFF.md');
 for(const token of ['Plugins > Installed Plugins','screen-audit.md','active-plugin-inventory.md','AUDIT_COMPLETE.json','ORIGINAL ChatGPT conversation','WordPress','NOT']){
  assert(handoff.includes(token),'Missing handoff requirement '+token);
 }
 const training=read('../../src/application-guide/trainingData.js');
 for(const id of ['conditional-order-to-delivery-read-only','conditional-carrier-purchase-read-only','wordpress-conditional-audit-training'])
  assert(training.includes(id));
 assert.match(training,/Do NOT buy a label/);
});
