// Netlify Background Function: on-demand AI product discovery, no live orders or product publishing.
// Netlify acknowledges 202 immediately; progress/results live in sc_pdc_discovery_runs.
import {authorizeEmployee,auditFunctionSecurity} from './_shared/security.js';
import {candidateScore,normalizeLeadKey,sanitizeDiscoveryLead,discoveryScore} from '../../src/lib/productDiscoveryScoring.js';

const handlerName='product-discovery-run-background';
const text=(value,n=1000)=>String(value??'').slice(0,n);
const responseSchema={
 type:'object',additionalProperties:false,required:['candidates'],
 properties:{candidates:{type:'array',items:{
  type:'object',additionalProperties:false,
  required:['name','category','audience','description','equipment','keywords',
    'differentiation','demand_indicator','supplier_notes','risks','sources'],
  properties:{
   name:{type:'string'},category:{type:'string'},audience:{type:'string'},description:{type:'string'},
   equipment:{type:'array',items:{type:'string'}},keywords:{type:'array',items:{type:'string'}},
   differentiation:{type:'integer'},demand_indicator:{type:'integer'},
   supplier_notes:{type:'string'},risks:{type:'string'},
   sources:{type:'array',items:{type:'object',additionalProperties:false,
    required:['url','title','source_type','summary'],
    properties:{url:{type:'string'},title:{type:'string'},source_type:{type:'string'},summary:{type:'string'}}
   }}
  }}}}
};
async function loadSignals(db){
 // Minimum-necessary aggregate CRM insight. Contact names, customer identities, emails and pricing
 // do not leave the app. Supplier catalog costs stay server-side for matching only.
 const queries=[
  db.from('sc_growth_accounts').select('segment').is('archived_at',null).limit(500),
  db.from('sc_growth_opportunities').select('title,stage,brief').is('archived_at',null).limit(300),
  db.from('supplier_catalog_items').select('supplier_id,brand,style,description,supplier_sku,unit_cost').eq('is_archived',false).limit(600),
  db.from('suppliers').select('id,name').limit(100),
  db.from('sc_material_recipes').select('machine_type,status').eq('status','approved').limit(300),
  db.from('sc_pdc_opportunities').select('name').limit(1500)
 ];
 const results=await Promise.all(queries);
 const [accounts,opps,items,suppliers,recipes,existing]=results.map(r=>r.error?[]:r.data||[]);
 const counts=new Map();
 for(const a of accounts){const key=text(a.segment||'unknown',100);counts.set(key,(counts.get(key)||0)+1);}
 const crmSegments=[...counts].map(([segment,count])=>({segment,count})).sort((a,b)=>b.count-a.count);
 const names=new Map(suppliers.map(x=>[x.id,x.name]));
 const supplierItems=items.map(i=>({supplier:names.get(i.supplier_id)||'Unidentified supplier',
  brand:i.brand,style:i.style,description:i.description,supplier_sku:i.supplier_sku,unit_cost:i.unit_cost}));
 const activeOpportunities=opps.map(o=>({category:text(o.title,120),stage:text(o.stage,30)}));
 return {crmSegments,supplierItems,activeOpportunities,approvedRecipeTypes:recipes.map(x=>x.machine_type),
  existingKeys:new Set(existing.map(x=>normalizeLeadKey(x.name)))};
}
function parseCandidates(data){
 const blocks=(Array.isArray(data.output)?data.output:[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
 const raw=String(data.output_text||blocks.map(x=>x.text||'').join('\n')).trim();
 if(!raw)throw Error('AI returned no readable discovery results.');
 let parsed;
 try{parsed=JSON.parse(raw);}catch{
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start<0||end<=start)throw Error('AI discovery returned an invalid response format.');
  parsed=JSON.parse(raw.slice(start,end+1));
 }
 if(!Array.isArray(parsed.candidates))throw Error('AI returned no candidate list.');
 return parsed.candidates;
}
async function discover({focus,count,signals}){
 if(!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY is not configured on Netlify; connect a server-side key to enable live discovery.');
 const scopes={all:'sports recognition, weddings, events, business branding and gift products',
  weddings:'wedding signage, guest keepsakes and venue personalization',
  coaches:'coach appreciation, sports awards and team packages',
  business:'small-business branding and employee recognition',
  gifts:'personalized gifts and occasion packages'};
 const instructions=[
  'You are the product research analyst for Skilled Crafting, a small US maker with xTool S1, xTool P2,',
  'xTool Omni Dual UV, Roland BN2-30, OMTech 60W MOPA laser and Sawgrass SG500.',
  'Research commercially plausible new physical products for the target: '+scopes[focus]+'.',
  'Return exactly '+count+' distinct, practical product opportunities, with 2–4 independently traceable HTTPS webpages per candidate.',
  'Use web_search to identify genuine manufacturer/supplier pages and public marketplace/community evidence.',
  'Provide real URLs, descriptive titles and concise source-specific summaries. NEVER invent URLs, market volume, sales,',
  'wholesale prices, durability promises, testimonials or tested printer/laser settings.',
  'Include the exact machine ids ONLY from: xtool_s1,xtool_p2,xtool_omni,roland_bn2,mopa_fiber,sawgrass_sg500,heat_press,sublimation_press.',
  'Categories MUST be one of: Weddings & Events, Sports & Coaches, Business Branding, Personalized Gifts, Other.',
  'Supply a tentative 0–100 relative demand_indicator and differentiation, not a guaranteed forecast.',
  'Ideas must be unique and distinguishable; provide safe material caveats for food contact, UV adhesion,',
  'laser processing of unknown plastics/PVC, engraving coatings and rotary glassware.',
  'Be realistic about small-batch unit production and personalization, with an attainable supplier route.',
  'Current internal CRM has '+JSON.stringify(signals.crmSegments.slice(0,12))+' customer segments (counts only).',
  'Current open CRM pipeline categories: '+JSON.stringify(signals.activeOpportunities.slice(0,20))+'.',
  'Imported local supplier catalog contains '+signals.supplierItems.length+' items. '+
    (signals.supplierItems.length===0?'DO NOT CLAIM confirmed in-account supplier pricing or availability.':'Do not quote any confidential account unit cost.'),
  'Known approved material recipe machine types: '+JSON.stringify([...new Set(signals.approvedRecipeTypes)])+'.',
  'No existing products or customers are being automatically sold to; this is a prospective research shortlist.'
 ].join('\n');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),150000);
 try{
  const api=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,
   headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_PRODUCT_RESEARCH_MODEL||'gpt-4.1',
     tools:[{type:'web_search',search_context_size:'high'}],tool_choice:'required',
     input:instructions,text:{format:{type:'json_schema',name:'sc_product_discovery',strict:true,schema:responseSchema}},
     max_output_tokens:9500})
  });
  if(!api.ok)throw Error('AI discovery request failed (HTTP '+api.status+'). Check server-side model and web-search access.');
  return parseCandidates(await api.json());
 }finally{clearTimeout(timeout);}
}
async function update(db,runId,fields){
 const r=await db.from('sc_pdc_discovery_runs').update(fields).eq('id',runId);
 if(r.error)throw Error('Discovery status update failed: '+r.error.message);
}
export async function handler(event){
 if(event.httpMethod!=='POST')return {statusCode:405};
 const auth=await authorizeEmployee(event,{functionName:handlerName,allowedRoles:['admin','manager','marketing']});
 if(!auth.ok)return {statusCode:auth.statusCode};
 const db=auth.supabase;
 let id,acquired=false,saved=0,skipped=0,found=0;
 try{
  const body=JSON.parse(event.body||'{}');id=String(body.run_id||'');
  if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Valid discovery run ID required.');
  const read=await db.from('sc_pdc_discovery_runs').select('*').eq('id',id).eq('created_by',auth.user.id).single();
  if(read.error||!read.data)throw Error('Discovery run not found for your user.');
  const run=read.data;
  if(run.status!=='queued')return {statusCode:200};
  const recent=await db.from('sc_pdc_discovery_runs').select('id')
   .eq('created_by',auth.user.id).gte('requested_at',new Date(Date.now()-86400000).toISOString()).limit(6);
  if(recent.error||recent.data.length>4)throw Error('Daily research limit reached (four runs per user).');
  const active=await db.from('sc_pdc_discovery_runs').select('id').eq('status','running').limit(3);
  if(active.error||active.data.length>=2)throw Error('Two discovery runs are already active; retry later.');
  const lock=await db.from('sc_pdc_discovery_runs').update({status:'running',started_at:new Date().toISOString(),
    message:'Researching public sources and matching internal CRM/supplier signals…'}).eq('id',id).eq('status','queued').select('id').maybeSingle();
  if(lock.error||!lock.data)return {statusCode:200};
  acquired=true;
  const signals=await loadSignals(db);
  await update(db,id,{crm_signals:{segments:signals.crmSegments,opportunities_considered:signals.activeOpportunities.length},
   supplier_signals:{imported_rows:signals.supplierItems.length,approved_recipe_machine_types:[...new Set(signals.approvedRecipeTypes)]}});
  const raw=await discover({focus:run.focus,count:run.requested_count,signals});
  found=raw.length;
  const seen=new Set(signals.existingKeys);
  for(const candidate of raw.slice(0,run.requested_count)){
   const lead=sanitizeDiscoveryLead(candidate);
   if(!lead)continue;
   const key=normalizeLeadKey(lead.name);
   if(seen.has(key)){skipped++;continue;}
   seen.add(key);
   const score=candidateScore(lead,signals);
   const assessment={...score.evidence_notes,confidence:score.evidence_level,
     source_count:lead.sources.length,source_urls:lead.sources.map(x=>x.url),
     risks:lead.risks,supplier_notes:lead.supplier_notes,keywords:lead.keywords,
     score_origin:'Automated provisional estimate; owner review required',
     estimated_score:discoveryScore(score),
     researched_at:new Date().toISOString()};
   const result=await db.from('sc_pdc_opportunities').insert({
     name:lead.name,category:lead.category,audience:lead.audience,description:lead.description,
     equipment:lead.equipment,status:'idea',created_by:auth.user.id,
     discovery_run_id:id,discovery_evidence:assessment,
     customer_fit:score.customer_fit,demand_score:score.demand_score,
     production_fit:score.production_fit,differentiation_score:score.differentiation_score,
     notes:'AI-discovered candidate. Provisional scores; validate customer demand, pricing, supplier compatibility and exact physical recipe.'
   }).select('id').single();
   if(result.error){console.warn('AI discovery candidate insert failed',result.error.message);continue;}
   saved++;
   const refs=lead.sources.map(s=>({opportunity_id:result.data.id,title:s.title,source_url:s.url,
     source_type:s.source_type,summary:s.summary,verified:false,recorded_by:auth.user.id}));
   const savedRefs=await db.from('sc_pdc_sources').insert(refs);
   if(savedRefs.error)console.warn('Discovery reference insert issue',savedRefs.error.message);
  }
  if(!saved)throw Error('No new source-linked candidates were saved. Results were missing evidence or duplicated the existing catalog.');
  await update(db,id,{status:'completed',finished_at:new Date().toISOString(),total_found:found,
   saved_count:saved,duplicate_count:skipped,
   message:'Saved '+saved+' provisional opportunities with sources. Review scores, suppliers and samples before production.'});
  await auditFunctionSecurity({functionName:handlerName,action:'discover',outcome:'success',
   userId:auth.user.id,role:auth.role,event,metadata:{run_id:id,found,saved,skipped}});
 }catch(error){
  console.error('Product discovery failed',error?.message||error);
  if(id&&/^[a-f0-9-]{36}$/i.test(id)){
   await update(db,id,{status:saved?'partial':'failed',finished_at:new Date().toISOString(),
     total_found:found,saved_count:saved,duplicate_count:skipped,
     message:text(error?.message||'Discovery could not finish',700)}).catch(()=>{});
  }
  await auditFunctionSecurity({functionName:handlerName,action:'discover',outcome:'failed',
   userId:auth.user.id,role:auth.role,event,metadata:{run_id:id||null,saved}});
 }
 return {statusCode:200};
}
