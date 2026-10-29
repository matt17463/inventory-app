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

test('source and photo URL constraints execute in PostgreSQL and reject unsafe URLs',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 try{
  await db.exec(`create table sc_pdc_sources(source_url text constraint sc_pdc_sources_source_url_check check(source_url ~ '^https://[^ ]{5,1000}$'));
   create table sc_pdc_trials(photo_url text constraint sc_pdc_trials_photo_url_check check(photo_url is null or photo_url ~ '^https://[^ ]{5,1000}$'));`);
  await assert.rejects(db.query('insert into sc_pdc_sources values ($1)',['https://example.org/evidence']),/invalid repetition/);
  await db.exec(fs.readFileSync('supabase/migrations/20261029023702_product_event_source_url_validation.sql','utf8'));
  for(const url of ['https://example.org/evidence','https://example.org/'+ 'x'.repeat(600)]){
   await db.query('insert into sc_pdc_sources values ($1)',[url]);
   await db.query('insert into sc_pdc_trials values ($1)',[url]);
  }
  for(const url of ['http://example.org/x','https://example.org/a b','https://example.org/a\nb','https://example.org/'+'x'.repeat(1000)]){
   await assert.rejects(db.query('insert into sc_pdc_sources values ($1)',[url]),/check constraint/);
  }
  await db.exec('insert into sc_pdc_trials values (null)');
 }finally{await db.close();}
});

test('failed source inserts cannot count as a source-linked saved candidate',async()=>{
 const {saveDiscoverySources}=await import('../../netlify/functions/_shared/aiDiagnostics.js');
 const db={from:()=>({insert:async()=>({error:{message:'constraint failure'}})})};
 await assert.rejects(saveDiscoverySources(db,[{source_url:'https://example.org'}]),/could not be saved/);
 await assert.rejects(saveDiscoverySources(db,[]),/no research source/);
 await saveDiscoverySources({from:()=>({insert:async()=>({error:null})})},[{source_url:'https://example.org'}]);
});

test('OpenAI diagnostics distinguish quota/auth/request failures without echoing secrets',async()=>{
 const {aiFailure}=await import('../../netlify/functions/_shared/aiDiagnostics.js');
 const response=(status,code)=>({status,json:async()=>({error:{code,message:'SECRET must not be relayed'}})});
 assert.match(await aiFailure(response(429,'insufficient_quota')),/billing and available credit/);
 assert.match(await aiFailure(response(429,'rate_limit_exceeded')),/retry later/);
 assert.match(await aiFailure(response(401,'invalid_api_key')),/credential/);
 assert.match(await aiFailure(response(403,'permission_denied')),/permissions/);
 assert.match(await aiFailure(response(400,'unsupported_parameter')),/request format/);
 assert.match(await aiFailure(response(503,'unknown')),/service error/);
 assert.doesNotMatch(await aiFailure(response(400,'SECRET')),/SECRET/);
});

test('material test plans use Responses JSON mode and preserve safety gates',async()=>{
 const helper=new URL('../../netlify/functions/_shared/aiDiagnostics.js',import.meta.url).href;
 const source=fs.readFileSync('netlify/functions/material-settings-ai.js','utf8')
  .replace(/import \{ authorizeEmployee, jsonResponse, auditFunctionSecurity \} from '.\/_shared\/security.js';/,
   `const authorizeEmployee=async()=>({ok:true,user:{id:'test'},role:'admin'});
    const jsonResponse=(statusCode,data)=>({statusCode,body:JSON.stringify(data)});
    const auditFunctionSecurity=async()=>{};`)
  .replace("'./_shared/aiDiagnostics.js'",JSON.stringify(helper))
  .replace("'./_shared/freeResearch.js'",JSON.stringify(new URL('../../netlify/functions/_shared/freeResearch.js',import.meta.url).href));
 const {handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const originalFetch=globalThis.fetch,originalKey=process.env.OPENAI_API_KEY;
 let calls=0;
 try{
  process.env.OPENAI_API_KEY='test-only-placeholder';
  globalThis.fetch=async(url,options)=>{
   calls++;
   assert.equal(url,'https://api.openai.com/v1/responses');
   const body=JSON.parse(options.body);
   assert.equal(body.text.format.type,'json_object');
   assert.equal(body.max_output_tokens,1300);
   assert.equal(body.input[0].role,'system');
   return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'Test coupon first',candidate_settings:{power:'80%'},test_steps:['Confirm exact material'],warnings:['Ventilation required'],questions:[]})}]}]})};
  };
  const payload={machine_type:'xtool_p2',operation:'engrave',machine_model:'xTool P2',machine_configuration:'55W CO2',material_name:'clear cast acrylic'};
  const response=await handler({httpMethod:'POST',body:JSON.stringify(payload)});
  const data=JSON.parse(response.body);
  assert.equal(response.statusCode,200);
  assert.equal(data.review_required,true);
  assert.equal(data.confidence,'unverified');
  assert.match(data.candidate_settings.power,/verify exact numeric setting/);
  assert.match(data.evidence_note,/Not approved for production/);
  const blocked=await handler({httpMethod:'POST',body:JSON.stringify({...payload,material_name:'PVC'})});
  assert.equal(blocked.statusCode,422);
  assert.equal(calls,1,'unsafe laser inputs must not call OpenAI');
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=originalKey;
 }
});

test('discovery daily and active-run limits stop requests before OpenAI is called',async()=>{
 const scoring=new URL('../../src/lib/productDiscoveryScoring.js',import.meta.url).href;
 const helper=new URL('../../netlify/functions/_shared/aiDiagnostics.js',import.meta.url).href;
 const source=fs.readFileSync('netlify/functions/product-discovery-run-background.js','utf8')
  .replace(/import \{authorizeEmployee,auditFunctionSecurity\} from '.\/_shared\/security.js';/,
   `let testDb; export const setDb=db=>{testDb=db;};
    const authorizeEmployee=async()=>({ok:true,user:{id:'test'},role:'admin',supabase:testDb});
    const auditFunctionSecurity=async()=>{};`)
  .replace("'../../src/lib/productDiscoveryScoring.js'",JSON.stringify(scoring))
  .replace("'./_shared/aiDiagnostics.js'",JSON.stringify(helper))
  .replace("'./_shared/freeResearch.js'",JSON.stringify(new URL('../../netlify/functions/_shared/freeResearch.js',import.meta.url).href));
 const {handler,setDb}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const originalFetch=globalThis.fetch;
 let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw Error('Should not reach OpenAI');};
  for(const [recent,active,expected] of [[5,0,/Daily research limit/],[4,2,/already active/]]){
   const updates=[];
   setDb({from:()=>({recent:false,select(){return this;},eq(){return this;},gte(){this.recent=true;return this;},
    limit(){return Promise.resolve({data:Array(this.recent?recent:active).fill({id:'test'}),error:null});},
    single(){return Promise.resolve({data:{status:'queued'},error:null});},
    update(fields){updates.push(fields);return this;},then(resolve){resolve({error:null});}})});
   await handler({httpMethod:'POST',body:JSON.stringify({run_id:'00000000-0000-0000-0000-000000000001'})});
   assert.equal(updates.at(-1).status,'failed');
   assert.match(updates.at(-1).message,expected);
  }
  assert.equal(calls,0);
  let unauthorizedUpdates=0;
  setDb({from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:null,error:{message:'not owned'}}),update(){unauthorizedUpdates++;return this;}})});
  await handler({httpMethod:'POST',body:JSON.stringify({run_id:'00000000-0000-0000-0000-000000000002'})});
  assert.equal(unauthorizedUpdates,0,'a failed ownership check must never update another employee run');
 }finally{globalThis.fetch=originalFetch;}
});

test('free research uses basic search and Gemini JSON without paid fallback or invented citations',async()=>{
 const {freeResearch,retainRetrievedSources,freeGenerate}=await import('../../netlify/functions/_shared/freeResearch.js');
 const fetchOriginal=globalThis.fetch;
 const old={GEMINI_API_KEY:process.env.GEMINI_API_KEY,TAVILY_API_KEY:process.env.TAVILY_API_KEY,GEMINI_RESEARCH_MODEL:process.env.GEMINI_RESEARCH_MODEL};
 const requests=[];
 try{
  process.env.GEMINI_API_KEY='test-gemini';process.env.TAVILY_API_KEY='test-tavily';delete process.env.GEMINI_RESEARCH_MODEL;
  globalThis.fetch=async(url,options)=>{
   const body=JSON.parse(options.body);requests.push({url,body});
   if(url==='https://api.tavily.com/search'){
    assert.equal(body.search_depth,'basic');assert.equal(body.auto_parameters,false);
    return {ok:true,json:async()=>({results:[{url:'https://example.org/blank',title:'Blank manufacturer',content:'Public manufacturer evidence'},{url:'https://127.0.0.1/private',title:'Unsafe'}]})};
   }
   assert.match(url,/gemini-3\.5-flash-lite:generateContent$/);
   assert.equal(body.tools,undefined,'Google paid grounding must never be requested');
   assert.equal(body.generationConfig.responseMimeType,'application/json');
   assert.ok(options.headers['x-goog-api-key']);assert.ok(!url.includes('test-gemini'));
   assert.match(body.contents[0].parts[0].text,/Public manufacturer evidence/);
   return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"candidates":[]}'}]}}]})};
  };
  const result=await freeResearch({prompt:'Research public wedding blanks',queries:['public wedding blanks'],schema:{type:'object'}});
  assert.equal(requests.length,2);assert.equal(result.references.length,1);
  const kept=retainRetrievedSources([{sources:[{url:'https://invented.org/item',title:'Fake'},{url:'https://example.org/blank',title:'Invented title'}]}],result.references);
  assert.equal(kept[0].sources.length,1);assert.equal(kept[0].sources[0].title,'Blank manufacturer');
  requests.length=0;
  globalThis.fetch=async(url)=>{requests.push(url);return {ok:false,status:429};};
  await assert.rejects(freeResearch({prompt:'x',queries:['x']}),/free usage limit/);
  assert.deepEqual(requests,['https://api.tavily.com/search']);
  globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]})});
  await assert.rejects(freeGenerate({prompt:'x'}),/complete answer/);
 }finally{
  globalThis.fetch=fetchOriginal;
  for(const [name,value] of Object.entries(old)){if(value===undefined)delete process.env[name];else process.env[name]=value;}
 }
});

test('free provider hourly usage guard fails closed and checks before API calls',async()=>{
 const {freeUsageGuard}=await import('../../netlify/functions/_shared/freeResearch.js');
 const db=(count,error=null)=>({from:()=>({select(){return this;},eq(){return this;},in(){return this;},gte:async()=>({count,error})})});
 await freeUsageGuard(db(20),'employee');
 await assert.rejects(freeUsageGuard(db(21),'employee'),/Hourly AI research limit/);
 await assert.rejects(freeUsageGuard(db(null,{message:'unavailable'}),'employee'),/unavailable/);
});

test('free material suggestions omit private notes and retain numeric/safety filtering',async()=>{
 const root=new URL('../../netlify/functions/_shared/',import.meta.url);
 const source=fs.readFileSync('netlify/functions/material-settings-ai.js','utf8')
  .replace(/import \{ authorizeEmployee, jsonResponse, auditFunctionSecurity \} from '.\/_shared\/security.js';/,
   `const db={from:()=>({select(){return this;},eq(){return this;},in(){return this;},gte:async()=>({count:1,error:null})})};
    const authorizeEmployee=async()=>({ok:true,user:{id:'test'},role:'admin',supabase:db});
    const jsonResponse=(statusCode,data)=>({statusCode,body:JSON.stringify(data)});const auditFunctionSecurity=async()=>{};`)
  .replace("'./_shared/aiDiagnostics.js'",JSON.stringify(new URL('aiDiagnostics.js',root).href))
  .replace("'./_shared/freeResearch.js'",JSON.stringify(new URL('freeResearch.js',root).href));
 const {handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const oldFetch=globalThis.fetch,oldProvider=process.env.SC_AI_PROVIDER,oldKey=process.env.GEMINI_API_KEY;
 let calls=0;
 try{
  process.env.SC_AI_PROVIDER='gemini_tavily';process.env.GEMINI_API_KEY='test';
  globalThis.fetch=async(url,options)=>{
   calls++;assert.match(url,/generativelanguage\.googleapis\.com/);
   assert.doesNotMatch(options.body,/PRIVATE_CUSTOMER_NOTE|private-account-reference/);
   return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'Verify exact substrate',candidate_settings:{power:'50%'},test_steps:['Test a coupon'],warnings:[],questions:[]})}]}}]})};
  };
  const payload={machine_type:'xtool_p2',operation:'engrave',machine_model:'P2',machine_configuration:'55W CO2',material_name:'cast acrylic',notes:'PRIVATE_CUSTOMER_NOTE',sources:[{label:'Private reference',url:'https://example.org/private-account-reference'}]};
  const result=await handler({httpMethod:'POST',body:JSON.stringify(payload)});
  assert.equal(result.statusCode,200);const plan=JSON.parse(result.body);
  assert.match(plan.candidate_settings.power,/verify exact numeric/);assert.equal(plan.review_required,true);
  const blocked=await handler({httpMethod:'POST',body:JSON.stringify({...payload,material_name:'PVC'})});
  assert.equal(blocked.statusCode,422);assert.equal(calls,1);
 }finally{
  globalThis.fetch=oldFetch;
  if(oldProvider===undefined)delete process.env.SC_AI_PROVIDER;else process.env.SC_AI_PROVIDER=oldProvider;
  if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
 }
});
