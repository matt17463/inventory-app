import {createHash} from 'node:crypto';
import {GetObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {r2BucketName,r2Client,safeObjectKey} from './mockupStorage.js';
const MAX=52_428_800;
export function matchingRevision(asset,revisions){
 return revisions.find(r=>r.artwork_asset_id===asset.id &&
  new Date(r.asset_updated_at).getTime()===new Date(asset.updated_at).getTime() &&
  r.storage_provider===asset.storage_provider && r.storage_bucket===asset.storage_bucket && r.storage_path===asset.storage_path);
}
export async function artworkDigest(database,asset){
 let body,expectedSize;
 if(asset.storage_provider==='r2'){
  if(asset.storage_bucket!==r2BucketName())throw Error('Artwork R2 bucket mismatch.');
  const input={Bucket:asset.storage_bucket,Key:safeObjectKey(asset.storage_path)};
  const head=await r2Client().send(new HeadObjectCommand(input));
  expectedSize=Number(head.ContentLength);
  if(!Number.isSafeInteger(expectedSize)||expectedSize<1||expectedSize>MAX||!head.ETag)throw Error('Artwork size or object identity cannot be verified.');
  const object=await r2Client().send(new GetObjectCommand({...input,IfMatch:head.ETag}));
  body=object.Body;
 }else if(asset.storage_provider==='supabase'){
  const {data,error}=await database.storage.from(asset.storage_bucket).download(asset.storage_path);
  if(error||!data||data.size<1||data.size>MAX)throw Error('Artwork cannot be read for integrity verification.');
  expectedSize=data.size;body=[Buffer.from(await data.arrayBuffer())];
 }else throw Error('Unsupported artwork storage provider.');
 if(!body)throw Error('Artwork content is unavailable.');
 const hash=createHash('sha256');let bytes=0;
 for await(const chunk of body){bytes+=chunk.length;if(bytes>MAX)throw Error('Artwork exceeds the integrity verification limit.');hash.update(chunk);}
 if(bytes!==expectedSize)throw Error('Artwork changed during content verification.');
 return {sha256:hash.digest('hex'),bytes};
}
export async function verifyRegisteredArtwork(database,asset,pin,actor){
 const digest=await artworkDigest(database,asset);
 if(pin.sha256!==digest.sha256||Number(pin.byte_size)!==digest.bytes){
  const {error}=await database.rpc('sc_report_artwork_integrity_failure',{p_asset:asset.id,p_updated_at:asset.updated_at,p_actor:actor,p_expected:pin.sha256,p_actual:digest.sha256});
  if(error)throw error;
  throw Object.assign(Error('Artwork bytes differ from the registered revision. Production is blocked; restore the original or upload and approve a new revision.'),{code:'ARTWORK_INTEGRITY_CHANGED'});
 }
 return digest;
}
