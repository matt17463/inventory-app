import { randomUUID } from 'node:crypto';
import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { r2Client, r2BucketName, r2Configured, presignedR2Put, cleanObjectName } from './_shared/mockupStorage.js';

const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const TYPES=new Set(['source','heightmap','stl','svg','calibration','proof','editable']);
const MIMES=new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp'],['application/json','json'],['image/svg+xml','svg'],['model/stl','stl']]);
const MAX=52428800;
const reply=(event,status,payload)=>jsonResponse(status,payload,event);
const goodSize=n=>Number.isSafeInteger(Number(n))&&Number(n)>0&&Number(n)<=MAX;
function assertUuid(id){if(!UUID.test(id))throw Object.assign(new Error('Invalid laser project or asset identifier'),{status:400});}
async function readProject(db,id){
 assertUuid(id);
 const {data,error}=await db.from('sc_laser_projects').select('id,status').eq('id',id).maybeSingle();
 if(error)throw error;
 if(!data)throw Object.assign(new Error('Laser relief project not found'),{status:404});
 return data;
}
async function readAsset(db,projectId,assetId){
 assertUuid(assetId);
 const {data,error}=await db.from('sc_laser_assets').select('*').eq('project_id',projectId).eq('id',assetId).maybeSingle();
 if(error)throw error;
 if(!data)throw Object.assign(new Error('Laser asset not found'),{status:404});
 if(data.storage_bucket!==r2BucketName()||!data.storage_key.startsWith('laser-relief/'+projectId+'/'))
  throw Object.assign(new Error('Invalid stored asset location'),{status:409});
 return data;
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return reply(event,204,{});
 if(event.httpMethod!=='POST')return reply(event,405,{message:'Method not allowed'});
 const auth=await authorizeEmployee(event,{functionName:'laser-asset-storage',allowedRoles:['admin','manager','operator','viewer']});
 if(!auth.ok)return reply(event,auth.statusCode,{message:auth.message});
 try{
  if(!r2Configured())return reply(event,503,{message:'Private R2 storage is not configured on this deployment.'});
  const body=JSON.parse(event.body||'{}'),action=String(body.action||'status');
  if(action==='status')return reply(event,200,{configured:true,provider:'r2',max_size:MAX});
  const projectId=String(body.project_id||''),project=await readProject(auth.supabase,projectId);
  if(action==='create_upload'){
   if(!['admin','manager','operator'].includes(auth.role)||!['draft','proof'].includes(project.status))
    return reply(event,403,{message:'Only editable projects accept new uploads.'});
   const kind=String(body.asset_kind||''),mime=String(body.mime_type||''),name=cleanObjectName(body.file_name||'asset');
   if(!TYPES.has(kind)||!MIMES.has(mime)||!goodSize(body.file_size)||!name.endsWith('.'+MIMES.get(mime)))
    return reply(event,400,{message:'Invalid type, extension, or file size (50 MB maximum).'});
   const key='laser-relief/'+projectId+'/'+randomUUID()+'/'+name;
   return reply(event,200,{storage_key:key,mime_type:mime,asset_kind:kind,
     upload_url:await presignedR2Put({key,contentType:mime,expiresIn:900}),expires_in:900});
  }
  if(action==='finalize'){
   if(!['admin','manager','operator'].includes(auth.role)||!['draft','proof'].includes(project.status))
    return reply(event,403,{message:'Project is no longer editable.'});
   const key=String(body.storage_key||''),kind=String(body.asset_kind||''),mime=String(body.mime_type||''),name=String(body.file_name||'').slice(0,180);
   if(!/^laser-relief\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-z0-9-]{1,90}\.(png|jpg|webp|json|svg|stl)$/.test(key)
     ||!key.startsWith('laser-relief/'+projectId+'/')||!TYPES.has(kind)||!MIMES.has(mime)
     ||!goodSize(body.file_size)||!name.toLowerCase().endsWith('.'+MIMES.get(mime)))
     return reply(event,400,{message:'Invalid asset manifest.'});
   const head=await r2Client().send(new HeadObjectCommand({Bucket:r2BucketName(),Key:key}));
   if(Number(head.ContentLength)!==Number(body.file_size)||head.ContentType!==mime)
    return reply(event,409,{message:'R2 content differs from declared file size or MIME type.'});
   const {data,error}=await auth.supabase.from('sc_laser_assets').insert({
     project_id:projectId,asset_kind:kind,file_name:name,mime_type:mime,
     storage_bucket:r2BucketName(),storage_key:key,file_size:Number(body.file_size),
     etag:String(head.ETag||'').replace(/"/g,''),created_by:auth.user.id,
     notes:String(body.notes||'').slice(0,2000)
   }).select('id,project_id,asset_kind,file_name,mime_type,file_size,created_at').single();
   if(error)throw error;
   return reply(event,200,{asset:data});
  }
  if(action==='list'){
   const {data,error}=await auth.supabase.from('sc_laser_assets')
     .select('id,project_id,file_name,asset_kind,mime_type,file_size,created_at,notes')
     .eq('project_id',projectId).order('created_at',{ascending:false}).limit(120);
   if(error)throw error;
   return reply(event,200,{assets:data||[]});
  }
  if(action==='download'||action==='read_inline'){
   const asset=await readAsset(auth.supabase,projectId,String(body.asset_id||''));
   if(action==='download'){
    const url=await getSignedUrl(r2Client(),new GetObjectCommand({Bucket:r2BucketName(),Key:asset.storage_key}),{expiresIn:300});
    return reply(event,200,{url,filename:asset.file_name,expires_in:300});
   }
   if(asset.file_size>5_000_000)return reply(event,413,{message:'Use the signed download for files larger than 5 MB.'});
   const object=await r2Client().send(new GetObjectCommand({Bucket:r2BucketName(),Key:asset.storage_key}));
   const bytes=Buffer.from(await object.Body.transformToByteArray());
   if(bytes.length!==asset.file_size)return reply(event,409,{message:'Stored asset size mismatch.'});
   return reply(event,200,{mime_type:asset.mime_type,base64:bytes.toString('base64')});
  }
  return reply(event,400,{message:'Unknown laser storage action.'});
 }catch(error){
  const status=Number(error.status)||500;
  console.error('laser-asset-storage',status,error.message);
  return reply(event,status,{message:status>=500?'Laser asset operation failed; check configuration and logs.':error.message});
 }
}
