import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DISCOVERY_FOCUSES,DISCOVERY_MACHINE_IDS,clamp100,discoveryScore,normalizeLeadKey,
  sanitizeDiscoveryLead,candidateScore,evidenceUrl} from '../../src/lib/productDiscoveryScoring.js';
const lead={name:'Wedding Acrylic Table Number Set',category:'Weddings & Events',
 audience:'wedding venue coordinators',description:'Custom engraved acrylic tables',
 equipment:['xtool_p2','xtool_omni','unknown_machine'],keywords:['acrylic','table','wedding'],
 differentiation:75,demand_indicator:65,supplier_notes:'Verify material',
 risks:'Avoid unverified substrate coating',sources:[
  {url:'https://example.org/materials/acrylic',title:'Manufacturer acrylic compatibility',source_type:'manufacturer',summary:'Material background'},
  {url:'https://example.org/events',title:'Public wedding inspiration',source_type:'marketplace',summary:'Market lead'}
 ]};
test('research focus catalog and supported equipment are explicit',()=>{
 assert.ok(DISCOVERY_FOCUSES.length>=5);
 assert.equal(DISCOVERY_MACHINE_IDS.includes('xtool_p2'),true);
 assert.equal(DISCOVERY_MACHINE_IDS.includes('unknown_machine'),false);
});
test('only credible URL protocol/host shapes can be stored',()=>{
 assert.equal(evidenceUrl('http://example.org'),null);
 assert.equal(evidenceUrl('https://127.0.0.1/secrets'),null);
 assert.equal(evidenceUrl('https://localhost/test'),null);
 assert.equal(evidenceUrl('https://user:pass@example.org'),null);
 assert.equal(evidenceUrl('https://example.org/materials/'),'https://example.org/materials/');
});
test('unsafe or uncited model candidates are rejected without storing',()=>{
 assert.equal(sanitizeDiscoveryLead({...lead,sources:[{url:'javascript:alert(1)',title:'Fake'}]}),null);
 assert.equal(sanitizeDiscoveryLead({...lead,equipment:['printer_from_space']}),null);
 assert.equal(sanitizeDiscoveryLead({...lead,name:'x'}),null);
 const normalized=sanitizeDiscoveryLead(lead);
 assert.deepEqual(normalized.equipment,['xtool_p2','xtool_omni']);
 assert.equal(normalized.sources.length,2);
 assert.equal(normalized.sources[0].source_type,'manufacturer');
 assert.equal(normalizeLeadKey('  Wedding—Acrylic TABLE Number SET  '),'wedding acrylic table number set');
});
test('score is conservative with sparse CRM and supplier data; no fabricated pricing',()=>{
 const l=sanitizeDiscoveryLead(lead);
 const empty=candidateScore(l,{crmSegments:[],supplierItems:[],approvedRecipeTypes:[]});
 assert.ok(empty.customer_fit<=35);
 assert.ok(empty.production_fit<=65);
 assert.equal(empty.evidence_notes.matched_supplier_items.length,0);
 assert.ok(discoveryScore(empty)<=100);
 assert.ok(discoveryScore(empty)>=0);
 const withData=candidateScore(l,{crmSegments:[{segment:'Wedding venues',count:2}],supplierItems:[
  {supplier:'Sample supplier',brand:'acrylic',style:'table number',description:'blank acrylic table number',supplier_sku:'T-01',unit_cost:4.5}
 ],approvedRecipeTypes:['xtool_p2']});
 assert.ok(withData.customer_fit>empty.customer_fit);
 assert.ok(withData.production_fit>empty.production_fit);
 assert.equal(withData.evidence_notes.matched_supplier_items[0].unit_cost,4.5);
 assert.equal(clamp100(200),100);
 assert.equal(clamp100(-5),0);
});
test('schema enforces employee-owned queued-only job creation and source attribution',()=>{
 const sql=fs.readFileSync('supabase/migrations/202610282303_ai_discovery_dashboard.sql','utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/created_by=\(select auth\.uid\(\)\)/);
 assert.match(sql,/status='queued'/);
 assert.match(sql,/sc_current_app_role\(\)/);
 assert.match(sql,/discovery_evidence jsonb/);
 assert.doesNotMatch(sql,/create policy.*for update/i);
});
test('research is offloaded to an authenticated Netlify background worker with bounded runs',()=>{
 const fn=fs.readFileSync('netlify/functions/product-discovery-run-background.js','utf8');
 const netlify=fs.readFileSync('netlify.toml','utf8');
 assert.match(netlify,/\[functions\."product-discovery-run-background"\][\s\S]*?background = true/);
 assert.match(fn,/authorizeEmployee\(event,\{functionName:handlerName,allowedRoles:\['admin','manager','marketing'\]\}\)/);
 assert.match(fn,/Daily research limit reached/);
 assert.match(fn,/eq\('created_by',auth\.user\.id\)/);
 assert.match(fn,/eq\('status','queued'\)/);
 assert.match(fn,/OPENAI_API_KEY/);
 assert.match(fn,/web_search/);
 assert.match(fn,/responseSchema/);
 assert.doesNotMatch(fn,/products\/.*status:'publish'/);
});
test('discovery UI presents automatic ranked candidates and review workflow without bypassing approval',()=>{
 const page=fs.readFileSync('src/ProductDevelopmentCenter.jsx','utf8');
 const ui=fs.readFileSync('src/ProductDiscoveryDashboard.jsx','utf8');
 assert.match(page,/00 · AI Discovery/);
 assert.match(page,/ProductDiscoveryDashboard opportunities/);
 assert.match(ui,/Discover and save products/);
 assert.match(ui,/onReview\?\.\(p\.id\)/);
 assert.match(ui,/provisional estimates/);
 assert.match(ui,/shouldSimulateWrites/);
 assert.match(ui,/sc_pdc_discovery_runs/);
 assert.match(ui,/product-discovery-run-background/);
});
