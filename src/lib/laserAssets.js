import { authenticatedFunctionFetch } from './netlifyFunctionClient';
async function request(body) {
 const response=await authenticatedFunctionFetch('/.netlify/functions/laser-asset-storage',{method:'POST',body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||'Private laser artwork storage is unavailable.');
 return data;
}
export async function listLaserAssets(projectId){return (await request({action:'list',project_id:projectId})).assets||[];}
export async function uploadLaserAsset(projectId,{kind,filename,mime,blob,notes=''}) {
 const file=blob instanceof Blob?blob:new Blob([blob],{type:mime});
 if(file.size<1||file.size>52428800)throw Error('Laser asset must be between 1 byte and 50 MB.');
 const reservation=await request({action:'create_upload',project_id:projectId,asset_kind:kind,file_name:filename,mime_type:mime,file_size:file.size});
 let res;
 try{res=await fetch(reservation.upload_url,{method:'PUT',headers:{'Content-Type':mime},body:file});}
 catch{throw Error('R2 upload could not connect. Check bucket CORS (PUT, GET, HEAD; Content-Type).');}
 if(!res.ok)throw Error('R2 upload failed: HTTP '+res.status);
 return (await request({action:'finalize',project_id:projectId,storage_key:reservation.storage_key,asset_kind:kind,
  file_name:filename,mime_type:mime,file_size:file.size,notes})).asset;
}
export async function signedLaserAsset(projectId,assetId){return request({action:'download',project_id:projectId,asset_id:assetId});}
export async function readLaserAsset(projectId,assetId) {
 const a=await request({action:'read_inline',project_id:projectId,asset_id:assetId});
 const raw=atob(a.base64),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new Blob([bytes],{type:a.mime_type});
}
