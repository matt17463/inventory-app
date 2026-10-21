import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { r2Client, r2BucketName, r2Configured, presignedR2Put, cleanObjectName } from './_shared/mockupStorage.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIMES=new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp'],['application/json','json'],['application/zip','zip'],['image/svg+xml','svg'],['text/csv','csv']]);
const TYPES=new Set(['source','editable','production_zip','proof','cutline','calibration','other']);
const reply=(event,code,payload)=>jsonResponse(code,payload,event);
const validSize=size=>Number.isSafeInteger(Number(size))&&Number(size)>0&&Number(size)<=52428800;
async function projectFor(db,projectId){
  if(!UUID.test(projectId))throw Object.assign(new Error('Invalid UV project ID'),{status:400});
  const {data,error}=await db.from('sc_uv_projects').select('id,status').eq('id',projectId).maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error('UV project not found'),{status:404});
  return data;
}
async function assetFor(db,id,projectId) {
  if(!UUID.test(id)||!UUID.test(projectId))throw Object.assign(new Error('Invalid asset reference'),{status:400});
  const {data,error}=await db.from('sc_uv_assets').select('*').eq('id',id).eq('project_id',projectId).maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error('UV asset not found'),{status:404});
  if(data.storage_bucket!==r2BucketName())throw Object.assign(new Error('Invalid asset bucket'),{status:400});
  if(!data.storage_key.startsWith('uv-studio/'+projectId+'/'))throw Object.assign(new Error('Invalid asset path'),{status:400});
  return data;
}
export async function handler(event){
  if(event.httpMethod==='OPTIONS')return reply(event,204,{});
  if(event.httpMethod!=='POST')return reply(event,405,{message:'Method not allowed'});
  const auth=await authorizeEmployee(event,{functionName:'uv-asset-storage',allowedRoles:['admin','manager','operator','viewer']});
  if(!auth.ok)return reply(event,auth.statusCode,{message:auth.message});
  try{
    if(!r2Configured())return reply(event,503,{message:'UV asset storage needs R2 configured on Netlify.'});
    const body=JSON.parse(event.body||'{}');
    const action=String(body.action||'status');
    if(action==='status')return reply(event,200,{configured:true,provider:'r2',max_size:52428800});
    const projectId=String(body.project_id||'');
    const project=await projectFor(auth.supabase,projectId);
    if(action==='create_upload'){
      if(!['admin','manager','operator'].includes(auth.role)||!['draft','proof'].includes(project.status))return reply(event,403,{message:'Upload requires an editable project and a staff role.'});
      const kind=String(body.asset_kind||''),mime=String(body.mime_type||''),name=cleanObjectName(body.file_name||'asset');
      if(!TYPES.has(kind)||!MIMES.has(mime)||!validSize(body.file_size))return reply(event,400,{message:'Invalid asset type or size (maximum 50 MB).'});
      if(!name.toLowerCase().endsWith('.'+MIMES.get(mime)))return reply(event,400,{message:'File extension and MIME type must match.'});
      const key='uv-studio/'+projectId+'/'+randomUUID()+'/'+name;
      return reply(event,200,{provider:'r2',storage_key:key,bucket:r2BucketName(),asset_kind:kind,mime_type:mime,
        upload_url:await presignedR2Put({key,contentType:mime,expiresIn:900}),expires_in:900});
    }
    if(action==='finalize'){
      if(!['admin','manager','operator'].includes(auth.role)||!['draft','proof'].includes(project.status))return reply(event,403,{message:'Project is no longer editable.'});
      const key=String(body.storage_key||''),kind=String(body.asset_kind||''),mime=String(body.mime_type||''),name=String(body.file_name||'').slice(0,180);
      if(!UUID.test(projectId)||!/^uv-studio\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-z0-9-]{1,90}\.(png|jpg|webp|json|zip|svg|csv)$/.test(key)
        ||!key.startsWith('uv-studio/'+projectId+'/')||!TYPES.has(kind)||!MIMES.has(mime)||!validSize(body.file_size))
        return reply(event,400,{message:'Invalid asset metadata'});
      const object=await r2Client().send(new HeadObjectCommand({Bucket:r2BucketName(),Key:key}));
      if(Number(object.ContentLength)!==Number(body.file_size)||object.ContentType!==mime)return reply(event,400,{message:'Uploaded R2 object did not match declared content and size.'});
      const {data,error}=await auth.supabase.from('sc_uv_assets').insert({
        project_id:projectId,asset_kind:kind,file_name:name||key.split('/').at(-1),mime_type:mime,storage_bucket:r2BucketName(),
        storage_key:key,file_size:Number(body.file_size),etag:String(object.ETag||'').replace(/"/g,''),
        notes:String(body.notes||'').slice(0,2000),created_by:auth.user.id
      }).select('*').single();
      if(error)throw error;
      return reply(event,200,{asset:data});
    }
    if(action==='list'){
      const {data,error}=await auth.supabase.from('sc_uv_assets').select('id,project_id,file_name,asset_kind,mime_type,file_size,created_at,notes')
        .eq('project_id',projectId).order('created_at',{ascending:false}).limit(100);
      if(error)throw error;
      return reply(event,200,{assets:data||[]});
    }
    if(action==='download'||action==='read_inline'){
      const asset=await assetFor(auth.supabase,String(body.asset_id||''),projectId);
      if(action==='download'){
        const url=await getSignedUrl(r2Client(),new GetObjectCommand({Bucket:r2BucketName(),Key:asset.storage_key}),{expiresIn:300});
        return reply(event,200,{url,expires_in:300,filename:asset.file_name});
      }
      // Same-origin fallback for small editable projects. Keeps R2 private without depending on browser GET CORS.
      if(asset.asset_kind!=='editable'||asset.mime_type!=='application/json'||asset.file_size>4200000)
        return reply(event,413,{message:'Editable state is too large for inline restore. Use the signed download and import the JSON file.'});
      const obj=await r2Client().send(new GetObjectCommand({Bucket:r2BucketName(),Key:asset.storage_key}));
      const bytes=Buffer.from(await obj.Body.transformToByteArray());
      if(bytes.length!==asset.file_size)return reply(event,409,{message:'Stored file size changed unexpectedly'});
      return reply(event,200,{text:bytes.toString('utf8')});
    }
    return reply(event,400,{message:'Unknown UV storage action.'});
  } catch(error){
    const status=error.status||500;
    return reply(event,status,{message:status===500?'UV cloud storage operation failed. Verify R2 and data permissions.':error.message});
  }
}
