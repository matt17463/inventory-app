import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('local AI session RPC denies revoked, expired, foreign and absent sessions without exposing session rows',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth;
   create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
   create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
   $$;
   create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt()->>'sub','')::uuid;
   $$;
   grant usage on schema auth to authenticated;
   insert into auth.sessions values
    ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
    ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null),
    ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '1 second');
  `);
  const sql=readFileSync(new URL('../../supabase/migrations/20261030032651_sc_local_ai_session_active.sql',import.meta.url),'utf8');
  await db.exec(sql);
  async function check(claims){
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
   await db.exec('set role authenticated');
   try{return (await db.query('select public.sc_local_ai_session_active() as allowed')).rows[0].allowed;}
   finally{await db.exec('reset role');}
  }
  const claims={sub:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'authenticated',session_id:'11111111-1111-4111-8111-111111111111'};
  assert.equal(await check(claims),true);
  assert.equal(await check({...claims,session_id:'22222222-2222-4222-8222-222222222222'}),false);
  assert.equal(await check({...claims,session_id:'33333333-3333-4333-8333-333333333333'}),false);
  assert.equal(await check({...claims,session_id:null}),false);
  assert.equal(await check({...claims,role:'anon'}),false);
  assert.equal(await check({}),false);
  await db.exec("delete from auth.sessions where id='11111111-1111-4111-8111-111111111111'");
  assert.equal(await check(claims),false);
  const privileges=await db.query(`select
   has_function_privilege('anon','public.sc_local_ai_session_active()','EXECUTE') as anon_rpc,
   has_table_privilege('authenticated','auth.sessions','SELECT') as session_rows,
   has_function_privilege('authenticated','public.sc_local_ai_session_active()','EXECUTE') as staff_rpc`);
  assert.deepEqual(privileges.rows[0],{anon_rpc:false,session_rows:false,staff_rpc:true});
 }finally{await db.close();}
});
