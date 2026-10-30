import {supabase} from '../supabaseClient';

const configured=String(import.meta.env.VITE_SC_LOCAL_AI_URL||'').trim().replace(/\/+$/,'');
export function localAiConfigured(){return /^https:\/\//i.test(configured);}
export async function localAiCall(path,payload){
 if(!localAiConfigured())throw Error('Local AI gateway is not yet connected. Configure the private Tailscale HTTPS endpoint in VITE_SC_LOCAL_AI_URL.');
 const {data,error}=await supabase.auth.getSession();
 if(error||!data?.session?.access_token)throw Error('Please sign in again to use local AI.');
 const response=await fetch(configured+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+data.session.access_token},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Private AI service unavailable. Check Tailscale and Ollama.');
 return result;
}