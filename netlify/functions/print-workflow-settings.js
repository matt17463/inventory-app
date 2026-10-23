// Manager-only shared print layouts and explicit approved SKU → manufacturing recipe mapping.
import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {normalizePrintPrefs} from '../../src/lib/printModel.js';
const clean=x=>String(x??'').trim();
const validUuid=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(clean(x));
export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'POST required.'},event);
 const auth=await authorizeEmployee(event,{functionName:'print-workflow-settings',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
 try{
  const body=JSON.parse(event.body||'{}'),action=clean(body.action);
  const id=['default','woocommerce','quickbooks_manual'].includes(body.source)?body.source:'default';
  if(action==='get'){
   const [shared,profiles,versions]=await Promise.all([
    auth.supabase.from('sc_print_layout_profiles').select('id,settings,version,updated_at').in('id',['default',id]),
    auth.supabase.from('sc_product_production_profiles').select('source_key,source_kind,recipe_version_id,artwork_asset_id,notes').eq('source_kind','sku').limit(500),
    auth.supabase.from('sc_manufacturing_recipe_versions').select('id,recipe_id,revision,status,artwork_asset_id')
      .eq('status','approved').limit(500),
   ]);
   if(shared.error||profiles.error||versions.error)throw Error('Shared print preferences/recipe mappings unavailable. Apply the print integrations migration.');
   const layouts=Object.fromEntries((shared.data||[]).map(v=>[v.id,v]));
   return jsonResponse(200,{success:true,
    settings:normalizePrintPrefs({...layouts.default?.settings,...layouts[id]?.settings}),
    version:layouts[id]?.version||0,profiles:profiles.data||[],approvedVersions:versions.data||[]},event);
  }
  if(action==='save_layout'){
   const settings=normalizePrintPrefs(body.settings||{});
   // Untrusted settings accepted only through the constrained sanitizer.
   const record={id,settings,updated_by:auth.user.id,updated_at:new Date().toISOString()};
   const {data,error}=await auth.supabase.from('sc_print_layout_profiles').upsert(record,{onConflict:'id'})
    .select('id,version').single();
   if(error)throw Error('Could not save shared print layout.');
   return jsonResponse(200,{success:true,profile:data},event);
  }
  if(action==='map_sku'){
   const sku=clean(body.sku),version=clean(body.recipeVersionId);
   if(!sku||sku.length>180||!validUuid(version))return jsonResponse(400,{success:false,error:'SKU and approved recipe revision required.'},event);
   const {data:recipe,error:err}=await auth.supabase.from('sc_manufacturing_recipe_versions')
    .select('id,status,verified_sample,artwork_asset_id').eq('id',version).eq('status','approved').maybeSingle();
   if(err||!recipe||!recipe.verified_sample)return jsonResponse(409,{success:false,error:'Choose a physically verified and approved manufacturing recipe.'},event);
   const {error}=await auth.supabase.from('sc_product_production_profiles').upsert({
    source_kind:'sku',source_key:sku,recipe_version_id:recipe.id,artwork_asset_id:recipe.artwork_asset_id,
    notes:clean(body.notes).slice(0,1000),approved_by:auth.user.id,updated_at:new Date().toISOString()
   },{onConflict:'source_kind,source_key'});
   if(error)throw Error('Could not link product SKU to approved recipe.');
   return jsonResponse(200,{success:true},event);
  }
  if(action==='apply_profiles_to_job'){
   const jobId=Number(body.jobId);
   if(!Number.isSafeInteger(jobId)||jobId<=0)return jsonResponse(400,{success:false,error:'Valid job required.'},event);
   const [items,existing,profiles]=await Promise.all([
    auth.supabase.from('job_items').select('id,job_id,order_sku,sku,status').eq('job_id',jobId).limit(500),
    auth.supabase.from('sc_job_travelers').select('job_item_id').eq('job_id',jobId).limit(500),
    auth.supabase.from('sc_product_production_profiles').select('source_key,recipe_version_id').eq('source_kind','sku').limit(1000),
   ]);
   if(items.error||existing.error||profiles.error)throw Error('Job production profiles cannot be loaded.');
   const existingIds=new Set((existing.data||[]).map(x=>String(x.job_item_id)));
   const bySku=new Map((profiles.data||[]).map(p=>[p.source_key,p.recipe_version_id]));
   const ready=(items.data||[]).filter(x=>!existingIds.has(String(x.id))&&!['cancelled','voided'].includes(x.status)
    &&bySku.has(clean(x.order_sku||x.sku)));
   const inserted=[],failed=[];
   for(const item of ready){
    const {data,error}=await auth.supabase.from('sc_job_travelers').insert({
      job_id:jobId,job_item_id:item.id,recipe_version_id:bySku.get(clean(item.order_sku||item.sku)),
      created_by:auth.user.id
    }).select('id').single();
    if(error)failed.push({item_id:item.id,reason:error.message});else inserted.push(data.id);
   }
   return jsonResponse(200,{success:true,created:inserted.length,skipped:(items.data||[]).length-ready.length,
    failed,notice:'Only approved mapped recipe revisions were attached. No production status, inventory or accounting changed.'},event);
  }
  return jsonResponse(400,{success:false,error:'Unknown action.'},event);
 }catch(e){return jsonResponse(502,{success:false,error:e.message||'Print workflow settings unavailable.'},event);}
};
