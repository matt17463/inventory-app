import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {EXPANDED_STARTER_PRESETS} from '../../src/lib/expandedProductionPresets.js';
const allRoles=['admin','manager','marketing','operator','viewer'];
const editRoles=new Set(['admin','manager']);
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ');
const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const result=(event,data)=>jsonResponse(200,{success:true,data},event);
const reject=(event,status,message)=>jsonResponse(status,{success:false,message},event);
async function read(query,label){const {data,error}=await query;if(error)throw Error(label+': '+error.message);return data||[];}
async function one(query,label){const {data,error}=await query;if(error)throw Error(label+': '+error.message);return data;}
function ensure(v,why){if(!v)throw Error(why);return v;}
async function parentExists(db,parent){
 const n=ensure(id(parent),'Provide a valid WooCommerce parent product ID.');
 const found=await read(db.from('sc_catalog_production_families_v1').select('woocommerce_product_id').eq('woocommerce_product_id',n).limit(1),'Product lookup');
 ensure(found.length,'WooCommerce parent is absent from the synced catalog.');return n;
}
async function dashboard(db){
 const [families,assignments,versions,artwork,features,assets,clientCounts]=await Promise.all([
  read(db.from('sc_catalog_production_families_v1').select('*').limit(1000),'Catalog'),
  read(db.from('sc_catalog_recipe_assignments').select('woocommerce_product_id,recipe_id,disposition').limit(1500),'Recipe assignments'),
  read(db.from('sc_manufacturing_recipe_versions').select('id,recipe_id,status,machine_settings_id,artwork_asset_id').limit(2500),'Recipe revisions'),
  read(db.from('sc_catalog_artwork_links').select('*').limit(1200),'Artwork inheritance'),
  read(db.from('sc_catalog_feature_reviews').select('*').limit(1200),'Readiness signoffs'),
  read(db.from('mockup_artwork_assets').select('id,artwork_name,preflight_status,exact_artwork_locked,updated_at')
   .eq('preflight_status','passed').eq('exact_artwork_locked',true).order('updated_at',{ascending:false}).limit(200),'Print-ready artwork'),
  Promise.all([db.from('customers').select('id',{head:true,count:'exact'}),
   db.from('sc_growth_accounts').select('id',{head:true,count:'exact'}).is('archived_at',null)])
 ]);
 const a=new Map(assignments.map(x=>[Number(x.woocommerce_product_id),x]));
 const art=new Map(artwork.map(x=>[Number(x.woocommerce_product_id),x]));
 const f=new Map(features.map(x=>[Number(x.woocommerce_product_id),x]));
 const scores=families.map(row=>{
  const key=Number(row.woocommerce_product_id), assignment=a.get(key),link=art.get(key),review=f.get(key);
  const approved=versions.filter(v=>v.recipe_id===assignment?.recipe_id&&v.status==='approved');
  const recipe=assignment?.disposition==='fulfillment_only'||approved.length>0;
  const settings=assignment?.disposition==='fulfillment_only'||approved.some(v=>Boolean(v.machine_settings_id));
  const flags={
   blank: Number(row.missing_blank_rows||0)===0,
   recipe,
   artwork:assignment?.disposition==='fulfillment_only'||Boolean(link&&!link.review_required),
   pricing:review?.pricing_status==='verified',
   mockup:review?.mockup_status==='verified',
   supplier:review?.supplier_status==='verified',
   machine:settings
  };
  const score=Math.round(Object.values(flags).filter(Boolean).length/7*100);
  return {...row,score,flags,review:review||null,
   artwork:link||null,recipe_id:assignment?.recipe_id||null,
   disposition:assignment?.disposition||'review'};
 });
 return {scores,artwork_links:artwork,assets,features,
  totals:{products:scores.length,customers:clientCounts[0].count||0,crm_accounts:clientCounts[1].count||0,
   artwork_review:artwork.filter(x=>x.review_required).length,
   readiness_100:scores.filter(x=>x.score===100).length}};
}
async function candidates(db){
 const [clients,accounts,contacts]=await Promise.all([
  read(db.from('customers').select('id,name,billing_company,email,phone,last_order_at,source_orders').order('id').limit(2500),'Legacy customers'),
  read(db.from('sc_growth_accounts').select('id,organization,customer_id,archived_at').is('archived_at',null).limit(2000),'CRM accounts'),
  read(db.from('sc_growth_contacts').select('account_id,email,archived_at').is('archived_at',null).limit(2500),'CRM contacts')]);
 const mails=new Map();for(const p of contacts){const email=clean(p.email).toLowerCase();if(!email)continue;
  if(!mails.has(email))mails.set(email,new Set());mails.get(email).add(p.account_id);}
 const rows=clients.map(c=>{
  const customerId=Number(c.id), company=norm(c.billing_company||c.name);
  const linked=accounts.find(a=>Number(a.customer_id)===customerId);
  const nameMatches=company?accounts.filter(a=>norm(a.organization)===company):[];
  const mailMatches=mails.get(clean(c.email).toLowerCase())||new Set();
  const plausible=accounts.filter(a=>nameMatches.some(n=>n.id===a.id)||mailMatches.has(a.id)).map(a=>({
   id:a.id,organization:a.organization,customer_id:a.customer_id,
   signals:[nameMatches.some(n=>n.id===a.id)?'Same organization name':null,mailMatches.has(a.id)?'Shared contact email':null].filter(Boolean)
  }));
  return {customer_id:c.id,name:c.name,billing_company:c.billing_company||'',email_present:!!clean(c.email),
   last_order_at:c.last_order_at,source_orders:c.source_orders,linked_account_id:linked?.id||null,
   candidates:plausible,ambiguous:plausible.filter(x=>x.id!==linked?.id).length>1};
 });
 return {rows,summary:{total:clients.length,linked:rows.filter(c=>c.linked_account_id).length,
  ambiguous:rows.filter(c=>c.ambiguous).length,unlinked:rows.filter(c=>!c.linked_account_id).length},
  accounts:accounts.map(a=>({id:a.id,organization:a.organization,customer_id:a.customer_id}))};
}
async function linkCustomer(db,input,userId,create){
 const customerId=ensure(id(input.customer_id),'Select an existing customer.');
 const evidence=clean(input.evidence);
 ensure(input.confirm===true&&evidence.length>=12,'Confirm the legal customer identity and provide at least 12 characters of review evidence.');
 const customer=await one(db.from('customers').select('id,name,billing_company,email').eq('id',customerId).single(),'Customer');
 const already=await read(db.from('sc_growth_accounts').select('id,organization').eq('customer_id',customerId).is('archived_at',null).limit(3),'Existing CRM link');
 ensure(!already.length,'Customer is already linked to an active CRM account.');
 let targetId;
 if(create){
  const company=clean(customer.billing_company||customer.name);
  ensure(company.length>=2,'Legacy customer needs a recognizable organization name before creation.');
  const suggestions=await candidates(db);
  const candidate=suggestions.rows.find(row=>Number(row.customer_id)===customerId);
  ensure(!candidate?.candidates?.length,'Possible matching CRM accounts exist (name/contact email); review them and link instead of creating a duplicate.');
  const similar=await read(db.from('sc_growth_accounts').select('id,organization').ilike('organization',company)
   .is('archived_at',null).limit(5),'Existing organizations');
  ensure(!similar.length,'A CRM account already has that name. Review duplicate candidates and link the existing account instead.');
  const created=await one(db.from('sc_growth_accounts').insert({
   organization:company,segment:'other',source:'woocommerce_legacy_review',created_by:userId,
   customer_id:customerId,notes:'Linked from existing WooCommerce customer record after human review.'
  }).select('id').single(),'Create CRM account');
  targetId=created.id;
 }else{
  targetId=ensure(clean(input.account_id),'Select a target CRM account.');
  const existing=await one(db.from('sc_growth_accounts')
   .select('id,organization,customer_id,archived_at').eq('id',targetId).single(),'CRM account');
  ensure(!existing.archived_at,'Archived CRM accounts are not eligible.');
  ensure(existing.customer_id==null,'CRM account already belongs to a different customer.');
  const changed=await read(db.from('sc_growth_accounts').update({customer_id:customerId})
   .eq('id',targetId).is('customer_id',null).select('id'),'Link customer');
  ensure(changed.length===1,'CRM account was linked concurrently; refresh and retry.');
 }
 await read(db.from('sc_legacy_client_migration_events').insert({
  customer_id:customerId,account_id:targetId,action:create?'create_and_link':'link_existing',
  evidence,actor_id:userId}).select('id'),'Client migration audit');
 return {customer_id:customerId,account_id:targetId,action:create?'created':'linked',
  note:'Original Woo customer, orders, contact preferences and historical accounting unchanged.'};
}
async function linkArtwork(db,input,userId){
 const parent=await parentExists(db,input.woocommerce_product_id);
 const assetId=ensure(clean(input.artwork_asset_id),'Choose an artwork asset.');
 const [asset]=await read(db.from('mockup_artwork_assets')
  .select('id,artwork_name,preflight_status,exact_artwork_locked').eq('id',assetId).limit(1),'Artwork asset');
 ensure(asset,'Artwork asset not found.');
 ensure(asset.preflight_status==='passed'&&asset.exact_artwork_locked===true,
   'Artwork must have passed technical preflight and have its exact file locked. Client approval must still be reviewed.');
 const proof=clean(input.approval_evidence);
 ensure(input.confirm===true&&proof.length>=12,'Confirm actual client artwork approval with at least 12 characters of evidence.');
 const previous=await one(db.from('sc_catalog_artwork_links').select('artwork_asset_id')
   .eq('woocommerce_product_id',parent).maybeSingle(),'Current link');
 const payload={woocommerce_product_id:parent,artwork_asset_id:assetId,
  approval_evidence:proof,review_required:false,review_reason:'',
  reviewed_by:userId,reviewed_at:new Date().toISOString(),
  linked_by:userId,updated_at:new Date().toISOString()};
 await read(db.from('sc_catalog_artwork_links').upsert(payload,{onConflict:'woocommerce_product_id'}).select('woocommerce_product_id'),'Save artwork inheritance');
 await read(db.from('sc_catalog_artwork_link_events').insert({
  woocommerce_product_id:parent,artwork_asset_id:assetId,
  action:previous?.artwork_asset_id&&previous.artwork_asset_id!==assetId?'replace_link':'approve_link',
  details:proof.slice(0,350),actor_id:userId}).select('id'),'Artwork audit');
 return {woocommerce_product_id:parent,artwork_asset_id:assetId,updated:!!previous};
}
async function flagArtwork(db,input,userId){
 const assetId=ensure(clean(input.artwork_asset_id),'Select the original artwork asset.');
 const links=await read(db.from('sc_catalog_artwork_links').select('woocommerce_product_id')
   .eq('artwork_asset_id',assetId).limit(500),'Linked families');
 if(!links.length)return {flagged:0};
 const changed=await read(db.from('sc_catalog_artwork_links').update({
   review_required:true,review_reason:'New artwork revision reported; reconfirm customer proof and exact production file',
   reviewed_by:null,reviewed_at:null,updated_at:new Date().toISOString()
  }).eq('artwork_asset_id',assetId).select('woocommerce_product_id'),'Flag inherited revisions');
 for(const link of changed){
  await read(db.from('sc_catalog_artwork_link_events').insert({
   woocommerce_product_id:link.woocommerce_product_id,artwork_asset_id:assetId,
   action:'revision_flag',details:clean(input.notes).slice(0,500)||'Artwork revision flagged for review',actor_id:userId
  }).select('id'),'Revision audit');
 }
 return {flagged:changed.length,linked:links.length};
}
async function saveChecklist(db,input,userId){
 const parent=await parentExists(db,input.woocommerce_product_id);
 const statuses=['unreviewed','verified','needs_review'];
 for(const key of ['pricing_status','mockup_status','supplier_status'])ensure(statuses.includes(input[key]),'Invalid '+key);
 ensure(input.confirm===true,'Confirm evidence for each verified feature.');
 const notes=clean(input.review_notes);
 if(['pricing_status','mockup_status','supplier_status'].some(x=>input[x]==='verified'))
  ensure(notes.length>=12,'Explain which real pricing, mockup and supplier records were checked (12+ characters).');
 await read(db.from('sc_catalog_feature_reviews').upsert({
  woocommerce_product_id:parent,pricing_status:input.pricing_status,mockup_status:input.mockup_status,
  supplier_status:input.supplier_status,review_notes:notes.slice(0,1500),reviewed_by:userId,
  reviewed_at:new Date().toISOString()
 },{onConflict:'woocommerce_product_id'}).select('woocommerce_product_id'),'Save readiness checklist');
 return {woocommerce_product_id:parent};
}
async function seedExpanded(db,userId){
 const existing=await read(db.from('sc_manufacturing_recipes').select('id,name').limit(2500),'Current recipes');
 const known=new Set(existing.map(x=>x.name));let created=0,reused=0;
 for(const p of EXPANDED_STARTER_PRESETS){
  if(known.has(p.name)){reused++;continue;}
  const recipe=await one(db.from('sc_manufacturing_recipes').insert({
   name:p.name,garment_type:p.garment_type,decoration_method:p.decoration_method,
   notes:'Unverified process-specific starter. Do not approve without verified physical sample.',created_by:userId
  }).select('id').single(),'Create recipe');
  await read(db.from('sc_manufacturing_recipe_versions').insert({
   recipe_id:recipe.id,revision:1,placements:p.placements,process_steps:p.process_steps,
   packaging:p.packaging,production_notes:p.production_notes,status:'draft',
   verified_sample:false,created_by:userId
  }).select('id'),'Create recipe draft');
  known.add(p.name);created++;
 }
 return {created,reused,available:EXPANDED_STARTER_PRESETS.length,
  notice:'All templates are drafts. Physical verification and a manager approval are still required.'};
}
const comparable=(x,y)=>norm(x)===norm(y);
async function reorderPreview(db){
 const open=await read(db.from('jobs').select('id,customer_name,customer_id,status')
  .not('status','in','(completed,voided,cancelled,canceled)').limit(200),'Open jobs');
 if(!open.length)return [];
 const items=await read(db.from('job_items').select('id,job_id,order_sku,sku,placement,color,size,quantity,woocommerce_product_id,blank_product_id,finished_product_id')
  .in('job_id',open.map(j=>j.id)).limit(1500),'Open lines');
 const past=await read(db.from('sc_job_travelers').select('id,job_id,job_item_id,recipe_version_id,recipe_snapshot,created_at').order('created_at',{ascending:false}).limit(1000),'Prior approved travelers');
 const jobs=await read(db.from('jobs').select('id,customer_name,customer_id').in('id',[...new Set(past.map(t=>t.job_id))].slice(0,1000)).limit(1000),'Historical traveler customers').catch(()=>[]);
 const jobById=new Map([...open,...jobs].map(j=>[Number(j.id),j]));
 const parentIds=[...new Set(items.map(i=>i.woocommerce_product_id).filter(Boolean))];
 const artwork=parentIds.length?await read(db.from('sc_catalog_artwork_links').select('woocommerce_product_id,artwork_asset_id,review_required').in('woocommerce_product_id',parentIds).limit(1000),'Linked artwork'):[];
 const artByParent=new Map(artwork.map(x=>[Number(x.woocommerce_product_id),x]));
 const decisions=items.length?await read(db.from('sc_catalog_reorder_reviews').select('job_item_id,decision,reviewed_at')
  .in('job_item_id',items.map(i=>i.id)).limit(1500),'Previous reviews'):[];
 const reviewed=new Map(decisions.map(x=>[Number(x.job_item_id),x]));
 return items.map(item=>{
  const currentJob=jobById.get(Number(item.job_id)), key=Number(item.woocommerce_product_id||0);
  const matches=past.filter(t=>{
   const old=jobById.get(Number(t.job_id));
   if(!old||Number(old.id)===Number(currentJob?.id))return false;
   if(currentJob?.customer_id&&old.customer_id)return Number(currentJob.customer_id)===Number(old.customer_id);
   return Boolean(norm(currentJob?.customer_name)&&norm(old.customer_name)===norm(currentJob?.customer_name));
  });
  const candidate=matches.find(t=>comparable(t.recipe_snapshot?.blank?.sku,item.order_sku||item.sku))||null;
  const warnings=[];const snap=candidate?.recipe_snapshot||{};
  if(!candidate)warnings.push('No prior approved traveler for the exact customer and SKU');
  if(candidate){
   if(!comparable(snap.blank?.color,item.color))warnings.push('Garment color differs');
   if(!comparable(snap.blank?.size,item.size))warnings.push('Garment size differs');
   if(!comparable(snap.placement,item.placement))warnings.push('Decoration placement differs');
   if(artByParent.has(key)&&artByParent.get(key).review_required)warnings.push('Shared artwork needs revision review');
   if(artByParent.has(key)&&artByParent.get(key).artwork_asset_id!==snap.artwork_asset_id)warnings.push('Linked artwork differs from historic traveler');
   if(!snap.artwork_asset_id)warnings.push('Historic traveler lacks approved source artwork');
   if(!snap.machine_settings_id)warnings.push('Historic traveler lacks approved material settings');
   if(item.finished_product_id)warnings.push('Finished inventory candidate: check stock before production');
  }
  return {job_item_id:item.id,job_id:item.job_id,product_id:key,customer_name:currentJob?.customer_name||'',
   source_traveler_id:candidate?.id||null,source_recipe_version_id:candidate?.recipe_version_id||null,
   differences:warnings,decision:reviewed.get(Number(item.id))?.decision||'not_reviewed',
   status:!candidate?'No verified baseline':warnings.length?'Changes require review':'Comparable — confirm with customer'};
 });
}
async function saveReorder(db,input,userId){
 const itemId=ensure(id(input.job_item_id),'Select an open job line.');
 const approvedSource=ensure(clean(input.source_traveler_id),'No approved historical production traveler to reuse.');
 ensure(['confirmed','rejected'].includes(input.decision),'Choose confirm or reject.');
 const live=await reorderPreview(db);
 const current=ensure(live.find(i=>Number(i.job_item_id)===itemId&&i.source_traveler_id===approvedSource),
  'Historical match changed. Refresh reorder preview.');
 const notes=clean(input.review_notes);
 ensure(input.confirm===true&&notes.length>=12,'Confirm review and explain the decision and differences.');
 const snap={job_id:current.job_id,product_id:current.product_id,
  source_recipe_version_id:current.source_recipe_version_id,
  compared_at:new Date().toISOString()};
 await read(db.from('sc_catalog_reorder_reviews').upsert({
  job_item_id:itemId,source_traveler_id:approvedSource,
  comparison_snapshot:snap,differences:current.differences,
  decision:input.decision,review_notes:notes.slice(0,1500),reviewed_by:userId,
  reviewed_at:new Date().toISOString()
 },{onConflict:'job_item_id'}).select('job_item_id'),'Save reorder review');
 return {job_item_id:itemId,decision:input.decision,notice:'No traveler, invoice or inventory records were changed.'};
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return reject(event,405,'Method not allowed.');
 const auth=await authorizeEmployee(event,{functionName:'legacy-catalog-modernization',allowedRoles:allRoles});
 if(!auth.ok)return reject(event,auth.statusCode,auth.message);
 let input;try{input=JSON.parse(event.body||'{}');}catch{return reject(event,400,'JSON required.');}
 const action=clean(input.action);
 const reads=new Set(['dashboard','client_candidates','reorder_preview']);
 if(!reads.has(action)&&!editRoles.has(auth.role))return reject(event,403,'Manager/owner role required for production-affecting reviews.');
 try{
  const db=auth.supabase,userId=auth.user.id;
  let data;
  switch(action){
   case 'dashboard':data=await dashboard(db);break;
   case 'client_candidates':data=await candidates(db);break;
   case 'link_client':data=await linkCustomer(db,input,userId,false);break;
   case 'create_client':data=await linkCustomer(db,input,userId,true);break;
   case 'link_artwork':data=await linkArtwork(db,input,userId);break;
   case 'flag_artwork_revision':data=await flagArtwork(db,input,userId);break;
   case 'save_checklist':data=await saveChecklist(db,input,userId);break;
   case 'seed_expanded_recipes':data=await seedExpanded(db,userId);break;
   case 'reorder_preview':data=await reorderPreview(db);break;
   case 'save_reorder':data=await saveReorder(db,input,userId);break;
   default:return reject(event,400,'Unsupported modernization action.');
  }
  return result(event,data);
 }catch(e){console.error('Modernization request failed',action,e.message);
  return reject(event,400,e.message||'Modernization failed.');}
}
