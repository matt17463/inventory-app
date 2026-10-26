import {authorizeEmployee,jsonResponse} from './_shared/security.js';
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
const checks=['woo_product_confirmed','existing_selector_reconciled','physical_sample_verified','artwork_storage_verified'];
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{message:'Method not allowed'},event);
 const auth=await authorizeEmployee(event,{functionName:'woo-graphic-binding-review',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 let input;
 try{input=JSON.parse(event.body||'{}')}catch{return jsonResponse(400,{message:'Invalid JSON'},event)}
 if(!uuid(input.binding_id)||!['approve','revoke'].includes(input.decision))return jsonResponse(400,{message:'Valid binding and decision required'},event);
 const evidence=input.evidence;
 if(input.decision==='approve'&&(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||checks.some(k=>evidence[k]!==true)))
  return jsonResponse(400,{message:'Verify product identity, existing selector reconciliation, physical sample, and R2 artwork before approval'},event);
 if(input.decision==='revoke'&&(!evidence||typeof evidence.reason!=='string'||evidence.reason.trim().length<5))
  return jsonResponse(400,{message:'Revocation reason is required'},event);
 try{
  const {data,error}=await auth.supabase.rpc('sc_review_woo_graphic_binding',{
   p_binding_id:input.binding_id,p_actor:auth.user.id,p_decision:input.decision,
   p_evidence:input.decision==='approve'?Object.fromEntries(checks.map(k=>[k,true])):{reason:evidence.reason.trim().slice(0,500)}
  });
  if(error)return jsonResponse(error.code==='42501'?403:409,{message:'Verification refused',detail:String(error.message||'').slice(0,240)},event);
  return jsonResponse(200,{binding:data,storefront_selector_enabled:false,notice:'WooCommerce selector and order-capture flags are not changed by binding approval.'},event);
 }catch{return jsonResponse(500,{message:'Binding review is unavailable'},event)}
}
