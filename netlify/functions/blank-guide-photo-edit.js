import { authorizeEmployee, jsonResponse, auditFunctionSecurity } from './_shared/security.js';
import { r2BucketName } from './_shared/mockupStorage.js';

const text=(value)=>String(value??'').trim();
const validHttps=(value)=>{
 try {const url=new URL(text(value)); return url.protocol==='https:'&&url.username===''&&url.password===''&&url.hostname.length>3&&url.href.length<2048?url.href:''}
 catch{return ''}
};
const scoped=(q,column,value)=>value==null?q.is(column,null):q.eq(column,value);
export const handler=async(event)=>{
 if(event.httpMethod==='OPTIONS') return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST') return jsonResponse(405,{success:false,message:'POST required'},event);
 const auth=await authorizeEmployee(event,{functionName:'blank-guide-photo-edit',allowedRoles:['admin','manager']});
 if(!auth.ok) return jsonResponse(auth.statusCode,{success:false,message:auth.message},event);
 try{
  const input=JSON.parse(event.body||'{}');
  const id=text(input.blank_id), action=text(input.action||'set');
  if(!/^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(id))return jsonResponse(400,{success:false,message:'Invalid blank identifier.'},event);
  if(!['set','clear','approve'].includes(action))return jsonResponse(400,{success:false,message:'Invalid action.'},event);
  const {data:sample,error:findError}=await auth.supabase.from('blank_products')
    .select('id,brand_id,product_type_id,color_id,sc_is_archived').eq('id',id).single();
  if(findError||!sample||sample.sc_is_archived)return jsonResponse(404,{success:false,message:'Active blank not found.'},event);

  let patch={};
  if(action==='approve'){
   patch={};
  }else if(action==='clear'){
   patch={
    image_url:null,
    image_storage_provider:null,image_storage_bucket:null,image_storage_path:null,
    image_file_size_bytes:null,image_mime_type:null,
    image_preview_storage_provider:null,image_preview_storage_bucket:null,
    image_preview_storage_path:null,image_preview_size_bytes:null,
   };
  }else if(input.image_url){
   const url=validHttps(input.image_url);
   if(!url)return jsonResponse(400,{success:false,message:'Enter a valid HTTPS product photograph URL.'},event);
   patch={
    image_url:url,image_storage_provider:null,image_storage_bucket:null,image_storage_path:null,
    image_file_size_bytes:null,image_mime_type:null,
    image_preview_storage_provider:null,image_preview_storage_bucket:null,
    image_preview_storage_path:null,image_preview_size_bytes:null,
   };
  }else{
   const storage=input.storage||{};
   const prefix='operational/products/'+auth.user.id+'/';
   if(storage.storage_provider!=='r2'||storage.storage_bucket!==r2BucketName()||
      !text(storage.storage_path).startsWith(prefix)||!/^\S{6,1024}$/.test(text(storage.storage_path))||
      !/^image\/(png|jpeg|webp|gif)$/.test(text(storage.mime_type))||
      !Number.isSafeInteger(Number(storage.file_size_bytes))||Number(storage.file_size_bytes)<=0||Number(storage.file_size_bytes)>15*1024*1024)
    return jsonResponse(400,{success:false,message:'The uploaded image reference is invalid.'},event);
   const previewPath=text(storage.preview_storage_path);
   if(previewPath && (!previewPath.startsWith('operational/products/previews/'+auth.user.id+'/') ||
      storage.preview_storage_provider!=='r2'||storage.preview_storage_bucket!==r2BucketName()))
    return jsonResponse(400,{success:false,message:'The uploaded preview reference is invalid.'},event);
   patch={
    image_url:null,image_storage_provider:'r2',image_storage_bucket:r2BucketName(),
    image_storage_path:text(storage.storage_path),image_file_size_bytes:Number(storage.file_size_bytes),
    image_mime_type:storage.mime_type,
    image_preview_storage_provider:previewPath?'r2':null,
    image_preview_storage_bucket:previewPath?r2BucketName():null,
    image_preview_storage_path:previewPath||null,
    image_preview_size_bytes:previewPath?Number(storage.preview_size_bytes||0):null,
   };
  }
  const matched=scoped(scoped(scoped(auth.supabase.from('blank_products').select('id')
    .eq('sc_is_archived',false), 'brand_id', sample.brand_id),'product_type_id',sample.product_type_id),'color_id',sample.color_id);
  const {data:variants,error:listError}=await matched;
  if(listError)throw listError;
  if(!variants?.length||variants.length>500)return jsonResponse(409,{success:false,message:'Cannot safely determine matching size variations.'},event);
  // Incomplete identities can be corrected individually, without grouping unrelated unknowns.
  const ids=sample.brand_id&&sample.product_type_id&&sample.color_id?variants.map(row=>row.id):[sample.id];
  // The exact family/color match has already been checked. Preserve all supplier and inventory fields.
  const confidence=['exact','likely','provisional'].includes(input.match_confidence)?input.match_confidence:'unverified';
  const sourceUrl=input.source_product_url?validHttps(input.source_product_url):null;
  if(input.source_product_url&&!sourceUrl)return jsonResponse(400,{success:false,message:'Source page must be an HTTPS URL.'},event);
  const {data:updated,error:updateError}=await auth.supabase.rpc('sc_save_blank_photo',{
   p_ids:ids,p_patch:patch,p_manual:true,p_actor:auth.user.id,p_approve:action==='approve',
   p_source:{supplier_name:text(input.supplier_name).slice(0,120)||'Manual',source_product_url:sourceUrl,
    capture_type:input.capture_type==='screenshot'?'screenshot':input.image_url?'direct':'manual',
    match_confidence:confidence,matched_by:auth.user.id,evidence:text(input.evidence).slice(0,2000)},
  });
  if(updateError)throw updateError;
  await auditFunctionSecurity({functionName:'blank-guide-photo-edit',action:'change_photo',outcome:'success',
    userId:auth.user.id,role:auth.role,event,metadata:{blank_id:id,action,count:Number(updated)||0,method:input.image_url?'url':'r2'}});
  return jsonResponse(200,{success:true,updated:Number(updated)||0,message:'Updated image reference across matching size variations.'},event);
 }catch(error){return jsonResponse(500,{success:false,message:error.message||'Unable to update identification photograph.'},event)}
};
