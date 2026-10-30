import {createServiceClient} from './_shared/security.js';
import {scanManualPrefix} from './_shared/knowledgeManuals.js';
// Netlify scheduled functions are not callable by public URL. Only the dedicated
// knowledge/manuals/ prefix is eligible for indexing.
export const config={schedule:'*/15 * * * *'};
export default async function scheduledManualSync(){
  if(process.env.SC_KNOWLEDGE_AUTO_INDEX_DISABLED==='1')return;
  try{
    const result=await scanManualPrefix(createServiceClient(),{limit:1});
    console.info('Scheduled private manual index',JSON.stringify({checked:result.checked,processed:result.processed,
      results:result.results.map(({status})=>status)}));
  }catch(err){console.error('Scheduled private index error:',err?.message||'error');throw err;}
}