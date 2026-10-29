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
// Only Intuit's published discovery endpoint supplies OAuth destinations.
const discoveryUrl='https://developer.api.intuit.com/.well-known/openid_configuration';
const trustedEndpoints={
 authorization_endpoint:'https://appcenter.intuit.com/connect/oauth2',
 token_endpoint:'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
 revocation_endpoint:'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
};
let cachedDiscovery;
export async function qboOAuthEndpoints(){
 if(cachedDiscovery?.expires>Date.now())return cachedDiscovery.endpoints;
 const response=await fetch(discoveryUrl,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Intuit OAuth discovery is unavailable. Try again later.');
 const document=await response.json();
 for(const [name,url] of Object.entries(trustedEndpoints)){
  if(document[name]!==url)throw Error('Intuit OAuth endpoints changed; administrator review required.');
 }
 const endpoints={...trustedEndpoints};
 cachedDiscovery={endpoints,expires:Date.now()+3600000};
 return endpoints;
}
export function validateQboRedirect(value){
 let url;
 try{url=new URL(clean(value));}catch{throw Error('QuickBooks HTTPS callback is not configured.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    url.pathname!=='/.netlify/functions/qbo-print-connect')
  throw Error('QuickBooks HTTPS callback configuration is invalid.');
 return url.href;
}
export async function exchangeCode({code,redirectUri,refreshToken}){
 if(!qboReady())throw Error('QuickBooks OAuth application credentials are not configured.');
 const params=new URLSearchParams(refreshToken?{grant_type:'refresh_token',refresh_token:refreshToken}:{
  grant_type:'authorization_code',code,redirect_uri:validateQboRedirect(redirectUri)});
 const response=await fetch((await qboOAuthEndpoints()).token_endpoint,{
  method:'POST',headers:{Authorization:'Basic '+Buffer.from(clientId()+':'+clientSecret()).toString('base64'),
   'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
  body:params.toString(),redirect:'error',signal:AbortSignal.timeout(15000),
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
async function bearer(supabase,{forceRefresh=false}={}){
 let record=await readQboConnection(supabase);
 if(!record)throw Error('QuickBooks account not connected. Connect it from Print Center.');
 if(!forceRefresh&&new Date(record.access_expires_at).getTime()>Date.now()+60000)
  return {token:decryptToken(record.encrypted_access_token),realm:record.realm_id};
 const tokens=await exchangeCode({refreshToken:decryptToken(record.encrypted_refresh_token)});
 try{await saveQboConnection(supabase,{realmId:record.realm_id,tokens,version:record.token_version});}
 catch{
  record=await readQboConnection(supabase);
  if(!record||!(new Date(record.access_expires_at).getTime()>Date.now()))throw Error('QBO token refresh conflict; try again.');
  return {token:decryptToken(record.encrypted_access_token),realm:record.realm_id};
 }
 return {token:tokens.access_token,realm:record.realm_id};
}
function escapeQboQuery(value){
 const s=clean(value);
 if(!s||s.length>60)throw Error('A valid QuickBooks invoice number is needed.');
 return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
const amount=value=>{
 if(value==null||value===''||typeof value==='boolean')return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
};
const nameKey=value=>clean(value).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
const qboAddress=value=>[value?.Line1,value?.Line2,value?.Line3,value?.Line4,value?.Line5,
 [value?.City,value?.CountrySubDivisionCode,value?.PostalCode].filter(Boolean).join(' '),value?.Country]
 .map(clean).filter(Boolean).join(', ');
export function reconcileQboInvoice(manual,invoice){
 const doc=clean(invoice.DocNumber),warnings=[];
 const customerName=clean(invoice.CustomerRef?.name);
 const customerId=clean(invoice.CustomerRef?.value);
 const invoiceLines=(Array.isArray(invoice.Line)?invoice.Line:[])
  .filter(l=>l.DetailType==='SalesItemLineDetail'||l.DetailType==='DiscountLineDetail');
 if((invoice.Line||[]).some(l=>!['SalesItemLineDetail','DiscountLineDetail','SubTotalLineDetail','DescriptionOnly'].includes(l.DetailType)))
  warnings.push('This QuickBooks invoice contains unsupported line types. Review the original invoice before printing.');
 const lines=invoiceLines.map((l,index)=>({
  id:l.Id||index+1,name:clean(l.Description||l.SalesItemLineDetail?.ItemRef?.name||l.DetailType),
  sku:'',quantity:amount(l.SalesItemLineDetail?.Qty)??1,
  unitPrice:amount(l.SalesItemLineDetail?.UnitPrice),
  total:amount(l.Amount)===null?null:l.DetailType==='DiscountLineDetail'?-Math.abs(amount(l.Amount)):amount(l.Amount),
  metadata:[],
 }));
 const tax=invoice.TxnTaxDetail?.TotalTax==null?0:amount(invoice.TxnTaxDetail.TotalTax);
 const validLines=lines.length>0&&lines.every(l=>l.total!==null&&l.quantity>0);
 const discount=invoiceLines.filter(x=>x.DetailType==='DiscountLineDetail')
  .reduce((n,x)=>n+Math.abs(amount(x.Amount)??0),0);
 const subtotal=invoiceLines.filter(x=>x.DetailType==='SalesItemLineDetail')
  .reduce((n,x)=>n+(amount(x.Amount)??0),0);
 const total=amount(invoice.TotalAmt),manualTotal=amount(manual.total),balance=amount(invoice.Balance);
 if(!doc||doc!==clean(manual.reference))warnings.push('QuickBooks invoice number does not match the linked manual order.');
 if(!customerId||!customerName||!nameKey(manual.customerName)||nameKey(customerName)!==nameKey(manual.customerName))
  warnings.push('QuickBooks customer does not match the linked manual order. Reconcile the customer before printing.');
 if(total===null||manualTotal===null||Math.abs(total-manualTotal)>0.02)
  warnings.push('QuickBooks source total ('+(total===null?'missing':total.toFixed(2))+') differs from linked manual order total ('+
   (manualTotal===null?'missing':manualTotal.toFixed(2))+'). Reconcile the order before printing a customer copy.');
 if(total===null||total<0||balance===null||balance<0||balance>total+0.02)
  warnings.push('QuickBooks payment balance is missing or invalid. Payment must be verified before printing.');
 if(!validLines||tax===null||total===null||Math.abs(subtotal-discount+(tax??0)-(total??0))>0.02)
  warnings.push('QuickBooks line items, discounts and tax do not reconcile to the original total.');
 const currency=clean(invoice.CurrencyRef?.value)||'USD';
 if(currency!==(clean(manual.currency)||'USD')||currency!=='USD')
  warnings.push('QuickBooks invoice currency is not supported for this linked order.');
 const verified=warnings.length===0;
 return {
  ...manual,source:'quickbooks_manual',reference:doc,lines,subtotal,discount,shipping:0,tax,total,
  customerName:customerName||'UNVERIFIED QUICKBOOKS CUSTOMER',customerEmail:clean(invoice.BillEmail?.Address),
  customerPhone:'',date:clean(invoice.TxnDate),currency,
  shipName:customerName,shipAddress:qboAddress(invoice.ShipAddr),billAddress:qboAddress(invoice.BillAddr),
  customerNote:clean(invoice.CustomerMemo?.value),
  balance,amountPaid:total!==null&&balance!==null?Math.max(0,total-balance):null,
  paid:verified&&balance<=0.01,paymentVerified:verified,
  status:verified?(balance<=0.01?'Paid':balance<total?'Partially paid':'Unpaid'):'Unverified',
  financialVerified:verified,warnings,qboCustomerId:customerId,
  qboInvoiceId:clean(invoice.Id),qboSyncToken:clean(invoice.SyncToken),
 };
}
export async function disconnectQboConnection(supabase){
 const record=await readQboConnection(supabase);
 // Invalidate pending consent sessions first so an old callback cannot reconnect.
 const states=await supabase.from('sc_qbo_print_oauth_states').delete().not('state_hash','is',null);
 if(states.error)throw Error('Could not invalidate pending QuickBooks connections. Retry disconnect.');
 if(!record)return;
 const endpoint=(await qboOAuthEndpoints()).revocation_endpoint;
 const response=await fetch(endpoint,{method:'POST',redirect:'error',
  headers:{Authorization:'Basic '+Buffer.from(clientId()+':'+clientSecret()).toString('base64'),
   'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({token:decryptToken(record.encrypted_refresh_token)}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('QuickBooks disconnect could not revoke access. Retry or disconnect from QuickBooks.');
 const result=await supabase.from('sc_qbo_print_connection').delete().eq('id',1)
  .eq('token_version',record.token_version).select('id').maybeSingle();
 if(result.error||!result.data)throw Error('QuickBooks connection changed during disconnect. Refresh and retry.');
}
export async function verifiedQuickBooksInvoice(supabase,manual){
 if(!['production','sandbox'].includes(process.env.SC_QBO_ENVIRONMENT))throw Error('Set the QuickBooks environment explicitly.');
 const number=escapeQboQuery(manual.reference);
 let {token,realm}=await bearer(supabase);
 const q="select * from Invoice where DocNumber = '"+number+"' maxresults 2";
 const host=process.env.SC_QBO_ENVIRONMENT==='sandbox'?'https://sandbox-quickbooks.api.intuit.com':'https://quickbooks.api.intuit.com';
 const url=host+'/v3/company/'+encodeURIComponent(realm)+'/query?query='+encodeURIComponent(q)+'&minorversion=75';
 const read=()=>fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000),redirect:'error'});
 let response=await read();
 if(response.status===401){
  ({token,realm}=await bearer(supabase,{forceRefresh:true}));
  response=await read();
 }
 if(!response.ok)throw Error('QuickBooks invoice lookup failed (HTTP '+response.status+'). Reconnect or verify API permissions.');
 const body=await response.json();
 const matches=body.QueryResponse?.Invoice||[];
 if(matches.length!==1||clean(matches[0].DocNumber)!==manual.reference)
  throw Error(matches.length?'QuickBooks invoice number is ambiguous.':'This invoice number was not found in QuickBooks.');
 return reconcileQboInvoice(manual,matches[0]);
}


// Write-capable endpoint used exclusively by the admin-guarded Product & Event Center.
// OAuth tokens remain encrypted and server-side; POST must never be retried automatically.
export async function qboEventRequest(supabase,{method='GET',path,body}={}){
 if(!['production','sandbox'].includes(process.env.SC_QBO_ENVIRONMENT))throw Error('Explicit QuickBooks environment required.');
 if(!/^\/(?:invoice|query)(?:[/?]|$)/i.test(path||''))throw Error('Unsupported QuickBooks resource.');
 let {token,realm}=await bearer(supabase);
 const host=process.env.SC_QBO_ENVIRONMENT==='sandbox'?'https://sandbox-quickbooks.api.intuit.com':'https://quickbooks.api.intuit.com';
 const url=host+'/v3/company/'+encodeURIComponent(realm)+path;
 const perform=()=>fetch(url,{method,redirect:'error',headers:{Authorization:'Bearer '+token,
  'Content-Type':'application/json',Accept:'application/json'},body:body==null?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(15000)});
 let response=await perform();
 if(response.status===401&&method==='GET'){({token,realm}=await bearer(supabase,{forceRefresh:true}));response=await perform();}
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error('QuickBooks request rejected (HTTP '+response.status+'). Check account configuration and invoice fields.');
 return result;
}
