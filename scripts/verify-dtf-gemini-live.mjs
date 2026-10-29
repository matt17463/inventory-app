// Netlify-hosted release gate: no secret is copied locally or written to logs/artifacts.
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';
import {generateImageGuidance,IMAGE_MODELS} from '../netlify/functions/dtf-ai-guidance.js';
import {prepareSourceMask} from '../src/lib/dtfMaskGuidance.js';
import {createServiceClient} from '../netlify/functions/_shared/security.js';
import {DTF_DEFAULTS} from '../src/lib/dtfStudioEngine.js';

export async function verifyDtfGeminiLive({env=process.env,fetcher=fetch,generate=generateImageGuidance,checkJobs=async()=>{const db=createServiceClient();const r=await db.from('sc_dtf_ai_jobs').select('id',{head:true,count:'exact'}).limit(1);if(r.error)throw Error('DTF job storage unavailable.');}}={}){
 if(env.DTF_GEMINI_ENABLED!=='true'||env.NETLIFY!=='true'||env.CONTEXT!=='production')return {skipped:true};
 await checkJobs();
 const model=env.GEMINI_IMAGE_MODEL;
 if(!env.GEMINI_API_KEY||!IMAGE_MODELS.has(model))throw Error('DTF live gate: explicit supported image model and server key are required.');
 const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model,{headers:{'x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('DTF live gate: configured model access failed (HTTP '+response.status+'). Production publish blocked.');
 const metadata=await response.json();
 if(metadata.name!=='models/'+model||!metadata.supportedGenerationMethods?.includes('generateContent'))throw Error('DTF live gate: model capability unavailable. Production publish blocked.');
 // Small synthetic fixture only. No customer image, database credential or research tool is sent.
 const width=96,height=96,pixels=Buffer.alloc(width*height*4,255);
 for(let y=24;y<72;y++)for(let x=24;x<72;x++)pixels.set([120,50,10,255],(y*width+x)*4);
 const image=await sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer();
 const guidance=await generate(image,'image/png',{key:env.GEMINI_API_KEY,model,fetcher});
 const mask=prepareSourceMask(pixels,width,height,{...DTF_DEFAULTS,background:'ai',aiGuidance:guidance,removalTolerance:20,maskStrokes:[],regionPoints:[]});
 const center=(48*width+48)*4;
 if(mask.data[3]!==0||mask.data[center+3]!==255||mask.data[center]!==120||mask.report.removed<width*height/2)throw Error('DTF live gate: guidance did not preserve the fixture foreground and remove its background. Production publish blocked.');
 return {skipped:false,asyncStorageVerified:true,provider:'gemini',model,fixture:'synthetic-96-square',removed:mask.report.removed,foregroundPreserved:true,points:guidance.points.length,confidence:guidance.confidence,verifiedAt:new Date().toISOString()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await verifyDtfGeminiLive();console.log('DTF provider release verification: '+JSON.stringify(result));}
 catch(error){console.error('DTF provider release verification FAILED: '+JSON.stringify({providerStatus:error.providerStatus||error.statusCode||0,reason:['TimeoutError','AbortError'].includes(error.name)?'provider_timeout':error.name==='SyntaxError'?'invalid_provider_json':'verification_failed'})+'. No fallback or publish permitted.');process.exitCode=1;}
}
