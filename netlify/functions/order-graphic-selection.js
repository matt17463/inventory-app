import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {buildOrderGraphicSelection} from '../../src/lib/orderGraphicSelection.js';
import {resolveGraphicVariant} from '../../src/lib/clientGraphicsRules.js';
const reply=(code,data,e)=>jsonResponse(code,data,e);
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return reply(204,{},event);
 if(event.httpMethod!=='POST')return reply(405,{message:'Method not allowed'},event);
 const auth=await authorizeEmployee(event,{functionName:'order-graphic-selection',allowedRoles:['admin','manager','operator']});
 if(!auth.ok)return reply(auth.statusCode,{message:auth.message},event);
 try{
  const input=JSON.parse(event.body||'{}');
  if(!['manual','quickbooks'].includes(input.source))return reply(400,{message:'Only manual or QuickBooks orders accepted'},event);
  const selection=buildOrderGraphicSelection(input);
  const jobId=Number(input.jobId),jobItemId=Number(input.jobItemId);
  if(!Number.isSafeInteger(jobId)||jobId<=0||!Number.isSafeInteger(jobItemId)||jobItemId<=0)
   return reply(400,{message:'Choose a real production job and job line'},event);
  const {data:jobLine,error:lineError}=await auth.supabase.from('job_items').select('id,job_id').eq('id',jobItemId).eq('job_id',jobId).maybeSingle();
  if(lineError||!jobLine)return reply(409,{message:'Selected production line does not belong to this job'},event);

  const {data:family,error:fe}=await auth.supabase.from('sc_client_graphic_families').select('id,state').eq('id',selection.family_id).maybeSingle();
  if(fe||family?.state!=='approved')return reply(409,{message:'Select an approved customer design'},event);
  const [versions,ruleRows]=await Promise.all([
   auth.supabase.from('sc_client_graphic_variants').select('*').eq('family_id',family.id),
   auth.supabase.from('sc_client_graphic_rules').select('*').eq('family_id',family.id).eq('enabled',true)
  ]);
  if(versions.error||ruleRows.error)throw Error('Artwork lookup unavailable');
  const resolution=resolveGraphicVariant({familyId:family.id,variants:versions.data,rules:ruleRows.data,context:input.details||{}});
  if(resolution.status!=='resolved')return reply(409,{message:'Production artwork does not uniquely resolve',resolution_status:resolution.status},event);
  const payload={...selection,job_item_id:jobItemId,resolution_snapshot:resolution};
  const {data:previous,error:priorError}=await auth.supabase.from('sc_order_graphic_selections').select('id,source,external_order_id,external_line_id').eq('job_item_id',jobItemId).maybeSingle();
  if(priorError)throw Error('Existing job artwork assignment could not be verified');
  if(previous&&(previous.source!==selection.source||previous.external_order_id!==selection.external_order_id||previous.external_line_id!==selection.external_line_id))
   return reply(409,{message:'This production line is already linked to another invoice line; review before replacing'},event);
  const {data,error}=await auth.supabase.from('sc_order_graphic_selections').upsert(payload,{onConflict:'source,external_order_id,external_line_id'}).select('id').single();
  if(error)throw Error('Unable to save graphic assignment');
  return reply(200,{id:data.id,status:'resolved',variant_id:resolution.variantId},event);
 }catch(e){return reply(400,{message:String(e.message||'Order graphic selection error').slice(0,150)},event)}
}
