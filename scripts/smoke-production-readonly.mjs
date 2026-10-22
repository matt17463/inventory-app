// GET-only, externally executable production smoke check. No customer orders, writes,
// customer information, API keys, auth sessions, coupon codes or mutation paths.
import {writeFileSync,mkdirSync} from 'node:fs';

const tests=[
 {id:'app-home',url:'https://inventory.skilledcrafting.com/',expect:'app-html',essential:true},
 {id:'app-integrity-route',url:'https://inventory.skilledcrafting.com/wordpress-integrity',expect:'app-html',essential:true},
 {id:'app-guide-route',url:'https://inventory.skilledcrafting.com/application-guide',expect:'app-html',essential:true},
 {id:'app-audit-report',url:'https://inventory.skilledcrafting.com/documentation-audit-report.json',expect:'report-json',essential:true},
 {id:'integrity-unauthenticated',url:'https://inventory.skilledcrafting.com/.netlify/functions/wordpress-commerce-integrity',expect:'auth-required',essential:true},
 {id:'wordpress-store-directory',url:'https://skilledcrafting.com/find-your-store/',expect:'wp-html',essential:false},
 {id:'wordpress-public-rest',url:'https://skilledcrafting.com/wp-json/',expect:'wp-json',essential:false},
];
const current=new Date().toISOString();
const report={checkedAt:current,mode:'PUBLIC_GET_ONLY',liveOrderWrites:0,credentialAccess:false,netlifyDeployShaVerified:false,results:[]};
const challenge=/cloudflare|captcha|siteground\s+antibot|bot\s+(?:challenge|protection)|access denied|javascript is required to continue/i;

async function check(test){
 const started=Date.now();
 try{
  const response=await fetch(test.url,{method:'GET',redirect:'manual',
   headers:{Accept:test.expect.endsWith('json')?'application/json':'text/html, application/json;q=0.8'},
   signal:AbortSignal.timeout(16000)});
  const type=(response.headers.get('content-type')||'').toLowerCase();
  const body=await response.text();
  const code=response.status;
  let outcome='unverified',detail='';
  if([301,302,303,307,308].includes(code)){
   outcome=test.expect==='auth-required'?'auth-or-redirect':'redirect';
   detail='No redirects followed; cannot confirm destination behavior.';
  }else if(code===429||code===403&&challenge.test(body)){
   outcome='blocked-by-waf';detail='External probe blocked; cannot confirm application behavior.';
  }else if(test.expect==='app-html'){
   const looksApp=type.includes('html')&&(/<html|<!doctype html/i.test(body))&&/(id=["']root["']|type=["']module["']|\/assets\/)/i.test(body);
   outcome=code===200&&looksApp?'pass':'fail';
   detail=code===200?'Expected single-page app HTML.':'Unexpected HTTP status.';
  }else if(test.expect==='report-json'){
   let parsed=null;try{parsed=JSON.parse(body)}catch{}
   outcome=code===200&&parsed?.routeCount>=1&&Array.isArray(parsed?.routes)?'pass':'fail';
   detail=outcome==='pass'?'Documentation coverage report is parseable.':'No valid documentation coverage report.';
  }else if(test.expect==='auth-required'){
   let parsed=null;try{parsed=JSON.parse(body)}catch{}
   if(code===401||code===403){outcome='pass';detail='Unauthenticated GET denied. This does not verify authorized behavior.';}
   else if(code===200&&parsed?.success===true){outcome='fail';detail='SECURITY: unauthenticated diagnostic access reported success.';}
   else{outcome='fail';detail='Unexpected unauthenticated function response; verify Netlify routing.';}
  }else if(test.expect==='wp-html'){
   if(code===200&&type.includes('html')&&!challenge.test(body)){outcome='pass';detail='Public WordPress page returns HTML.';}
   else{outcome='unverified';detail='WordPress page blocked, redirected, or not HTML.';}
  }else if(test.expect==='wp-json'){
   let parsed=null;try{parsed=JSON.parse(body)}catch{}
   if(code===200&&typeof parsed==='object'&&parsed!==null&&Array.isArray(parsed.namespaces)){outcome='pass';detail='Public WordPress REST index readable.';}
   else{outcome='unverified';detail='Public REST index unavailable to automated probe.';}
  }
  return {id:test.id,httpStatus:code,outcome,essential:test.essential,durationMs:Date.now()-started,detail};
 }catch(err){
  return {id:test.id,httpStatus:null,outcome:'unverified',essential:test.essential,
   durationMs:Date.now()-started,detail:'Request failed or timed out: '+(err?.name||'FetchError')};
 }
}
for(const t of tests){report.results.push(await check(t));}
report.summary={
 passed:report.results.filter(r=>r.outcome==='pass').length,
 failed:report.results.filter(r=>r.outcome==='fail').length,
 unverified:report.results.filter(r=>!['pass','fail'].includes(r.outcome)).length,
 productionDeployProven:false,
 note:'Public availability tests cannot prove that the latest Git commit is currently deployed. Netlify release metadata and an authenticated owner refresh remain necessary.'
};
mkdirSync('smoke-report',{recursive:true});
writeFileSync('smoke-report/production-readonly.json',JSON.stringify(report,null,2)+'\n');
for(const r of report.results)console.log(r.id.padEnd(28),String(r.httpStatus??'-').padEnd(5),r.outcome.padEnd(19),r.detail);
console.log('SUMMARY',JSON.stringify(report.summary));
if(report.results.some(r=>r.outcome==='fail'&&r.essential))process.exitCode=1;
