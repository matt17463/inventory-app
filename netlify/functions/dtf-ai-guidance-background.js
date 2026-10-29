import {authorizeEmployee,jsonResponse,auditFunctionSecurity} from './_shared/security.js';
import {decodeImageEvent,generateImageGuidance,IMAGE_MODELS} from './dtf-ai-guidance.js';
import {claimImageJob,finishImageJob,imageJobError} from './_shared/dtfAiJobs.js';
import {validateGuidance} from '../../src/lib/dtfMaskGuidance.js';
export function createBackgroundHandler({authorize=authorizeEmployee,audit=auditFunctionSecurity,generate=generateImageGuidance,claim=claimImageJob,finish=finishImageJob,env=process.env}={}){
 return async event=>{
  const response=(status,payload)=>jsonResponse(status,payload,event);
  if(event.httpMethod!=='POST')return response(405,{message:'Use POST.'});
  const auth=await authorize(event,{functionName:'dtf-ai-guidance-background',allowedRoles:['admin','manager','operator']});
  if(!auth.ok)return response(auth.statusCode,{message:auth.message});
  let job;
  try{
   const {body,bytes,thumbnail}=await decodeImageEvent(event);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.job_id||''))return response(400,{message:'Invalid analysis job.'});
   job=await claim(auth.supabase,body.job_id,auth.user.id,bytes);
   if(!job)return response(200,{duplicate:true});
   if(env.DTF_GEMINI_ENABLED!=='true'||!env.GEMINI_API_KEY||!IMAGE_MODELS.has(job.model))throw Error('Provider unavailable');
   const guidance=validateGuidance(await generate(thumbnail,'image/png',{key:env.GEMINI_API_KEY,model:job.model,signal:AbortSignal.timeout(180000)}));
   const provenance={provider:'gemini',model:job.model,method:'semantic-points-connected-color-v1',analysisJobId:job.id,createdAt:new Date().toISOString()};
   await finish(auth.supabase,job.id,auth.user.id,{status:'complete',guidance,provenance,error_code:null});
   await audit({functionName:'dtf-ai-guidance',action:'image_guidance',outcome:'success',userId:auth.user.id,role:auth.role,event:{headers:event.headers},metadata:{model:job.model,points:guidance.points.length,job_id:job.id}});
   return response(200,{complete:true});
  }catch(error){
   const code=imageJobError(error);
   if(job)await finish(auth.supabase,job.id,auth.user.id,{status:'failed',error_code:code}).catch(()=>{});
   await audit({functionName:'dtf-ai-guidance',action:'image_guidance',outcome:'failed',userId:auth.user.id,role:auth.role,event:{headers:event.headers},metadata:{code,provider_status:error.providerStatus||null}});
   return response(error.statusCode||502,{message:'Image analysis unavailable. Use local removal.'});
  }
 };
}
export const handler=createBackgroundHandler();
