import {authorizeEmployee,jsonResponse} from './_shared/security.js';
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{message:'Method not allowed'},event);
 const auth=await authorizeEmployee(event,{functionName:'traveler-graphic-selections',allowedRoles:['admin','manager','operator']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{message:auth.message},event);
 try{
  const body=JSON.parse(event.body||'{}');
  const jobId=Number(body.job_id), ids=body.job_item_ids;
  if(!Number.isSafeInteger(jobId)||jobId<=0||!Array.isArray(ids)||ids.length<1||ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<=0))
    return jsonResponse(400,{message:'Valid job and line IDs required'},event);
  const {data:job,error:je}=await auth.supabase.from('jobs').select('id,woocommerce_order_id').eq('id',jobId).single();
  if(je||!job)return jsonResponse(404,{message:'Job not found'},event);
  const {data:items,error:ie}=await auth.supabase.from('job_items').select('id,job_id,woocommerce_line_item_id').eq('job_id',jobId).in('id',ids);
  if(ie||items?.length!==new Set(ids).size)return jsonResponse(409,{message:'Order line mismatch'},event);
  if(!job.woocommerce_order_id){
   const {data:rows,error:re}=await auth.supabase.from('sc_order_graphic_selections')
    .select('job_item_id,source,family_id,selected_label,resolution_snapshot').in('job_item_id',ids);
   if(re)throw Error('Could not retrieve manual or QuickBooks selections');
   const byLine=new Map((rows||[]).map(row=>[Number(row.job_item_id),row]));
   const selections=items.map(item=>({job_item_id:item.id,...(byLine.get(Number(item.id))||{})}));
   const unmapped_line_ids=items.filter(x=>!byLine.has(Number(x.id))).map(x=>x.id);
   return jsonResponse(200,{channel:'manual',selections,unmapped_line_ids},event);
  }
  const lineIds=items.filter(x=>x.woocommerce_line_item_id).map(x=>String(x.woocommerce_line_item_id));
  if(!lineIds.length)return jsonResponse(200,{channel:'woocommerce',selections:[],unmapped_line_ids:ids},event);
  const {data:rows,error:re}=await auth.supabase.from('sc_order_graphic_selections').select('external_line_id,family_id,selected_label,resolution_snapshot').eq('source','woocommerce').eq('external_order_id',String(job.woocommerce_order_id)).in('external_line_id',lineIds);
  if(re)throw Error('Could not retrieve order graphics');
  const byLine=new Map((rows||[]).map(x=>[x.external_line_id,x]));
  const selections=items.map(item=>({job_item_id:item.id,...(byLine.get(String(item.woocommerce_line_item_id))||{})}));
  return jsonResponse(200,{channel:'woocommerce',selections,unmapped_line_ids:items.filter(x=>!byLine.has(String(x.woocommerce_line_item_id))).map(x=>x.id)},event);
 }catch(e){return jsonResponse(500,{message:'Order graphic verification is unavailable'},event)}
}
