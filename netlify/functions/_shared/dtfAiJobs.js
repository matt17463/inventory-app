import {createHash,randomUUID} from 'node:crypto';
import {validateGuidance} from '../../../src/lib/dtfMaskGuidance.js';
export const DTF_JOBS='sc_dtf_ai_jobs';
export const imageHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(message,statusCode=503)=>Object.assign(Error(message),{statusCode});
export function imageJobError(error){
 if(['TimeoutError','AbortError'].includes(error?.name))return 'timeout';
 if(error?.statusCode===429)return 'quota';
 return 'provider_unavailable';
}
export async function startImageJob(db,userId,model,bytes,reserve){
 const now=new Date().toISOString(),hash=imageHash(bytes);
 const cleanup=await db.from(DTF_JOBS).delete().lt('expires_at',now);
 if(cleanup.error)throw fail('AI job cleanup is unavailable. Use local removal.');
 const cached=await db.from(DTF_JOBS).select('guidance,provenance').eq('user_id',userId).eq('model',model).eq('request_hash',hash).eq('status','complete').gt('expires_at',now).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(cached.error)throw fail('AI job lookup is unavailable. Use local removal.');
 if(cached.data)return {cached:true,...validateGuidance(cached.data.guidance),provenance:cached.data.provenance};
 await reserve();
 const job={id:randomUUID(),user_id:userId,model,request_hash:hash,status:'queued',expires_at:new Date(Date.now()+300000).toISOString()};
 const result=await db.from(DTF_JOBS).insert(job);
 if(result.error)throw fail(result.error.code==='23505'?'An image analysis is already running. Wait for it to finish or use local removal.':'AI job storage unavailable. Use local removal.',result.error.code==='23505'?429:503);
 return {cached:false,job_id:job.id,expires_at:job.expires_at};
}
export async function claimImageJob(db,id,userId,bytes){
 const result=await db.from(DTF_JOBS).select('id,model,request_hash,status,expires_at').eq('id',id).eq('user_id',userId).maybeSingle();
 if(result.error)throw fail('AI job lookup unavailable.');
 const row=result.data;
 if(!row||new Date(row.expires_at).getTime()<=Date.now())throw fail('AI job unavailable or expired.',404);
 if(row.request_hash!==imageHash(bytes))throw fail('AI job image does not match.',400);
 if(row.status!=='queued')return null;
 const claim=await db.from(DTF_JOBS).update({status:'processing'}).eq('id',id).eq('user_id',userId).eq('status','queued').gt('expires_at',new Date().toISOString()).select('id,model').maybeSingle();
 if(claim.error)throw fail('AI job claim unavailable.');
 return claim.data;
}
export async function finishImageJob(db,id,userId,values){
 const r=await db.from(DTF_JOBS).update(values).eq('id',id).eq('user_id',userId).eq('status','processing').select('id').maybeSingle();
 if(r.error||!r.data)throw fail('AI job result could not be saved.');
}
