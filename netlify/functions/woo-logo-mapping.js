import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {employeeDatabase} from './_shared/verifiedTraveler.js';
import {readWooLogoBaseline} from './woo-logo-migration-preview.js';
import {applyMappingTemplate,buildMigrationPlan,logoAttribute,normalizeChoice,reviewMigrationEvidence} from './_shared/wooLogoMigration.js';

const id=n=>Number.isSafeInteger(Number(n))&&Number(n)>0?Number(n):null;
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));
async function rows(q){const {data,error}=await q;if(error)throw Error(error.message);return data||[];}
function analysis(record){
 const plan=buildMigrationPlan({...record.baseline,mappings:record.mappings,canonical:record.canonical,snapshotHash:record.source_hash});
 const choices=Object.keys(record.mappings);
 const mapped=choices.filter(c=>uuid(record.mappings[c]?.family_id)&&uuid(record.mappings[c]?.artwork_asset_id)).length;
 return {mapping_complete:choices.length>0&&mapped===choices.length,mapped_choices:mapped,total_choices:choices.length,
  counts:plan.counts,blockers:plan.blockers,plan_hash:plan.plan_hash,crosswalk:plan.crosswalk,operations:plan.operations};
}
async function planFor(db,planId){
 if(!uuid(planId))throw Error('Select an existing saved mapping plan.');
 const {data,error}=await db.from('sc_woo_logo_mapping_plans').select('*').eq('id',planId).single();
 if(error||!data)throw Error('Saved mapping plan not found.');return data;
}
async function save(db,prior,changes,actor,revision){
 if(Number(revision)!==prior.revision)throw Object.assign(Error('Another manager changed this mapping. Reload the saved revision before editing.'),{status:409});
 const candidate={...prior,...changes};candidate.analysis=analysis(candidate);
 const {data,error}=await db.from('sc_woo_logo_mapping_plans').update({...changes,analysis:candidate.analysis,updated_by:actor})
  .eq('id',prior.id).eq('revision',prior.revision).select('*').maybeSingle();
 if(error)throw error;if(!data)throw Object.assign(Error('Mapping changed concurrently. Reload before saving.'),{status:409});return data;
}
async function library(db){
 const [families,variants,projects,artworks,recipes,outputs]=await Promise.all([
  rows(db.from('sc_client_graphic_families').select('*').order('name').limit(1000)),
  rows(db.from('sc_client_graphic_variants').select('*').limit(1000)),
  rows(db.from('mockup_projects').select('id,project_name,woo_product_id').limit(1000)),
  rows(db.from('mockup_artwork_assets').select('id,project_id,artwork_name,preflight_status,updated_at').order('artwork_name').limit(1000)),
  rows(db.from('sc_manufacturing_recipe_versions').select('id,recipe_id,revision,status,artwork_asset_id,verified_sample').limit(1000)),
  rows(db.from('mockup_outputs').select('id,project_id,placement_id,output_name,approval_status,is_selected').limit(1000))
 ]);
 return {families,variants,projects,artworks,recipes,outputs,limit:1000,possibly_truncated:[families,variants,projects,artworks,recipes,outputs].some(x=>x.length===1000)};
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,message:'POST required'},event);
 const auth=await authorizeEmployee(event,{functionName:'woo-logo-mapping',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,message:auth.message},event);
 try{
  const input=JSON.parse(event.body||'{}'),db=auth.supabase;let result;
  switch(input.action){
   case 'catalog':{
    const [families,plans]=await Promise.all([
     rows(db.from('sc_catalog_production_families_v1').select('*').order('woocommerce_product_id').limit(1000)),
     rows(db.from('sc_woo_logo_mapping_plans').select('id,woo_product_id,source_hash,revision,analysis,note,updated_at').order('updated_at',{ascending:false}).limit(2000))
    ]);result={families,plans:plans.map(p=>({...p,analysis:{mapping_complete:p.analysis.mapping_complete,mapped_choices:p.analysis.mapped_choices,total_choices:p.analysis.total_choices}})),library:await library(db)};break;
   }
   case 'inspect':{
    const parent=id(input.woo_product_id);if(!parent)throw Error('Exact Woo parent ID required.');
    const baseline=await readWooLogoBaseline(parent);
    if(!baseline.complete)throw Error('Woo variation pagination is incomplete; no draft was saved.');
    let prior=(await rows(db.from('sc_woo_logo_mapping_plans').select('*').eq('woo_product_id',parent).eq('source_hash',baseline.source_hash).limit(1)))[0];
    if(!prior){
     const mappings=Object.fromEntries(baseline.product.attributes.filter(logoAttribute).flatMap(a=>a.options||[]).map(label=>[normalizeChoice(label),{label,family_id:'',artwork_asset_id:'',variant_id:'',recipe_version_id:'',output_by_image:{}}]));
     const candidate={woo_product_id:parent,source_hash:baseline.source_hash,baseline,mappings,canonical:{},created_by:auth.user.id,updated_by:auth.user.id,note:'Read-only Woo capture; artwork mapping is a draft and supplies no approval.'};
     const {data,error}=await db.from('sc_woo_logo_mapping_plans').insert({...candidate,analysis:analysis(candidate)}).select('*').single();
     if(error?.code==='23505')prior=(await rows(db.from('sc_woo_logo_mapping_plans').select('*').eq('woo_product_id',parent).eq('source_hash',baseline.source_hash).limit(1)))[0];
     else if(error)throw error;else prior=data;
    }
    result=prior;break;
   }
   case 'load': result=await planFor(db,input.plan_id);break;
   case 'history': result=await rows(db.from('sc_woo_logo_mapping_events').select('*').eq('plan_id',(await planFor(db,input.plan_id)).id).order('revision',{ascending:false}).limit(100));break;
   case 'add_choice':{
    const prior=await planFor(db,input.plan_id),label=String(input.label||'').trim(),choice=normalizeChoice(label);
    if(label.length<2||label.length>160||Object.hasOwn(prior.mappings,choice))throw Error('Enter a distinct artwork choice label (2–160 characters).');
    result=await save(db,prior,{mappings:{...prior.mappings,[choice]:{label,family_id:'',artwork_asset_id:'',variant_id:'',recipe_version_id:'',output_by_image:{},source_kind:'manager_added_draft'}},note:prior.note+'\nManager added draft artwork choice: '+label+'; no source approval inferred.'},auth.user.id,input.revision);break;
   }
   case 'save':{
    const prior=await planFor(db,input.plan_id);
    if(!input.mappings||typeof input.mappings!=='object'||Array.isArray(input.mappings)||!input.canonical||typeof input.canonical!=='object'||Array.isArray(input.canonical))throw Error('Mapping and physical-variation selections must be objects.');
    const choices=Object.keys(prior.mappings);
    if(Object.keys(input.mappings).some(c=>!choices.includes(c))||choices.some(c=>!Object.hasOwn(input.mappings,c)))throw Error('Save one explicit entry for every captured legacy choice.');
    if(JSON.stringify(input.mappings).length>500000)throw Error('Mapping is too large.');
    result=await save(db,prior,{mappings:input.mappings,canonical:input.canonical,note:String(input.note||'').slice(0,5000)},auth.user.id,input.revision);break;
   }
   case 'create_draft_families':{
    const prior=await planFor(db,input.plan_id);
    if(prior.revision!==Number(input.revision))throw Object.assign(Error('Reload the current mapping revision first.'),{status:409});
    for(const [choice,mapping] of Object.entries(prior.mappings)){
     if(mapping.family_id&&mapping.variant_id)continue;
     const {error}=await employeeDatabase(event).rpc('sc_create_logo_mapping_family',{p_plan:prior.id,p_choice:choice,p_label:String(mapping.label||choice)});if(error)throw error;
    }
    {const latest=await planFor(db,prior.id);result=await save(db,latest,{},auth.user.id,latest.revision);}break;
   }
   case 'template':{
    const [target,source]=await Promise.all([planFor(db,input.plan_id),planFor(db,input.template_id)]);
    if(target.id===source.id)throw Error('Choose another product mapping as the template.');
    const mappings=applyMappingTemplate(target.mappings,source.mappings);
    result=await save(db,target,{mappings,note:`Template proposal from Woo ${source.woo_product_id}; exact legacy terms only. Image associations, retained variations and approvals were not copied.`},auth.user.id,input.revision);break;
   }
   case 'validate':{
    const prior=await planFor(db,input.plan_id),fresh=await readWooLogoBaseline(prior.woo_product_id);
    if(fresh.source_hash!==prior.source_hash)throw Object.assign(Error('WooCommerce source changed. Capture a new baseline; retain the old draft in history.'),{status:409});
    const plan=buildMigrationPlan({...prior.baseline,mappings:prior.mappings,canonical:prior.canonical,snapshotHash:prior.source_hash});
    const evidence=await reviewMigrationEvidence(db,plan);
    result={...analysis(prior),production_ready:plan.ready&&evidence.ready,production_blockers:evidence.blockers,evidence_hash:evidence.evidence_hash,
     note:'Draft mapping does not need approval. Production readiness and physical variation cutover do; this action changes neither WooCommerce nor approvals.'};break;
   }
   default:throw Error('Unknown mapping action.');
  }
  return jsonResponse(200,{success:true,data:result},event);
 }catch(error){console.error('Woo logo mapping:',String(error.message));return jsonResponse(error.status||500,{success:false,message:String(error.message||'Mapping operation failed.').slice(0,500)},event);}
}
