import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {encryptToken,decryptToken,reconcileQboInvoice,verifiedQuickBooksInvoice,
 disconnectQboConnection,validateQboRedirect} from '../../netlify/functions/_shared/qboPrint.js';
import {validQboStateCookie,consumeQboOAuthState} from '../../netlify/functions/qbo-print-connect.js';

const manual={reference:'QA-100',total:110,customerName:'School',currency:'USD'};
const invoice=()=>({Id:'1',DocNumber:'QA-100',CustomerRef:{value:'42',name:'School'},
 TotalAmt:110,Balance:0,CurrencyRef:{value:'USD'},TxnDate:'2026-10-22',
 Line:[{Id:'1',DetailType:'SalesItemLineDetail',Amount:120,SalesItemLineDetail:{Qty:2,UnitPrice:60}},
 {Id:'2',DetailType:'DiscountLineDetail',Amount:20}],TxnTaxDetail:{TotalTax:10}});
const discovery={authorization_endpoint:'https://appcenter.intuit.com/connect/oauth2',
 token_endpoint:'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
 revocation_endpoint:'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'};
function fakeDb(row,states=[]){
 const db={row,states,revocations:0};
 db.from=table=>{
  let operation='select',patch,filters=[];
  const query={select(){return query;},eq(k,v){filters.push([k,v]);return query;},
   gt(k,v){filters.push([k,v,'gt']);return query;},not(){return query;},
   update(value){operation='update';patch=value;return query;},
   delete(){operation='delete';return query;},
   upsert(value){db.row=value;return Promise.resolve({error:null});},
   async maybeSingle(){
    if(table==='sc_qbo_print_oauth_states'){
     const entry=db.states.find(state=>filters.every(([k,v,op])=>op==='gt'?state[k]>v:state[k]===v));
     if(entry&&operation==='delete')db.states=db.states.filter(v=>v!==entry);
     return {data:entry||null,error:null};
    }
    if(!db.row||!filters.every(([k,v])=>db.row[k]===v))return {data:null,error:null};
    const found=db.row;
    if(operation==='update')db.row={...db.row,...patch};
    if(operation==='delete')db.row=null;
    return {data:operation==='select'?found:{id:found.id},error:null};
   },
   then(resolve,reject){
    if(table==='sc_qbo_print_oauth_states'&&operation==='delete'){db.states=[];return Promise.resolve({error:null}).then(resolve,reject);}
    return query.maybeSingle().then(resolve,reject);
   }};
  return query;
 };
 return db;
}
async function withOAuth(run){
 const previous={...process.env},fetchBefore=globalThis.fetch;
 process.env.SC_QBO_PRINT_ENCRYPTION_KEY=randomBytes(32).toString('hex');
 process.env.SC_QBO_CLIENT_ID='synthetic-client';process.env.SC_QBO_CLIENT_SECRET='synthetic-secret';
 process.env.SC_QBO_ENVIRONMENT='sandbox';
 try{await run();}finally{
  globalThis.fetch=fetchBefore;
  for(const key of ['SC_QBO_PRINT_ENCRYPTION_KEY','SC_QBO_CLIENT_ID','SC_QBO_CLIENT_SECRET','SC_QBO_ENVIRONMENT']){
   if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];
  }
 }
}
function connectedDb(expired=false){return fakeDb({id:1,realm_id:'123',token_version:1,
 encrypted_access_token:encryptToken('synthetic-access'),encrypted_refresh_token:encryptToken('synthetic-refresh'),
 access_expires_at:new Date(Date.now()+(expired?-10000:3600000)).toISOString()});}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('original QBO customer, date, discounts, native tax, partial payment and balance are preserved',()=>{
 const input=invoice();input.Balance=40;input.CustomerRef.name=' SCHOOL ';
 const result=reconcileQboInvoice(manual,input);
 assert.equal(result.financialVerified,true);assert.equal(result.customerName,'SCHOOL');
 assert.equal(result.date,'2026-10-22');assert.equal(result.balance,40);assert.equal(result.amountPaid,70);
 assert.equal(result.status,'Partially paid');assert.equal(result.paid,false);
 assert.equal(result.subtotal-result.discount+result.tax,result.total);
});
test('missing, null, blank and invalid balances block customer copies and never imply paid',()=>{
 for(const value of [undefined,null,'',-1,111,'invalid',true]){
  const result=reconcileQboInvoice(manual,{...invoice(),Balance:value});
  assert.equal(result.financialVerified,false);assert.equal(result.paid,false);
 }
});
test('missing totals never coerce to zero; customer or invoice identity mismatch blocks verification',()=>{
 for(const patch of [{TotalAmt:null},{TotalAmt:''},{CustomerRef:{value:'99',name:'Other customer'}},
  {CustomerRef:{value:'42'}},{DocNumber:'OTHER'},{CurrencyRef:{value:'CAD'}}]){
  assert.equal(reconcileQboInvoice(manual,{...invoice(),...patch}).financialVerified,false);
 }
});
test('inconsistent line arithmetic and unsupported grouped lines block verification',()=>{
 const bad=invoice();bad.Line[0].Amount=119;
 assert.equal(reconcileQboInvoice(manual,bad).financialVerified,false);
 assert.equal(reconcileQboInvoice(manual,{...invoice(),Line:[{DetailType:'GroupLineDetail',Amount:100}]}).financialVerified,false);
});
test('authenticated encryption round-trips tokens and rejects tampering',()=>withOAuth(async()=>{
 const encoded=encryptToken('synthetic-token');assert.equal(decryptToken(encoded),'synthetic-token');
 const changed=Buffer.from(encoded,'base64');changed[28]^=1;
 assert.throws(()=>decryptToken(changed.toString('base64')));
}));
test('OAuth callback rejects a missing, mismatched, or malformed browser cookie',()=>{
 const state='a'.repeat(64),digest=createHash('sha256').update(state).digest('hex');
 assert.equal(validQboStateCookie({headers:{cookie:'sc_qbo_oauth_state='+digest}},state),true);
 assert.equal(validQboStateCookie({headers:{}},state),false);
 assert.equal(validQboStateCookie({headers:{cookie:'sc_qbo_oauth_state='+'b'.repeat(64)}},state),false);
 assert.equal(validQboStateCookie({headers:{cookie:'sc_qbo_oauth_state='+digest}},'bad'),false);
});
test('OAuth state is single-use and rejects expired state',async()=>{
 const state='a'.repeat(64),digest=createHash('sha256').update(state).digest('hex');
 const db=fakeDb(null,[{state_hash:digest,expires_at:new Date(Date.now()+60000).toISOString()}]);
 assert.equal(await consumeQboOAuthState(db,state),true);assert.equal(await consumeQboOAuthState(db,state),false);
 db.states=[{state_hash:digest,expires_at:new Date(Date.now()-60000).toISOString()}];
 assert.equal(await consumeQboOAuthState(db,state),false);
});
test('callback configuration rejects credentials, fragments, insecure origins and wrong paths',()=>{
 assert.equal(validateQboRedirect('https://app.example/.netlify/functions/qbo-print-connect'),
  'https://app.example/.netlify/functions/qbo-print-connect');
 for(const url of ['http://app.example/.netlify/functions/qbo-print-connect','https://user:pass@app.example/.netlify/functions/qbo-print-connect',
 'https://app.example/.netlify/functions/qbo-print-connect#x','https://app.example/wrong'])assert.throws(()=>validateQboRedirect(url));
});
test('one expired-access response refreshes once, rotates encrypted credentials and retries the read',()=>withOAuth(async()=>{
 const db=connectedDb();let reads=0,refreshes=0;
 globalThis.fetch=async(url,options={})=>{
  if(url.includes('openid_configuration'))return json(discovery);
  if(url===discovery.token_endpoint){refreshes++;assert.equal(options.method,'POST');
   return json({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:3600});}
  assert.equal(options.method,undefined);assert.match(url,/sandbox-quickbooks/);
  return ++reads===1?json({},401):json({QueryResponse:{Invoice:[invoice()]}});
 };
 assert.equal((await verifiedQuickBooksInvoice(db,manual)).financialVerified,true);
 assert.equal(refreshes,1);assert.equal(reads,2);assert.equal(db.row.token_version,2);
 assert.equal(decryptToken(db.row.encrypted_refresh_token),'rotated-refresh');
}));
test('repeated unauthorized responses do not loop',()=>withOAuth(async()=>{
 const db=connectedDb();let reads=0,refreshes=0;
 globalThis.fetch=async url=>{
  if(url.includes('openid_configuration'))return json(discovery);
  if(url===discovery.token_endpoint){refreshes++;return json({access_token:'next',refresh_token:'next-refresh',expires_in:3600});}
  reads++;return json({},401);
 };
 await assert.rejects(verifiedQuickBooksInvoice(db,manual),/401/);assert.equal(reads,2);assert.equal(refreshes,1);
}));
test('expired refresh token / invalid_grant fails safely with reconnect guidance',()=>withOAuth(async()=>{
 const db=connectedDb(true),before=db.row.encrypted_refresh_token;
 globalThis.fetch=async url=>url.includes('openid_configuration')?json(discovery):json({error:'invalid_grant'},400);
 await assert.rejects(verifiedQuickBooksInvoice(db,manual),/Reconnect QuickBooks/);
 assert.equal(db.row.encrypted_refresh_token,before);
}));
test('missing or ambiguous original invoices never verify',()=>withOAuth(async()=>{
 const db=connectedDb();
 for(const matches of [[],[invoice(),invoice()],[{...invoice(),DocNumber:'wrong'}]]){
  globalThis.fetch=async()=>json({QueryResponse:{Invoice:matches}});
  await assert.rejects(verifiedQuickBooksInvoice(db,manual),/not found|ambiguous/);
 }
}));
test('disconnect revokes the refresh token before removing stored credentials and pending consent states',()=>withOAuth(async()=>{
 const db=connectedDb();db.states=[{state_hash:'pending'}];let revoked=false;
 globalThis.fetch=async(url,options)=>{
  if(url.includes('openid_configuration'))return json(discovery);
  assert.equal(url,discovery.revocation_endpoint);assert.equal(options.method,'POST');
  assert.equal(JSON.parse(options.body).token,'synthetic-refresh');assert.ok(db.row);assert.equal(db.states.length,0);
  revoked=true;return json({});
 };
 await disconnectQboConnection(db);assert.equal(revoked,true);assert.equal(db.row,null);
}));
test('failed revocation retains encrypted credentials for retry',()=>withOAuth(async()=>{
 const db=connectedDb();
 globalThis.fetch=async url=>url.includes('openid_configuration')?json(discovery):json({},503);
 await assert.rejects(disconnectQboConnection(db),/could not revoke/);assert.ok(db.row);
}));
test('expired access tokens refresh before the first invoice read',()=>withOAuth(async()=>{
 const db=connectedDb(true);let refreshes=0,reads=0;
 globalThis.fetch=async(url,options={})=>{
  if(url.includes('openid_configuration'))return json(discovery);
  if(url===discovery.token_endpoint){refreshes++;return json({access_token:'next',refresh_token:'next-refresh',expires_in:3600});}
  assert.equal(refreshes,1);assert.equal(options.headers.Authorization,'Bearer next');reads++;
  return json({QueryResponse:{Invoice:[invoice()]}});
 };
 assert.equal((await verifiedQuickBooksInvoice(db,manual)).financialVerified,true);
 assert.equal(refreshes,1);assert.equal(reads,1);
}));
test('discovery rejects unexpected OAuth destinations before credentials can be sent',()=>withOAuth(async()=>{
 const fresh=await import('../../netlify/functions/_shared/qboPrint.js?discovery-security-test');
 globalThis.fetch=async()=>json({...discovery,token_endpoint:'https://untrusted.example/token'});
 await assert.rejects(fresh.qboOAuthEndpoints(),/administrator review/);
}));
