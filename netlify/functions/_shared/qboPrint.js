// QuickBooks Online read-only invoice source with encrypted, rotated OAuth tokens.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const clean=v=>String(v??'').trim();
const key=()=>{
 const raw=clean(process.env.SC_QBO_PRINT_ENCRYPTION_KEY);
 if(!/^[a-f0-9]{64}$/i.test(raw))throw Error('QBO token encryption key is not configured (64 hex characters).');
 return Buffer.from(raw,'hex');
};
export function encryptToken(value){
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key(),iv);
 const encrypted=Buffer.concat([cipher.update(clean(value),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
export function decryptToken(value){
 const buf=Buffer.from(clean(value),'base64');
 if(buf.length<29)throw Error('Invalid encrypted OAuth token.');
 const decipher=createDecipheriv('aes-256-gcm',key(),buf.subarray(0,12));
 decipher.setAuthTag(buf.subarray(12,28));
 return Buffer.concat([decipher.update(buf.subarray(28)),decipher.final()]).toString('utf8');
}
const clientId=()=>clean(process.env.SC_QBO_CLIENT_ID);
const clientSecret=()=>clean(process.env.SC_QBO_CLIENT_SECRET);
export function qboReady(){return !!(clientId()&&clientSecret()&&/^[a-f0-9]{64}$/i.test(clean(process.env.SC_QBO_PRINT_ENCRYPTION_KEY)));}
export async function exchangeCode({code,redirectUri,refreshToken}){
 if(!qboReady())throw Error('QuickBooks OAuth application credentials are not configured.');
 const params=new URLSearchParams(refreshToken?{grant_type:'refresh_token',refresh_token:refreshToken}:{
  grant_type:'authorization_code',code,redirect_uri:redirectUri});
 const response=await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',{
  method:'POST',headers:{Authorization:'Basic '+Buffer.from(clientId()+':'+clientSecret()).toString('base64'),
   'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
  body:params.toString(),signal:AbortSignal.timeout(15000),
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.access_token||!body.refresh_token)throw Error('Intuit token exchange failed (HTTP '+response.status+'). Reconnect QuickBooks.');
 return body;
}
export async function readQboConnection(supabase){
 const {data,error}=await supabase.from('sc_qbo_print_connection').select('*').eq('id',1).maybeSingle();
 if(error)throw Error('QuickBooks connection storage unavailable; check print integration migration.');
 return data;
}
export async function saveQboConnection(supabase,{realmId,tokens,version}){
 if(!/^\d{1,30}$/.test(String(realmId)))throw Error('QuickBooks company realm ID is invalid.');
 const record={id:1,realm_id:String(realmId),encrypted_access_token:encryptToken(tokens.access_token),
  encrypted_refresh_token:encryptToken(tokens.refresh_token),
  access_expires_at:new Date(Date.now()+Math.max(60,Number(tokens.expires_in||3600)-90)*1000).toISOString(),
  token_version:Number(version||0)+1,updated_at:new Date().toISOString()};
 if(version==null){
  const {error}=await supabase.from('sc_qbo_print_connection').upsert(record,{onConflict:'id'});
  if(error)throw Error('Could not securely save QuickBooks tokens.');
  return record;
 }
 const {data,error}=await supabase.from('sc_qbo_print_connection').update(record)
  .eq('id',1).eq('token_version',version).select('id').maybeSingle();
 if(error||!data)throw Error('QuickBooks credentials changed concurrently; retry invoice lookup.');
 return record;
}
async function bearer(supabase){
 let record=await readQboConnection(supabase);
 if(!record)throw Error('QuickBooks account not connected. Connect it from Print Center.');
 if(new Date(record.access_expires_at).getTime()>Date.now()+60000)
  return {token:decryptToken(record.encrypted_access_token),realm:record.realm_id};
 const tokens=await exchangeCode({refreshToken:decryptToken(record.encrypted_refresh_token)});
 try{await saveQboConnection(supabase,{realmId:record.realm_id,tokens,version:record.token_version});}
 catch{
  record=await readQboConnection(supabase);
  if(new Date(record.access_expires_at).getTime()<=Date.now())throw Error('QBO token refresh conflict; try again.');
  return {token:decryptToken(record.encrypted_access_token),realm:record.realm_id};
 }
 return {token:tokens.access_token,realm:record.realm_id};
}
function escapeQboQuery(value){
 const s=clean(value);
 if(!s||s.length>60)throw Error('A valid QuickBooks invoice number is needed.');
 return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
export function reconcileQboInvoice(manual,invoice){
 const doc=clean(invoice.DocNumber);
 const invoiceLines=(Array.isArray(invoice.Line)?invoice.Line:[]).filter(l=>l.DetailType==='SalesItemLineDetail'||l.DetailType==='DiscountLineDetail');
 const lines=invoiceLines.map((l,index)=>({
  id:l.Id||index+1,name:clean(l.Description||l.SalesItemLineDetail?.ItemRef?.name||l.DetailType),
  sku:'',quantity:Number(l.SalesItemLineDetail?.Qty||1),
  unitPrice:l.SalesItemLineDetail?.UnitPrice!=null?Number(l.SalesItemLineDetail.UnitPrice):null,
  total:l.DetailType==='DiscountLineDetail'?-Math.abs(Number(l.Amount||0)):Number(l.Amount||0),
  metadata:[],
 }));
 const tax=Number(invoice.TxnTaxDetail?.TotalTax||0);
 const discount=invoiceLines.filter(x=>x.DetailType==='DiscountLineDetail').reduce((n,x)=>n+Number(x.Amount||0),0);
 const subtotal=invoiceLines.filter(x=>x.DetailType==='SalesItemLineDetail').reduce((n,x)=>n+Number(x.Amount||0),0);
 const total=Number(invoice.TotalAmt);
 const manualTotal=Number(manual.total);
 const matches=Number.isFinite(total)&&Number.isFinite(manualTotal)&&Math.abs(total-manualTotal)<=0.02;
 const paid=Number(invoice.Balance||0)<=0.01;
 return {
  ...manual,source:'quickbooks_manual',reference:doc,lines,subtotal,
  discount,shipping:0,tax,total,paid,
  financialVerified:matches,
  warnings:matches?[]:[
   'QuickBooks source total ('+total.toFixed(2)+') differs from linked manual order total ('+
      (Number.isFinite(manualTotal)?manualTotal.toFixed(2):'missing')+'). Reconcile the order before printing a customer copy.'
  ],
  qboInvoiceId:clean(invoice.Id),qboSyncToken:clean(invoice.SyncToken),
 };
}
export async function verifiedQuickBooksInvoice(supabase,manual){
 const number=escapeQboQuery(manual.reference);
 const {token,realm}=await bearer(supabase);
 const q="select * from Invoice where DocNumber = '"+number+"' maxresults 2";
 const host=process.env.SC_QBO_ENVIRONMENT==='sandbox'?'https://sandbox-quickbooks.api.intuit.com':'https://quickbooks.api.intuit.com';
 const url=host+'/v3/company/'+encodeURIComponent(realm)+'/query?query='+encodeURIComponent(q)+'&minorversion=75';
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('QuickBooks invoice lookup failed (HTTP '+response.status+'). Reconnect or verify API permissions.');
 const body=await response.json();
 const matches=body.QueryResponse?.Invoice||[];
 if(matches.length!==1||clean(matches[0].DocNumber)!==manual.reference)
  throw Error(matches.length?'QuickBooks invoice number is ambiguous.':'This invoice number was not found in QuickBooks.');
 return reconcileQboInvoice(manual,matches[0]);
}
