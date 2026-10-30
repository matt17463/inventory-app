import {supabase} from '../supabaseClient';

const fallback=String(import.meta.env.VITE_SC_LOCAL_AI_URL||'').trim().replace(/\/+$/,'');
const allowed=url=>/^https:\/\/[a-z0-9-]+\.tail934ae0\.ts\.net(?::[0-9]{2,5})?$/i.test(url);
let cached=null;
export function localAiConfigured(){return Boolean((cached?.enabled&&allowed(cached.endpoint_url))||allowed(fallback));}
export async function loadLocalAiConnection(){
 const r=await supabase.from('sc_local_ai_connections').select('endpoint_url,enabled').eq('id','primary').maybeSingle();
 if(r.error)throw Error('Could not read private AI settings: '+r.error.message);
 cached=r.data||null;
 return {configured:localAiConfigured(),endpoint:cached?.endpoint_url||fallback,enabled:cached?.enabled||false};
}
export async function saveLocalAiConnection(endpoint,enabled){
 const url=String(endpoint||'').trim().replace(/\/+$/,'');
 if(!allowed(url))throw Error('Use an HTTPS hostname within the approved tail934ae0.ts.net tailnet.');
 const {data}=await supabase.auth.getUser();
 if(!data?.user?.id)throw Error('Sign in again.');
 const r=await supabase.from('sc_local_ai_connections').upsert({id:'primary',endpoint_url:url,enabled:Boolean(enabled),updated_by:data.user.id,updated_at:new Date().toISOString()},{onConflict:'id'}).select('endpoint_url,enabled').single();
 if(r.error)throw Error(r.error.message);
 cached=r.data;return loadLocalAiConnection();
}
export async function localAiCall(path,payload){
 if(!['/ask','/package-copy'].includes(path))throw Error('Unsupported local AI action.');
 const config=await loadLocalAiConnection();
 const endpoint=cached?.enabled&&allowed(cached.endpoint_url)?cached.endpoint_url:allowed(fallback)?fallback:'';
 if(!endpoint)throw Error('Private Tailscale AI gateway is not yet configured or enabled.');
 const {data,error}=await supabase.auth.getSession();
 if(error||!data?.session?.access_token)throw Error('Please sign in again to use local AI.');
 const response=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+data.session.access_token},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Private AI service unavailable. Check Tailscale and Ollama.');
 return result;
}
