import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {artworkDigest} from './_shared/artworkIntegrity.js';
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'POST required.'},event);
 const auth=await authorizeEmployee(event,{functionName:'artwork-object-integrity',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
 try{
  const body=JSON.parse(event.body||'{}');
  if(!/^[a-f0-9-]{36}$/i.test(String(body.asset_id||''))||String(body.review_note||'').trim().length<12)throw Error('Select exact artwork and enter the source revision you reviewed.');
  const {data:asset,error}=await auth.supabase.from('mockup_artwork_assets').select('id,updated_at,storage_provider,storage_bucket,storage_path').eq('id',body.asset_id).single();
  if(error||!asset)throw Error('Artwork asset is unavailable.');
  const digest=await artworkDigest(auth.supabase,asset);
  const {data:id,error:saveError}=await auth.supabase.rpc('sc_register_artwork_object_revision',{
   p_asset:asset.id,p_updated_at:asset.updated_at,p_provider:asset.storage_provider,p_bucket:asset.storage_bucket,p_path:asset.storage_path,
   p_sha256:digest.sha256,p_bytes:digest.bytes,p_actor:auth.user.id,p_note:String(body.review_note).trim().slice(0,2000)
  });
  if(saveError)throw saveError;
  return jsonResponse(200,{success:true,revision_id:id,...digest,note:'Bytes registered only. Customer consent, artwork permission and physical sample approval remain separate.'},event);
 }catch(error){return jsonResponse(409,{success:false,error:error.message||'Artwork registration failed.'},event);}
}
