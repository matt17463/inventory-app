import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {PGlite} from '@electric-sql/pglite';
import {startImageJob,claimImageJob,finishImageJob,imageHash} from '../../netlify/functions/_shared/dtfAiJobs.js';
import {createBackgroundHandler} from '../../netlify/functions/dtf-ai-guidance-background.js';
const uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const png=await sharp({create:{width:20,height:20,channels:4,background:'#fff'}}).png().toBuffer();
const points={confidence:.9,points:[{kind:'remove',x:0,y:0},{kind:'keep',x:.5,y:.5}]};
// In-memory PostgREST boundary; actual grants and RLS are tested in PostgreSQL below.
function dbFake(){const rows=[];let inserts=0;return {rows,get inserts(){return inserts;},from(){let op='select',value,filters=[],first=false;
 const q={delete(){op='delete';return q;},insert(v){op='insert';value=v;return q;},update(v){op='update';value=v;return q;},select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},lt(k,v){filters.push(r=>r[k]<v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},order(){return q;},limit(){return q;},maybeSingle(){first=true;return q;},then(resolve,reject){return Promise.resolve().then(()=>{let matched=rows.filter(r=>filters.every(f=>f(r)));if(op==='insert'){if(rows.some(r=>r.user_id===value.user_id&&['queued','processing'].includes(r.status)))return {data:null,error:{code:'23505'}};rows.push({...value});inserts++;return {error:null};}if(op==='update')matched.forEach(r=>Object.assign(r,value));if(op==='delete')for(const r of matched)rows.splice(rows.indexOf(r),1);return {data:first?matched[0]||null:matched,error:null};}).then(resolve,reject);}};return q;}};}
test('jobs reserve once, store no image, claim atomically and reject replay or wrong owner/hash',async()=>{
 const db=dbFake();let reservations=0;const job=await startImageJob(db,uid,'gemini-3.5-flash-lite',png,async()=>reservations++);
 assert.equal(reservations,1);assert.ok(job.job_id);assert.equal(JSON.stringify(db.rows).includes(png.toString('base64')),false);
 await assert.rejects(()=>claimImageJob(db,job.job_id,other,png),/unavailable/);
 await assert.rejects(()=>claimImageJob(db,job.job_id,uid,Buffer.from('wrong')),/does not match/);
 const claim=await claimImageJob(db,job.job_id,uid,png);assert.equal(claim.id,job.job_id);
 assert.equal(await claimImageJob(db,job.job_id,uid,png),null);
 await finishImageJob(db,job.job_id,uid,{status:'complete',guidance:points,provenance:{provider:'gemini'}});
 const cached=await startImageJob(db,uid,'gemini-3.5-flash-lite',png,async()=>reservations++);
 assert.equal(cached.cached,true);assert.equal(reservations,1);
});
test('active job uniqueness and expiration prevent duplicate provider costs and permanent locks',async()=>{
 const db=dbFake();const job=await startImageJob(db,uid,'gemini-3.5-flash-lite',png,async()=>{});
 await assert.rejects(()=>startImageJob(db,uid,'gemini-3.5-flash-lite',Buffer.from('other'),async()=>{}),/already running/);
 db.rows[0].expires_at=new Date(Date.now()-1000).toISOString();
 await assert.rejects(()=>claimImageJob(db,job.job_id,uid,png),/expired/);
 const next=await startImageJob(db,uid,'gemini-3.5-flash-lite',png,async()=>{});assert.notEqual(next.job_id,job.job_id);assert.equal(db.rows.length,1);
});
const env={DTF_GEMINI_ENABLED:'true',GEMINI_API_KEY:'test-server-key',GEMINI_IMAGE_MODEL:'gemini-3.5-flash-lite'};
const event=id=>({httpMethod:'POST',body:JSON.stringify({job_id:id,image:png.toString('base64'),mimeType:'image/png'})});
test('background handler requires owned reserved job, saves validated result and does not disclose image/key',async()=>{
 const db=dbFake(),job=await startImageJob(db,uid,env.GEMINI_IMAGE_MODEL,png,async()=>{}),audits=[];
 const handler=createBackgroundHandler({env,authorize:async()=>({ok:true,user:{id:uid},role:'operator',supabase:db}),audit:async a=>audits.push(a),generate:async()=>points});
 assert.equal((await handler(event(job.job_id))).statusCode,200);assert.equal(db.rows[0].status,'complete');
 assert.equal(db.rows[0].provenance.analysisJobId,job.job_id);assert.ok(!JSON.stringify(audits).includes(png.toString('base64')));assert.ok(!JSON.stringify(audits).includes(env.GEMINI_API_KEY));
});
test('background failures save bounded codes; unauthorized and duplicate calls never reach Gemini',async()=>{
 for(const [error,code] of [[Object.assign(Error('timeout'),{name:'TimeoutError'}),'timeout'],[Object.assign(Error('quota'),{statusCode:429}),'quota'],[Error(env.GEMINI_API_KEY),'provider_unavailable']]){
 const db=dbFake(),job=await startImageJob(db,uid,env.GEMINI_IMAGE_MODEL,png,async()=>{});const handler=createBackgroundHandler({env,authorize:async()=>({ok:true,user:{id:uid},role:'operator',supabase:db}),audit:async()=>{},generate:async()=>{throw error;}});
 const result=await handler(event(job.job_id));assert.equal(db.rows[0].error_code,code);assert.ok(!result.body.includes(env.GEMINI_API_KEY));}
 let called=false;const handler=createBackgroundHandler({authorize:async()=>({ok:false,statusCode:401,message:'Denied'}),generate:async()=>{called=true;}});assert.equal((await handler(event(uid))).statusCode,401);assert.equal(called,false);
});
test('PostgreSQL RLS isolates employees, hides request hashes and denies client writes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.sc_app_user_roles(user_id uuid primary key,role text,is_active boolean);grant usage on schema auth to authenticated;grant select on public.sc_app_user_roles to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function public.sc_current_app_role() returns text language sql stable as $$select role from public.sc_app_user_roles where user_id=auth.uid() and is_active$$;`);
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261029180110_dtf_ai_private_jobs.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values ('${uid}'),('${other}');insert into sc_app_user_roles values ('${uid}','operator',true),('${other}','manager',true);insert into sc_dtf_ai_jobs(id,user_id,model,request_hash) values ('${uid}','${uid}','gemini-3.5-flash-lite','${imageHash(png)}'),('${other}','${other}','gemini-3.5-flash-lite','${imageHash(png)}');set role authenticated;set request.jwt.claim.sub='${uid}';`);
 assert.equal((await db.query('select id,status from public.sc_dtf_ai_jobs')).rows.length,1);
 await assert.rejects(()=>db.query('select request_hash from public.sc_dtf_ai_jobs'),/permission denied/);
 await assert.rejects(()=>db.exec(`update sc_dtf_ai_jobs set status='complete'`),/permission denied/);
 await db.exec('reset role;');await assert.rejects(()=>db.exec(`insert into sc_dtf_ai_jobs(id,user_id,model,request_hash) values ('00000000-0000-4000-8000-000000000003','${uid}','gemini-3.5-flash-lite','${imageHash(png)}')`),/duplicate key/);
 await db.exec(`update sc_app_user_roles set is_active=false where user_id='${uid}';set role authenticated;set request.jwt.claim.sub='${uid}';`);assert.equal((await db.query('select id from sc_dtf_ai_jobs')).rows.length,0);
 await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select id from public.sc_dtf_ai_jobs'),/permission denied/);
 }finally{await db.close();}
});
test('start endpoint creates a job without calling Gemini, then cached completion avoids a new reservation',async()=>{
 const {createHandler}=await import('../../netlify/functions/dtf-ai-guidance.js');const db=dbFake();let reserved=0,called=0;
 const handler=createHandler({env,authorize:async()=>({ok:true,user:{id:uid},role:'operator',supabase:db}),audit:async()=>{},guard:async()=>reserved++,generate:async()=>{called++;return points;}});
 const input={httpMethod:'POST',body:JSON.stringify({mode:'start',image:png.toString('base64'),mimeType:'image/png'})};
 const start=await handler(input);assert.equal(start.statusCode,202);assert.equal(called,0);assert.equal(reserved,1);
 Object.assign(db.rows[0],{status:'complete',guidance:points,provenance:{provider:'gemini'}});
 const cached=await handler(input);assert.equal(cached.statusCode,200);assert.equal(reserved,1);assert.equal(called,0);
});
