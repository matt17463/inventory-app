import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function call(body){
 const response=await authenticatedFunctionFetch('/.netlify/functions/uv-asset-storage',{method:'POST',body:JSON.stringify(body)});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload.message||'Private UV artwork storage is unavailable');
 return payload;
}
export async function listUvAssets(projectId){return (await call({action:'list',project_id:projectId})).assets||[];}
export async function uploadUvAsset(projectId,{asset_kind,file_name,mime_type,blob,notes=''}) {
 const file=blob instanceof Blob?blob:new Blob([blob],{type:mime_type});
 if(!file.size||file.size>52_428_800)throw new Error('UV artifact exceeds the 50 MB private file limit.');
 const reservation=await call({action:'create_upload',project_id:projectId,asset_kind,file_name,mime_type,file_size:file.size});
 let response;
 try{
  response=await fetch(reservation.upload_url,{method:'PUT',headers:{'Content-Type':mime_type},body:file});
 }catch{throw new Error('R2 browser upload failed. Configure Cloudflare R2 CORS for https://inventory.skilledcrafting.com (PUT, GET, HEAD; Content-Type header).');}
 if(!response.ok)throw new Error('Private R2 file upload failed with HTTP '+response.status);
 return (await call({action:'finalize',project_id:projectId,storage_key:reservation.storage_key,asset_kind,
    file_name,mime_type,file_size:file.size,notes})).asset;
}
export async function signedUvAsset(projectId,assetId){
 return call({action:'download',project_id:projectId,asset_id:assetId});
}
export async function readUvEditable(projectId,assetId){
 const response=await call({action:'read_inline',project_id:projectId,asset_id:assetId});
 return response.text;
}
