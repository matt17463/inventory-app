import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const origin='https://inventory.skilledcrafting.com';
const userId='11111111-1111-4111-8111-111111111111';
async function listen(server){
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 return server.address().port;
}
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});

test('workshop gateway enforces authorization, caller-scoped retrieval and actual model readiness',async t=>{
 let allowRole=true,hasSources=true,modelMode='ready';
 const queries=[],chats=[];
 const database=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/auth/v1/user'){
   const ok=req.headers.authorization==='Bearer runtime-staff-token';
   res.statusCode=ok?200:401;
   res.end(JSON.stringify(ok?{id:userId,aud:'authenticated',role:'authenticated'}:{message:'Invalid session'}));return;
  }
  if(url.pathname==='/rest/v1/rpc/sc_internal_access_allowed'){
   res.end(JSON.stringify(allowRole));return;
  }
  queries.push({path:url.pathname,authorization:req.headers.authorization});
  if(url.pathname==='/rest/v1/sc_knowledge_chunks'){
   res.end(JSON.stringify(hasSources?[{content:'Use the manufacturer maintenance schedule.',page_number:12,
    source:{title:'Runtime fixture manual',source_key:'knowledge/manuals/fixture.pdf',status:'indexed'}}]:[]));return;
  }
  if(url.pathname==='/rest/v1/sc_creative_knowledge_documents'){res.end('[]');return;}
  res.statusCode=404;res.end('{}');
 });
 const databasePort=await listen(database);
 t.after(()=>close(database));
 const model=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(modelMode==='offline'){res.statusCode=503;res.end('{}');return;}
  if(req.url==='/api/tags'){
   res.end(JSON.stringify({models:modelMode==='missing'?[]:[{name:'runtime-model:latest'}]}));return;
  }
  const parts=[];for await(const part of req)parts.push(part);
  chats.push(JSON.parse(Buffer.concat(parts).toString()));
  res.end(JSON.stringify({message:{content:modelMode==='empty'?'':'A verified fixture answer [M1].'}}));
 });
 const modelPort=await listen(model);
 let modelClosed=false;
 t.after(async()=>{if(!modelClosed)await close(model);});
 const reservation=createServer();
 const gatewayPort=await listen(reservation);
 await close(reservation);
 const gateway=spawn(process.execPath,['scripts/local-knowledge-agent.mjs'],{
  cwd:new URL('../../',import.meta.url),
  env:{PATH:process.env.PATH,SC_LOCAL_AI_PORT:String(gatewayPort),SC_LOCAL_AI_ORIGIN:origin,
   SC_LOCAL_AI_MODEL:'runtime-model',SC_OLLAMA_URL:`http://127.0.0.1:${modelPort}`,
   SUPABASE_URL:`http://127.0.0.1:${databasePort}`,SUPABASE_ANON_KEY:'runtime-public-key'},
  stdio:['ignore','pipe','pipe']
 });
 let logs='';gateway.stdout.on('data',data=>{logs+=data;});gateway.stderr.on('data',data=>{logs+=data;});
 t.after(async()=>{if(gateway.exitCode===null){gateway.kill();await once(gateway,'exit');}});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Gateway did not start: '+logs)),8000);
  gateway.stdout.on('data',()=>{if(logs.includes('listening on')){clearTimeout(timer);resolve();}});
  gateway.once('error',error=>{clearTimeout(timer);reject(error);});
  gateway.once('exit',code=>{clearTimeout(timer);reject(Error('Gateway exited: '+code+' '+logs));});
 });
 const base=`http://127.0.0.1:${gatewayPort}`;
 async function request(path,{token='runtime-staff-token',body,requestOrigin=origin,method='POST'}={}){
  return fetch(base+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',
   ...(token?{Authorization:'Bearer '+token}:{})},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body||{})}:{})});
 }
 await t.test('configured and installed model reports ready',async()=>{
  const r=await request('/health',{method:'GET'});assert.equal(r.status,200);assert.equal((await r.json()).connected,true);
 });
 await t.test('missing installed model and unavailable daemon report 503',async()=>{
  for(const mode of ['missing','offline']){
   modelMode=mode;const r=await request('/health',{method:'GET'});
   assert.equal(r.status,503);assert.equal((await r.json()).connected,false);
  }
  modelMode='ready';
 });
 await t.test('other origins and unauthenticated or inactive users are denied before inference',async()=>{
  assert.equal((await request('/ask',{requestOrigin:'https://example.invalid'})).status,403);
  assert.equal((await request('/ask',{token:''})).status,401);
  assert.equal((await request('/ask',{token:'invalid-session'})).status,401);
  allowRole=false;assert.equal((await request('/ask')).status,403);allowRole=true;
  assert.equal(chats.length,0);
 });
 await t.test('retrieval uses caller authorization and preserves page citations',async()=>{
  const r=await request('/ask',{body:{question:'maintenance schedule'}});assert.equal(r.status,200);
  const result=await r.json();assert.equal(result.citations[0].page,12);assert.equal(result.citations[0].title,'Runtime fixture manual');
  assert(queries.length>=2&&queries.every(query=>query.authorization==='Bearer runtime-staff-token'));
  assert(chats[0].messages[1].content.includes('page 12'));
 });
 await t.test('missing source returns an honest answer without calling the model',async()=>{
  hasSources=false;const count=chats.length;
  const r=await request('/ask',{body:{question:'nonexistent fixture information'}});
  const result=await r.json();assert.equal(r.status,200);assert.equal(result.model,'not_used');
  assert.deepEqual(result.citations,[]);assert.equal(chats.length,count);hasSources=true;
 });
 await t.test('package copy remains an unapproved draft',async()=>{
  const r=await request('/package-copy',{body:{name:'Fixture wedding package',products:['Engraved sign']}});
  assert.equal(r.status,200);assert.equal((await r.json()).approved,false);
 });
 await t.test('malformed and nonobject request JSON is rejected',async()=>{
  for(const body of ['{','null','[]'])assert.equal((await request('/ask',{body})).status,400);
 });
 await t.test('model HTTP failure and empty response return explicit unavailable errors',async()=>{
  for(const mode of ['offline','empty']){
   modelMode=mode;const r=await request('/ask',{body:{question:'maintenance schedule'}});
   assert.equal(r.status,503);assert.match((await r.json()).error,/offline or unavailable/);
  }
 });
 await t.test('stopping Ollama returns unavailable for health and generation without fallback',async()=>{
  await close(model);modelClosed=true;
  assert.equal((await request('/health',{method:'GET'})).status,503);
  const r=await request('/package-copy',{body:{name:'Fixture wedding package',products:['Engraved sign']}});
  assert.equal(r.status,503);assert.match((await r.json()).error,/offline or unavailable/);
  assert(!logs.includes('runtime-staff-token'));assert(!logs.includes('maintenance schedule'));
 });
});
