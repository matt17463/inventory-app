import {createHash,randomBytes} from 'node:crypto';
import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {exchangeCode,qboReady,saveQboConnection,readQboConnection} from './_shared/qboPrint.js';
import {createServerSupabaseClient as createClient} from './_shared/serverSupabase.js';
const clean=x=>String(x??'').trim();
const redirect=()=>clean(process.env.SC_QBO_REDIRECT_URI);
const hash=s=>createHash('sha256').update(s).digest('hex');
const responseHtml=(code,message)=>({
 statusCode:code,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  'X-Content-Type-Options':'nosniff'},
 body:'<!doctype html><html><head><title>QuickBooks connection</title></head><body>'+
  '<h2>Skilled Crafting QuickBooks</h2><p>'+message+'</p><p>You may close this window and refresh Print Center.</p></body></html>',
});
function serverClient(){
 const url=clean(process.env.SUPABASE_URL),token=clean(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY);
 if(!url||!token)throw Error('Supabase service configuration missing.');
 return createClient(url,token,{auth:{persistSession:false,autoRefreshToken:false}});
}
export const handler=async event=>{
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod==='GET'){
  const state=clean(event.queryStringParameters?.state),code=clean(event.queryStringParameters?.code);
  const realmId=clean(event.queryStringParameters?.realmId);
  if(event.queryStringParameters?.error||!state||!code||!/^\d{1,30}$/.test(realmId))
   return responseHtml(400,'Authorization was declined or incomplete. No connection was changed.');
  try{
   const db=serverClient();
   const {data,error}=await db.from('sc_qbo_print_oauth_states').delete()
    .eq('state_hash',hash(state)).gt('expires_at',new Date().toISOString()).select('state_hash').maybeSingle();
   if(error||!data)return responseHtml(403,'Connection request expired or already used. Restart from Print Center.');
   const tokens=await exchangeCode({code,redirectUri:redirect()});
   await saveQboConnection(db,{realmId,tokens});
   return responseHtml(200,'QuickBooks account connected for read-only invoice verification.');
  }catch(e){console.warn('QBO OAuth callback failed:',e.message);
   return responseHtml(502,'Connection could not be completed. Check configuration and try again.');}
 }
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'Method not allowed.'},event);
 const auth=await authorizeEmployee(event,{functionName:'qbo-print-connect',allowedRoles:['admin']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
 try{
  const action=JSON.parse(event.body||'{}').action;
  if(action==='status'){
   const row=await readQboConnection(auth.supabase);
   return jsonResponse(200,{success:true,configured:qboReady()&&Boolean(redirect()),connected:Boolean(row),
    environment:process.env.SC_QBO_ENVIRONMENT==='sandbox'?'sandbox':'production',
    realm_present:Boolean(row?.realm_id),access_expires_at:row?.access_expires_at||null},event);
  }
  if(action!=='start')return jsonResponse(400,{success:false,error:'Unknown action.'},event);
  if(!qboReady()||!redirect()||!redirect().startsWith('https://'))
   return jsonResponse(503,{success:false,error:'Set SC_QBO_CLIENT_ID, SC_QBO_CLIENT_SECRET, SC_QBO_PRINT_ENCRYPTION_KEY and SC_QBO_REDIRECT_URI in Netlify.'},event);
  const state=randomBytes(32).toString('hex');
  const {error}=await auth.supabase.from('sc_qbo_print_oauth_states').insert({
   state_hash:hash(state),expires_at:new Date(Date.now()+10*60*1000).toISOString()
  });
  if(error)throw Error('Could not create short-lived OAuth session.');
  const query=new URLSearchParams({client_id:clean(process.env.SC_QBO_CLIENT_ID),
   scope:'com.intuit.quickbooks.accounting',redirect_uri:redirect(),response_type:'code',state});
  return jsonResponse(200,{success:true,authorize_url:'https://appcenter.intuit.com/connect/oauth2?'+query.toString()},event);
 }catch(e){return jsonResponse(502,{success:false,error:e.message||'QuickBooks setup unavailable.'},event);}
};
