import {createServerSupabaseClient} from './serverSupabase.js';
import {getBearerToken} from './security.js';
import {handler as artworkPreflight} from '../traveler-artwork-preflight.js';

export function employeeDatabase(event){
 const token=getBearerToken(event);
 if(!token)throw Error('Employee authentication is required.');
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Database client configuration is unavailable.');
 // The employee JWT is authoritative, including inside security-definer RPCs.
 return createServerSupabaseClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
}
export async function createVerifiedTraveler(event,{jobId,itemIds,recipeVersionId}){
 const result=await artworkPreflight({...event,httpMethod:'POST',body:JSON.stringify({job_id:jobId,job_item_ids:itemIds,recipe_version_id:recipeVersionId}),isBase64Encoded:false});
 const proof=JSON.parse(result.body||'{}');
 if(result.statusCode!==200||proof.verified!==true)throw Error(proof.message||'Fresh artwork storage verification failed.');
 const {data,error}=await employeeDatabase(event).rpc('sc_create_grouped_traveler',{p_job_id:jobId,p_job_item_ids:itemIds,p_recipe_version_id:recipeVersionId});
 if(error)throw error;
 return data;
}
