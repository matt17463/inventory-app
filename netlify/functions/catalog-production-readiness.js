import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { DTF_STARTER_PRESETS, classifyCatalogFamily } from '../../src/lib/catalogProductionPresets.js';

const editorRoles=new Set(['admin','manager']);
const allRoles=['admin','manager','operator','viewer','marketing'];
function clean(value){return String(value??'').trim();}
function ok(data,event){return jsonResponse(200,{success:true,data},event);}
function fail(code,message,event){return jsonResponse(code,{success:false,message},event);}
async function rows(query,label) {
 const {data,error}=await query;
 if(error)throw new Error(label+': '+error.message);
 return data||[];
}
function intId(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;}
function assertId(value){const id=intId(value);if(!id)throw new Error('Invalid WooCommerce parent product ID.');return id;}
function statusFor(assignment,versions) {
 if(assignment?.disposition==='fulfillment_only')return 'fulfillment_only';
 if(!assignment||assignment.disposition!=='assigned'||!assignment.recipe_id)return 'review';
 return versions.some(v=>v.recipe_id===assignment.recipe_id&&v.status==='approved')?'approved':'awaiting_approval';
}
async function getOverview(db){
 const [families,assignments,recipes,versions,clients,metrics]=await Promise.all([
  rows(db.from('sc_catalog_production_families_v1').select('*').order('woocommerce_product_id').limit(1000),'Catalog families'),
  rows(db.from('sc_catalog_recipe_assignments').select('woocommerce_product_id,recipe_id,disposition,notes,updated_at').limit(1500),'Recipe assignments'),
  rows(db.from('sc_manufacturing_recipes').select('id,name,garment_type,decoration_method').order('name').limit(1000),'Recipes'),
  rows(db.from('sc_manufacturing_recipe_versions').select('id,recipe_id,revision,status,artwork_asset_id,approved_at').order('revision',{ascending:false}).limit(2000),'Recipe revisions'),
  rows(db.from('sc_legacy_client_readiness_v1').select('*').order('customer_id').limit(2500),'Existing customers'),
  Promise.all([
   db.from('sc_job_travelers').select('id',{head:true,count:'exact'}),
   db.from('sc_material_recipes').select('id',{head:true,count:'exact'}).eq('status','approved')
  ]),
 ]);
 // Observed Woo-linked production history is a prioritization signal, not authoritative
 // WooCommerce sales reporting (Woo original order dates may be missing).
 const since=new Date(Date.now()-180*86400000).toISOString();
 const recentJobs=await rows(db.from('jobs')
  .select('id,woocommerce_order_id,created_at,woo_status')
  .not('woocommerce_order_id','is',null).gte('created_at',since)
  .order('created_at',{ascending:false}).limit(2500),'Recent Woo-linked jobs');
 const eligibleJobs=recentJobs.filter(j=>!['cancelled','refunded','failed'].includes(clean(j.woo_status).toLowerCase()));
 const jobById=new Map(eligibleJobs.map(j=>[String(j.id),j]));
 const activity=new Map();
 if(eligibleJobs.length){
  const ids=eligibleJobs.map(j=>j.id);
  const recentLines=await rows(db.from('job_items')
   .select('job_id,woocommerce_product_id,quantity').in('job_id',ids).limit(10000),'Recent Woo-linked lines');
  const now=Date.now();
  for(const line of recentLines){
   const id=Number(line.woocommerce_product_id),job=jobById.get(String(line.job_id));
   if(!id||!job)continue;
   const age=(now-new Date(job.created_at).getTime())/86400000;
   let item=activity.get(id);
   if(!item){item={units_30d:0,units_90d:0,units_180d:0,orders_90d:new Set(),last_activity_at:null};activity.set(id,item);}
   const qty=Math.max(0,Number(line.quantity)||0);
   if(age<=30)item.units_30d+=qty;
   if(age<=90){item.units_90d+=qty;item.orders_90d.add(String(job.woocommerce_order_id));}
   if(age<=180)item.units_180d+=qty;
   if(!item.last_activity_at||job.created_at>item.last_activity_at)item.last_activity_at=job.created_at;
  }
 }
 const observedActivity=Object.fromEntries([...activity].map(([id,v])=>[id,{
  units_30d:v.units_30d,units_90d:v.units_90d,units_180d:v.units_180d,
  recorded_orders_90d:v.orders_90d.size,last_activity_at:v.last_activity_at
 }]));
 const byId=new Map(assignments.map(x=>[Number(x.woocommerce_product_id),x]));
 const display=families.map(f=>({...f,classification:classifyCatalogFamily(f.product_name),
  readiness:statusFor(byId.get(Number(f.woocommerce_product_id)),versions)}));
 return {families:display,assignments,recipes,versions,observedActivity,
  clients:clients.filter(c=>c.source_orders||c.last_order_at),
  totals:{
   families:families.length,all_catalog_rows:families.reduce((s,f)=>s+Number(f.row_count||0),0),
   review:display.filter(x=>x.readiness==='review').length,
   awaiting_approval:display.filter(x=>x.readiness==='awaiting_approval').length,
   approved:display.filter(x=>x.readiness==='approved').length,
   fulfillment_only:display.filter(x=>x.readiness==='fulfillment_only').length,
   legacy_customers:clients.length,
   crm_unlinked:clients.filter(x=>Number(x.crm_account_count)===0&&(x.source_orders||x.last_order_at)).length,
   existing_travelers:metrics[0].count||0,approved_material_settings:metrics[1].count||0,
  }};
}
async function seedCandidates(db,userId){
 const families=await rows(db.from('sc_catalog_production_families_v1').select('woocommerce_product_id').limit(1000),'Catalog families');
 const existing=await rows(db.from('sc_catalog_recipe_assignments').select('woocommerce_product_id').limit(1500),'Existing assignments');
 const found=new Set(existing.map(x=>Number(x.woocommerce_product_id)));
 const pending=families.filter(x=>!found.has(Number(x.woocommerce_product_id)));
 if(pending.length){
  const created=await rows(db.from('sc_catalog_recipe_assignments').upsert(
   pending.map(x=>({woocommerce_product_id:x.woocommerce_product_id,created_by:userId,disposition:'review'})),
   {onConflict:'woocommerce_product_id',ignoreDuplicates:true}).select('woocommerce_product_id'),'Seed assignments');
  return {created:created.length,existing:existing.length};
 }
 return {created:0,existing:existing.length};
}
async function seedDrafts(db,userId){
 const existing=await rows(db.from('sc_manufacturing_recipes').select('id,name').limit(2000),'Existing recipes');
 const byName=new Map(existing.map(x=>[x.name,x.id]));
 let created=0;let reused=0;
 for(const preset of DTF_STARTER_PRESETS){
  if(byName.has(preset.name)){reused++;continue;}
  const [recipe]=await rows(db.from('sc_manufacturing_recipes').insert({
    name:preset.name,garment_type:preset.garment_type,decoration_method:'DTF',
    notes:'Catalog readiness starter; unverified measurements and pressing instructions.',created_by:userId
  }).select('id'),'Create starter recipe');
  try{
   await rows(db.from('sc_manufacturing_recipe_versions').insert({
    recipe_id:recipe.id,revision:1,placements:preset.placements,
    process_steps:preset.process_steps,packaging:preset.packaging,
    production_notes:preset.production_notes,verified_sample:false,status:'draft',created_by:userId
   }).select('id'),'Create starter revision');
  }catch(error){
   // Keep error visible; never report a partially created starter as complete.
   throw new Error('Starter recipe '+preset.name+' was created but its draft revision failed: '+error.message);
  }
  byName.set(preset.name,recipe.id);created++;
 }
 return {created,reused,notice:'All new versions are drafts. Physical sample verification and manager approval are required.'};
}
async function saveAssignment(db,input,userId){
 const parent=assertId(input.woocommerce_product_id);
 const family=await rows(db.from('sc_catalog_production_families_v1').select('woocommerce_product_id').eq('woocommerce_product_id',parent).limit(1),'Catalog parent');
 if(!family.length)throw new Error('This parent product does not exist in the synchronized catalog.');
 const disposition=clean(input.disposition);
 if(!['review','assigned','fulfillment_only'].includes(disposition))throw new Error('Unsupported disposition.');
 const recipeId=disposition==='assigned'?clean(input.recipe_id):null;
 if(disposition==='assigned'){
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(recipeId))throw new Error('Select an existing recipe.');
  const recipe=await rows(db.from('sc_manufacturing_recipes').select('id').eq('id',recipeId).limit(1),'Recipe');
  if(!recipe.length)throw new Error('Chosen recipe does not exist.');
 }
 const {data:prior,error:pe}=await db.from('sc_catalog_recipe_assignments').select('id,created_by').eq('woocommerce_product_id',parent).maybeSingle();
 if(pe)throw pe;
 const payload={woocommerce_product_id:parent,recipe_id:recipeId,disposition,
  notes:clean(input.notes).slice(0,1200),updated_at:new Date().toISOString(),updated_by:userId};
 const query=prior?db.from('sc_catalog_recipe_assignments').update(payload).eq('id',prior.id):
  db.from('sc_catalog_recipe_assignments').insert({...payload,created_by:userId});
 await rows(query.select('id'),'Save assignment');
 return {woocommerce_product_id:parent,disposition};
}
async function openJobs(db){
 const jobs=await rows(db.from('jobs').select('id,status,customer_name,job_name,due_date')
   .not('status','in','(completed,voided,cancelled,canceled)').order('id',{ascending:false}).limit(300),'Open jobs');
 if(!jobs.length)return [];
 const jobIds=jobs.map(x=>x.id);
 const [items,existing,links,assignments,versions]=await Promise.all([
  rows(db.from('job_items').select('id,job_id,quantity,status,woocommerce_product_id,woocommerce_variation_id,order_sku,ordered_product_name,finished_product_id')
   .in('job_id',jobIds).limit(2000),'Open job lines'),
  rows(db.from('sc_job_travelers').select('job_item_id,job_id,id').in('job_id',jobIds).limit(2000),'Existing job travelers'),
  rows(db.from('sc_job_artwork_links').select('job_id,handoff_id').in('job_id',jobIds).limit(2000),'Approved-artwork links'),
  rows(db.from('sc_catalog_recipe_assignments').select('woocommerce_product_id,recipe_id,disposition').eq('disposition','assigned').limit(1500),'Recipe assignments'),
  rows(db.from('sc_manufacturing_recipe_versions').select('id,recipe_id,revision,status,artwork_asset_id').eq('status','approved').order('revision',{ascending:false}).limit(1500),'Approved recipes')
 ]);
 const vars=[...new Set(items.map(i=>i.woocommerce_variation_id).filter(Boolean))];
 const resolved=vars.length?await rows(db.from('products').select('woocommerce_product_id,woocommerce_variation_id')
   .in('woocommerce_variation_id',vars).limit(1500),'Woo variation parents'):[];
 const parentByVariation=new Map(resolved.map(x=>[Number(x.woocommerce_variation_id),Number(x.woocommerce_product_id)]));

 // Live, fail-closed evidence is recalculated on BOTH preview and traveler creation.
 // This is intentionally not a cached "certified" flag: artwork changes, review
 // withdrawals and altered recipe versions revoke eligibility on the next request.
 const parents=[...new Set(items.map(i=>Number(i.woocommerce_product_id||parentByVariation.get(Number(i.woocommerce_variation_id))||0)).filter(Boolean))];
 const [productVariants,artworkLinks,mockupProjects]=await Promise.all([
  parents.length?rows(db.from('products').select('woocommerce_product_id,woocommerce_variation_id,blank_product_id').in('woocommerce_product_id',parents).limit(10000),'Product variation mappings'):[],
  parents.length?rows(db.from('sc_catalog_artwork_links').select('woocommerce_product_id,artwork_asset_id,review_required,approval_evidence,reviewed_at,updated_at').in('woocommerce_product_id',parents).limit(3000),'Catalog approved artwork'):[],
  parents.length?rows(db.from('mockup_projects').select('id,woo_product_id').in('woo_product_id',parents).limit(3000),'Explicit Woo mockup projects'):[]
 ]);
 const variantsByParent=new Map();
 for(const v of productVariants){
  const key=Number(v.woocommerce_product_id);
  if(!variantsByParent.has(key))variantsByParent.set(key,[]);
  variantsByParent.get(key).push(v);
 }
 const artworkByParent=new Map(artworkLinks.map(x=>[Number(x.woocommerce_product_id),x]));
 const projectIds=mockupProjects.map(x=>x.id);
 const [outputs,reviews,placements,artAssets]=await Promise.all([
  projectIds.length?rows(db.from('mockup_outputs').select('id,project_id,placement_id,is_selected,approval_status,approved_at,updated_at').in('project_id',projectIds).limit(5000),'Mockup outputs'):[],
  projectIds.length?rows(db.from('mockup_reviews').select('output_id,project_id,decision,created_at').in('project_id',projectIds).order('created_at',{ascending:false}).limit(5000),'Customer reviews'):[],
  projectIds.length?rows(db.from('mockup_placements').select('id,project_id,artwork_asset_id,updated_at').in('project_id',projectIds).limit(5000),'Mockup placements'):[],
  projectIds.length?rows(db.from('mockup_artwork_assets').select('id,project_id,updated_at').in('project_id',projectIds).limit(5000),'Mockup artwork revisions'):[]
 ]);
 const placementsById=new Map(placements.map(x=>[String(x.id),x]));
 const assetById=new Map(artAssets.map(x=>[String(x.id),x]));
 const reviewsByOutput=new Map();
 for(const r of reviews)if(!reviewsByOutput.has(String(r.output_id)))reviewsByOutput.set(String(r.output_id),r);
 const projectsByParent=new Map();
 for(const project of mockupProjects){
  const id=Number(project.woo_product_id);
  if(!projectsByParent.has(id))projectsByParent.set(id,new Set());
  projectsByParent.get(id).add(String(project.id));
 }
 const outputByParent=new Map();
 for(const [parent,ids] of projectsByParent){
  outputByParent.set(parent,outputs.filter(o=>ids.has(String(o.project_id))));
 }
 const latestTime=(...values)=>Math.max(0,...values.map(v=>v?Date.parse(v)||0:0));
 const evidenceFor=(parent,item,version)=>{
  const variants=variantsByParent.get(parent)||[];
  const varId=Number(item.woocommerce_variation_id||0);
  const target=varId?variants.filter(x=>Number(x.woocommerce_variation_id)===varId):variants;
  if(!target.length)return 'Woo product variation not synchronized';
  if(target.some(v=>!v.blank_product_id))return 'Required blank mapping missing for this variation';
  const link=artworkByParent.get(parent);
  if(!link?.artwork_asset_id||link.review_required||!link.reviewed_at||!clean(link.approval_evidence))
   return 'Product artwork approval missing or revoked';
  if(String(version?.artwork_asset_id)!==String(link.artwork_asset_id))
   return 'Approved recipe artwork differs from product artwork';
  const candidates=outputByParent.get(parent)||[];
  for(const output of candidates){
   if(!output.is_selected||output.approval_status!=='internal_approved'||!output.approved_at)continue;
   const placement=placementsById.get(String(output.placement_id));
   if(!placement||String(placement.artwork_asset_id)!==String(link.artwork_asset_id))continue;
   const review=reviewsByOutput.get(String(output.id));
   if(!review||!['approved','approve','accepted'].includes(clean(review.decision).toLowerCase()))continue;
   const modified=latestTime(link.updated_at,placement.updated_at,assetById.get(String(placement.artwork_asset_id))?.updated_at,output.updated_at);
   if(latestTime(review.created_at)<modified||latestTime(output.approved_at)<modified)continue;
   return null;
  }
  return 'Exact mockup/customer approval missing or stale after production changes';
 };
 const byAssignment=new Map(assignments.map(x=>[Number(x.woocommerce_product_id),x]));
 const recipeById=new Map();for(const v of versions)if(!recipeById.has(v.recipe_id))recipeById.set(v.recipe_id,v);
 const done=new Set(existing.map(x=>Number(x.job_item_id)));
 const artworkJobs=new Set(links.map(x=>Number(x.job_id)));
 const jobsById=new Map(jobs.map(x=>[Number(x.id),x]));
 return items.filter(i=>!['cancelled','canceled','voided','removed'].includes(clean(i.status).toLowerCase())).map(item=>{
  const parent=Number(item.woocommerce_product_id||parentByVariation.get(Number(item.woocommerce_variation_id))||0);
  const assignment=byAssignment.get(parent);
  const version=recipeById.get(assignment?.recipe_id);
  let reason='Needs product assignment';
  if(done.has(Number(item.id)))reason='Traveler already exists';
  else if(!parent)reason='Missing Woo parent mapping — manual review';
  else if(!assignment)reason='No approved product recipe assignment';
  else if(!version)reason='Recipe awaiting sample verification and approval';
  else if(!version.artwork_asset_id)reason='Approved recipe missing exact production artwork';
  else if(!artworkJobs.has(Number(item.job_id)))reason='No artwork handoff linked to this job';
  else reason=evidenceFor(parent,item,version)||'Eligible for controlled traveler generation';
  return {
   job_id:item.job_id,job_item_id:item.id,customer_name:jobsById.get(Number(item.job_id))?.customer_name||'',
   job_name:jobsById.get(Number(item.job_id))?.job_name||'',name:item.ordered_product_name||item.order_sku||'Job line',
   quantity:item.quantity,woocommerce_product_id:parent,recipe_version_id:version?.id||null,
   status:reason,eligible:reason==='Eligible for controlled traveler generation',
  };
 });
}
async function createApprovedTravelers(db,input,userId){
 if(input.confirm_artwork_verified!==true)throw new Error('Review and explicitly confirm the artwork/production checklist first.');
 const current=await openJobs(db);
 const selected=new Set((Array.isArray(input.job_item_ids)?input.job_item_ids:[]).map(Number));
 const ready=current.filter(x=>x.eligible&&selected.has(Number(x.job_item_id)));
 if(selected.size>50)throw new Error('Create no more than 50 travelers per batch.');
 if(!ready.length)return {created:0,skipped:selected.size,reason:'No selected job lines remain eligible; refresh the preview.'};
 let created=0,conflicts=0;const errors=[];
 for(const row of ready){
  try{
   const {data,error}=await db.from('sc_job_travelers').insert({
    job_id:row.job_id,job_item_id:row.job_item_id,recipe_version_id:row.recipe_version_id,created_by:userId,
   }).select('id');
   if(error?.code==='23505'){conflicts++;continue;}
   if(error)throw error;
   created+=(data||[]).length;
  }catch(e){errors.push({job_item_id:row.job_item_id,message:e.message});}
 }
 return {created,conflicts,skipped:selected.size-ready.length,errors,
  notice:'No inventory, invoice, order or production status was modified.'};
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return fail(405,'Method not allowed.',event);
 const auth=await authorizeEmployee(event,{functionName:'catalog-production-readiness',allowedRoles:allRoles});
 if(!auth.ok)return fail(auth.statusCode,auth.message,event);
 let input;try{input=JSON.parse(event.body||'{}');}catch{return fail(400,'Invalid JSON body.',event);}
 const action=clean(input.action);
 if(action!=='overview'&&action!=='preview_open'&&!editorRoles.has(auth.role))return fail(403,'Manager access required.',event);
 try{
  let data;
  switch(action){
   case 'overview':data=await getOverview(auth.supabase);break;
   case 'seed_candidates':data=await seedCandidates(auth.supabase,auth.user.id);break;
   case 'seed_drafts':data=await seedDrafts(auth.supabase,auth.user.id);break;
   case 'assign':data=await saveAssignment(auth.supabase,input,auth.user.id);break;
   case 'preview_open':data=await openJobs(auth.supabase);break;
   case 'create_open':data=await createApprovedTravelers(auth.supabase,input,auth.user.id);break;
   default:return fail(400,'Unsupported action.',event);
  }
  return ok(data,event);
 }catch(error){console.error('Catalog readiness failed:',action,error.message);return fail(500,error.message||'Catalog readiness unavailable.',event);}
}
