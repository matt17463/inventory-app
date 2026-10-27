import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
const read=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actor=id(1), product=id(2), blank=id(3), recipe=id(4), version=id(5), project=id(6), art=id(7), mockBlank=id(8), placement=id(9), output=id(10), review=id(11), token=id(12);
async function setup(){
 let db;
 let connect;
 if(process.env.SC_CERTIFICATION_TEST_DATABASE_URL){
  const admin=new pg.Client({connectionString:process.env.SC_CERTIFICATION_TEST_DATABASE_URL});await admin.connect();
  const name='certification_'+randomUUID().replaceAll('-','');await admin.query('create database '+name);
  const url=new URL(process.env.SC_CERTIFICATION_TEST_DATABASE_URL);url.pathname='/'+name;
  connect=async()=>{const client=new pg.Client({connectionString:url.href});await client.connect();return client;};
  const client=await connect();
  db={exec:sql=>client.query(sql),query:(sql,args)=>client.query(sql,args),close:async()=>{await client.end();await admin.query('drop database '+name+' with (force)');await admin.end();}};
 }else db=new PGlite();
 await db.exec(await read('scripts/tests/fixtures/certification-schema.sql'));
 await db.exec((await read('supabase/migrations/202610220001_manufacturing_recipes_travelers.sql')).replace('create extension if not exists pgcrypto;',''));
 await db.exec(await read('supabase/migrations/202610230001_grouped_production_travelers.sql'));
 await db.exec(await read('supabase/migrations/202610250003_traveler_graphics_guard.sql'));
 await db.exec(await read('supabase/migrations/202610250005_traveler_storage_preflight.sql'));
 await db.exec(await read('supabase/migrations/20261027003319_variation_certification_enforcement.sql'));
 await db.exec(await read('supabase/migrations/20261027010549_variation_recipe_routing.sql'));
 await db.exec(await read('supabase/migrations/20261027014211_artwork_integrity_registration.sql'));
 await db.exec(await read('supabase/migrations/20261027023708_external_mockup_approval_evidence.sql'));
 await db.exec(`set test.actor='${actor}'; set test.role='manager';
 insert into blank_products(id) values('${blank}');
 insert into sc_material_recipes(id,status,settings) values('${id(90)}','approved','{"temperature":100}');
 insert into products(id,sku,size,woocommerce_product_id,woocommerce_variation_id,blank_product_id,is_finished) values('${product}','TEST-S','S',100,101,'${blank}',true);
 insert into mockup_artwork_assets(id,project_id,preflight_status,updated_at,storage_provider,storage_bucket,storage_path) values('${art}','${project}','passed','2026-01-01','r2','fictional','fixture.png');
 insert into sc_manufacturing_recipes(id,name,decoration_method) values('${recipe}','Isolated test recipe','DTF');
 insert into sc_manufacturing_recipe_versions(id,recipe_id,revision,placements,verified_sample,status,approved_by,approved_at,artwork_asset_id,machine_settings_id)
 values('${version}','${recipe}',1,'[{"placement_name":"full_front","print_width_inches":8,"print_height_inches":8}]',true,'approved','${actor}','2026-01-01','${art}','${id(90)}');
 insert into sc_catalog_recipe_assignments(woocommerce_product_id,recipe_id,disposition) values(100,'${recipe}','assigned');
 insert into sc_catalog_artwork_links(woocommerce_product_id,artwork_asset_id,approval_evidence,review_required,reviewed_at,reviewed_by) values(100,'${art}','Isolated test evidence only',false,'2026-01-01','${actor}');
 insert into mockup_projects(id,woo_product_id) values('${project}',100);
 insert into mockup_blank_assets(id,project_id,blank_product_id_text,updated_at) values('${mockBlank}','${project}','${blank}','2026-01-01');

 insert into mockup_placements(id,project_id,blank_asset_id,artwork_asset_id,placement_name,decoration_method,print_width_inches,print_height_inches,is_active,updated_at)
 values('${placement}','${project}','${mockBlank}','${art}','full_front','DTF',8,8,true,'2026-01-01');
 insert into mockup_outputs(id,project_id,placement_id,is_selected,approval_status,approved_at,updated_at) values('${output}','${project}','${placement}',true,'internal_approved','2026-01-02','2026-01-02');
 insert into mockup_review_tokens(id,project_id) values('${token}','${project}');
 insert into mockup_reviews(id,project_id,output_id,review_token_id,decision,created_at) values('${review}','${project}','${output}','${token}','approved','2026-01-03');
 insert into jobs(id,status) values(1,'new');
 insert into job_items(id,job_id,quantity,woocommerce_product_id,woocommerce_variation_id,size,status) values(1,1,2,100,101,'S','new');`);
 await db.exec(`insert into sc_traveler_storage_preflight(job_id,recipe_version_id,requested_by,job_item_ids,artwork_fingerprint,expires_at)
 select 1,'${version}','${actor}',array[1,2,3,4],md5(id::text||':'||coalesce(storage_provider,'')||':'||coalesce(storage_bucket,'')||':'||coalesce(storage_path,'')||':'||preflight_status||':'||coalesce(to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'')),now()+interval '4 minutes' from mockup_artwork_assets where id='${art}';`);
 const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
 await query(`select sc_register_artwork_object_revision(id,updated_at,coalesce(storage_provider,''),coalesce(storage_bucket,''),coalesce(storage_path,''),repeat('a',64),256,$1,'Isolated checksum fixture only') from mockup_artwork_assets`,[actor]);
 const register=async(asset=art)=>query(`select sc_register_artwork_object_revision(id,updated_at,storage_provider,storage_bucket,storage_path,repeat('a',64),256,$1,'Isolated checksum fixture only') from mockup_artwork_assets where id=$2`,[actor,asset]);
 const configuration=(await query('select sc_save_variation_configuration($1,$2,$3,$4) id',[product,version,[output],'Isolated exact variation review']))[0].id;
 return {db,query,configuration,connect,register,check:async()=> (await query('select sc_check_variation_configuration($1) result',[configuration]))[0].result,
 certify:async()=> (await query('select sc_certify_variation($1) id',[configuration]))[0].id};
}
test('exact variation certification, history, duplicate requests and isolation',async()=>{
 const s=await setup();try{
  assert.equal((await s.check()).ready,true);
  const cert=await s.certify();assert.equal(await s.certify(),cert);
  await s.db.exec(`insert into products(id,woocommerce_product_id,woocommerce_variation_id,blank_product_id) values('${id(20)}',100,102,'${blank}');insert into job_items(id,job_id,quantity,woocommerce_product_id,woocommerce_variation_id) values(2,1,1,100,102);`);
  await assert.rejects(s.query('select sc_certification.require_line(2,$1)',[version]),/certificate/);
  assert.equal((await s.query('select count(*)::int n from sc_variation_certifications'))[0].n,1);
 }finally{await s.db.close();}
});
for(const [name,mutation,expected] of [
 ['missing blank',`update products set blank_product_id=null`,/blank/i],
 ['missing artwork',`delete from sc_catalog_artwork_links`,/artwork/i],
 ['missing customer approval',`delete from mockup_reviews`,/customer approval/i],
 ['withdrawn customer approval',`update mockup_reviews set decision='changes_requested'`,/customer approval/i],
 ['stale recipe',`insert into sc_manufacturing_recipe_versions(recipe_id,revision) values('${recipe}',2)`,/Stale recipe/i],
 ['wrong variation blank',`update mockup_blank_assets set blank_product_id_text='${id(99)}'`,/mismatch/i],
 ['changed mockup',`update mockup_placements set print_width_inches=9,updated_at='2026-02-01'`,/differs|stale/i],
 ['changed artwork',`update mockup_artwork_assets set storage_path='replaced.png',updated_at='2026-02-01'`,/stale/i],
])test(name+' blocks certification and revokes existing evidence',async()=>{
 const s=await setup();try{
  const cert=await s.certify();await s.db.exec(mutation);
  const v=await s.check();assert.equal(v.ready,false);assert.match(v.blockers.join(';'),expected);
  await assert.rejects(s.certify(),/Certification blocked/);
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[cert]))[0].status,'revoked');
  assert.equal((await s.query("select count(*)::int n from sc_certification_audit where kind='revoked'"))[0].n,1);
 }finally{await s.db.close();}
});
test('existing travelers, grouped creation, manual orders, status release, recertification and immutable snapshots',async()=>{
 const s=await setup();try{
  const cert=await s.certify();
  const traveler=(await s.query('select sc_create_grouped_traveler(1,array[1::bigint],$1) id',[version]))[0].id;
  await s.query('select sc_certification.require_traveler($1)',[traveler]);
  await s.db.exec(`update job_items set status='in_production' where id=1; update jobs set status='in_production' where id=1;`);
  await s.db.exec(`update mockup_artwork_assets set storage_path='new.png',updated_at='2026-02-01';`);
  await assert.rejects(s.query('select sc_certification.require_traveler($1)',[traveler]),/certificate/);
  await assert.rejects(s.query("insert into sc_job_traveler_events(traveler_id,kind,details) values($1,'batch_started','test')",[traveler]),/certificate/);
  await assert.rejects(s.db.exec("update jobs set status='qc' where id=1"),/certificate/);
  await assert.rejects(s.db.exec("update job_items set status='completed' where id=1"),/certificate/);
  await s.db.exec(`insert into job_items(id,job_id,quantity,finished_product_id,size) values(3,1,1,'${product}','S');`);
  await s.db.exec(`update sc_traveler_storage_preflight set artwork_fingerprint=(select md5(id::text||':'||coalesce(storage_provider,'')||':'||coalesce(storage_bucket,'')||':'||coalesce(storage_path,'')||':'||preflight_status||':'||coalesce(to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'')) from mockup_artwork_assets where id='${art}')`);
  await assert.rejects(s.query('select sc_create_grouped_traveler(1,array[3::bigint],$1)',[version]),/certificate/);
  await s.db.exec(`update mockup_reviews set created_at='2026-03-01'`);await s.register();
  const next=await s.certify();assert.notEqual(next,cert);
  await assert.rejects(s.query('select sc_certification.require_traveler($1)',[traveler]),/revalidation/);
  await assert.rejects(s.query('select sc_revalidate_traveler($1)',[traveler]),/Historical artwork changed/);
  const replacement=(await s.query('select sc_replace_managed_traveler($1,$2,$3) id',[traveler,version,'Isolated replacement after approved artwork change']))[0].id;
  await s.query('select sc_certification.require_traveler($1)',[replacement]);
  await assert.rejects(s.query('select sc_certification.require_traveler($1)',[traveler]),/superseded/);
  assert.equal((await s.query('select count(*)::int n from sc_job_travelers'))[0].n,2);
  await assert.rejects(s.query("update sc_job_travelers set recipe_snapshot='{}' where id=$1",[traveler]),/immutable/);
  await assert.rejects(s.query('select sc_create_grouped_traveler(1,array[1::bigint],$1)',[version]),/already have/);
 }finally{await s.db.close();}
});
test('legacy compatibility and authorization',async()=>{
 const s=await setup();try{
  await s.db.exec(`insert into job_items(id,job_id,quantity) values(4,1,1)`);
  assert.equal((await s.query('select sc_certification.managed_line(4) managed'))[0].managed,false);
  await s.query('select sc_create_grouped_traveler(1,array[4::bigint],$1)',[version]);
  await s.db.exec("set test.role='viewer'");
  await assert.rejects(s.certify(),/Manager/);
  await s.db.exec("set test.actor=''");
  await assert.rejects(s.check(),/Employee/);
  await s.db.exec('set role authenticated');
  await assert.rejects(s.db.exec("insert into sc_variation_certifications(configuration_id,status) values(null,'certified')"),/permission denied/);
 }finally{await s.db.close();}
});

test('approval-only revalidation retains old snapshots and order changes block existing traveler',async()=>{
 const s=await setup();try{
  await s.certify();
  const traveler=(await s.query('select sc_create_grouped_traveler(1,array[1::bigint],$1) id',[version]))[0].id;
  await s.db.exec("update mockup_reviews set decision='changes_requested'");
  await s.db.exec("update mockup_reviews set decision='approved',created_at='2026-03-01'");
  await s.certify();await s.query('select sc_revalidate_traveler($1)',[traveler]);
  await s.db.exec("update job_items set quantity=3 where id=1");
  await assert.rejects(s.query('select sc_certification.require_traveler($1)',[traveler]),/revalidation/);
  assert.equal((await s.query("select count(*)::int n from sc_certification_audit where kind='traveler_invalidated'"))[0].n>0,true);
 }finally{await s.db.close();}
});
test('packets, handoff release, independent production status and mixed groups fail closed',async()=>{
 const s=await setup();try{
  await assert.rejects(s.db.exec(`insert into mockup_production_packets(project_id,status) values('${project}','ready')`),/current certificates/);
  await assert.rejects(s.db.exec("update jobs set production_status='in_production' where id=1"),/certified traveler/);
  await s.db.exec(`insert into sc_job_artwork_links(job_id,handoff_id) values(1,'${id(90)}')`);
  await assert.rejects(s.db.exec(`insert into sc_approval_production_handoffs(id,production_job_id,automation_status) values('${id(90)}','1','ready_for_production')`),/certified production traveler/);
  await s.certify();
  await s.db.exec(`insert into job_items(id,job_id,quantity,woocommerce_product_id,woocommerce_variation_id) values(2,1,1,100,999)`);
  await assert.rejects(s.query('select sc_create_grouped_traveler(1,array[1::bigint,2::bigint],$1)',[version]),/variation/);
  assert.equal((await s.query('select count(*)::int n from sc_job_travelers'))[0].n,0);
 }finally{await s.db.close();}
});
test('source edits and duplicate certification requests serialize across connections',{skip:!process.env.SC_CERTIFICATION_TEST_DATABASE_URL},async()=>{
 const s=await setup();let first,second;try{
  first=await s.connect();second=await s.connect();
  for(const client of [first,second])await client.query(`set test.actor='${actor}';set test.role='manager'`);
  await first.query('begin');
  const cert=(await first.query('select sc_certify_variation($1) id',[s.configuration])).rows[0].id;
  let finished=false;
  const mutation=second.query("update mockup_artwork_assets set storage_path='concurrent-change.png',updated_at=clock_timestamp()").then(()=>{finished=true;});
  let waiting=false;
  for(let tries=0;tries<100;tries++){
   const rows=await s.query("select count(*)::int n from pg_locks where locktype='advisory' and not granted");
   if(rows[0].n>0){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(waiting,true);assert.equal(finished,false);
  await first.query('commit');await mutation;
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[cert]))[0].status,'revoked');
  await assert.rejects(second.query('select sc_certify_variation($1)',[s.configuration]),/Certification blocked/);
 }finally{if(first)await first.end();if(second)await second.end();await s.db.close();}
});
test('graphic resolution release checks preserve selector ranking and reject changed rules',async()=>{
 const s=await setup();try{
  const family=id(50),variant=id(51),rule=id(52);
  await s.db.exec(`insert into sc_client_graphic_families(id,state) values('${family}','approved');insert into sc_client_graphic_variants(id,family_id,artwork_asset_id,state,version) values('${variant}','${family}','${art}','approved',1);insert into sc_client_graphic_rules(id,family_id,variant_id,enabled,priority) values('${rule}','${family}','${variant}',true,100);`);
  const selection={family_id:family,selected_payload:{},resolution_snapshot:{status:'resolved',variantId:variant,variantVersion:1,artworkAssetId:art,ruleId:rule}};
  const current=async()=>(await s.query('select sc_certification.selection_is_current(jsonb_populate_record(null::sc_order_graphic_selections,$1::jsonb)) ready',[JSON.stringify(selection)]))[0].ready;
  assert.equal(await current(),true);
  await s.db.exec(`insert into sc_client_graphic_variants(id,family_id,artwork_asset_id,state,version) values('${id(53)}','${family}','${art}','approved',2);insert into sc_client_graphic_rules(id,family_id,variant_id,enabled,priority) values('${id(54)}','${family}','${id(53)}',true,100);`);
  assert.equal(await current(),false);
  await s.db.exec(`update sc_client_graphic_rules set enabled=false where id='${id(54)}';update sc_client_graphic_variants set version=2 where id='${variant}'`);
  assert.equal(await current(),false);
  await s.db.exec(`update sc_client_graphic_variants set version=1 where id='${variant}';update sc_client_graphic_families set state='retired' where id='${family}'`);
  assert.equal(await current(),false);
 }finally{await s.db.close();}
});
test('managed capture failure, wrong order size and missing fresh storage receipt cannot release',async()=>{
 const s=await setup();try{
  await s.certify();
  await s.db.exec("update jobs set woocommerce_order_id=1000 where id=1;update job_items set woocommerce_line_item_id=1001 where id=1;insert into sc_woo_graphic_capture_states(woo_order_id,woo_line_item_id,status) values(1000,1001,'managed_failed')");
  await assert.rejects(s.query('select sc_certification.require_line(1,$1)',[version]),/unresolved/);
  await s.db.exec("delete from sc_woo_graphic_capture_states;update job_items set size='XL' where id=1");
  await assert.rejects(s.query('select sc_certification.require_line(1,$1)',[version]),/size differs/);
  await s.db.exec("update job_items set size='S' where id=1;delete from sc_traveler_storage_preflight");
  await assert.rejects(s.query('select sc_create_grouped_traveler(1,array[1::bigint],$1)',[version]),/storage verification/);
 }finally{await s.db.close();}
});

test('exact variation recipe overrides parent default and supersedes prior certificate',async()=>{
 const s=await setup();try{
  const previous=await s.certify();const customRecipe=id(71),customVersion=id(72);
  await s.db.exec(`insert into sc_manufacturing_recipes(id,name,decoration_method) values('${customRecipe}','Exact size-specific recipe','DTF');
   insert into sc_manufacturing_recipe_versions(id,recipe_id,revision,placements,verified_sample,status,approved_by,approved_at,artwork_asset_id)
   select '${customVersion}','${customRecipe}',1,placements,true,'approved','${actor}',approved_at,artwork_asset_id from sc_manufacturing_recipe_versions where id='${version}';`);
  const config=(await s.query('select sc_save_variation_configuration($1,$2,$3,$4) id',[product,customVersion,[output],'Exact individual variation production instructions']))[0].id;
  assert.equal((await s.query('select sc_check_variation_configuration($1) result',[config]))[0].result.ready,true);
  const current=(await s.query('select sc_certify_variation($1) id',[config]))[0].id;
  assert.notEqual(previous,current);
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[previous]))[0].status,'revoked');
  const preview=(await s.query('select sc_job_line_readiness(array[1::bigint],array[$1::uuid]) result',[version]))[0].result;
  assert.equal(preview[0].ready,true);assert.equal(preview[0].recipe_version_id,customVersion);
  await assert.rejects(s.query('select sc_certification.require_line(1,$1)',[version]),/certificate/);
  await s.db.exec(`update sc_catalog_recipe_assignments set disposition='review' where woocommerce_product_id=100`);
  assert.equal((await s.query('select sc_check_variation_configuration($1) result',[config]))[0].result.ready,false);
 }finally{await s.db.close();}
});

test('production notes and selected garment specifications invalidate existing traveler bindings',async()=>{
 const s=await setup();try{
  await s.certify();
  const traveler=(await s.query('select sc_create_grouped_traveler(1,array[1::bigint],$1) id',[version]))[0].id;
  const frozen=(await s.query('select item_snapshot from sc_job_traveler_lines where traveler_id=$1',[traveler]))[0].item_snapshot;
  assert.equal(frozen.production_order_context.quantity,2);
  await s.db.exec("update job_items set production_notes='Changed personalization',selected_style='Changed garment' where id=1");
  await assert.rejects(s.query('select sc_certification.require_traveler($1)',[traveler]),/revalidation/);
  await assert.rejects(s.query('select sc_revalidate_traveler($1)',[traveler]),/Originating order specifications changed/);
  assert.equal((await s.query('select item_snapshot from sc_job_traveler_lines where traveler_id=$1',[traveler]))[0].item_snapshot.production_order_context.production_notes,null);
 }finally{await s.db.close();}
});

test('approved color-specific artwork can differ from the parent candidate only with verified graphic evidence',async()=>{
 const s=await setup();try{
  const alternate=id(81),family=id(82),variant=id(83),alternateRecipe=id(84),alternateVersion=id(85);
  await s.db.exec(`insert into mockup_artwork_assets(id,project_id,preflight_status,updated_at,storage_provider,storage_bucket,storage_path) values('${alternate}','${project}','passed','2026-01-01','r2','fictional','alternate.png');
   update mockup_placements set artwork_asset_id='${alternate}' where id='${placement}';
   insert into sc_manufacturing_recipes(id,name,decoration_method) values('${alternateRecipe}','Color-specific approved recipe','DTF');
   insert into sc_manufacturing_recipe_versions(id,recipe_id,revision,placements,verified_sample,status,approved_by,approved_at,artwork_asset_id)
   select '${alternateVersion}','${alternateRecipe}',1,placements,true,'approved','${actor}',approved_at,'${alternate}' from sc_manufacturing_recipe_versions where id='${version}';`);
  await s.register(alternate);
  const config=(await s.query('select sc_save_variation_configuration($1,$2,$3,$4) id',[product,alternateVersion,[output],'Exact alternate artwork reviewed for this color']))[0].id;
  const check=async()=>(await s.query('select sc_check_variation_configuration($1) result',[config]))[0].result;
  assert.equal((await check()).ready,false);
  await s.db.exec(`insert into sc_client_graphic_families(id,state) values('${family}','approved');insert into sc_client_graphic_variants(id,family_id,artwork_asset_id,state,version) values('${variant}','${family}','${alternate}','approved',1);insert into sc_client_graphic_product_bindings(woo_product_id,graphic_family_id,mode,allowed,verified_at) values(100,'${family}','fixed',true,now());`);
  assert.equal((await check()).ready,true);
  await s.query('select sc_certify_variation($1)',[config]);
  await s.db.exec(`update sc_client_graphic_variants set state='retired' where id='${variant}'`);
  assert.equal((await check()).ready,false);
 }finally{await s.db.close();}
});

async function unrelatedConfiguration(s){
 const ids=[product,blank,recipe,version,project,art,mockBlank,placement,output,review,token,id(90)];
 const tables=['sc_material_recipes','blank_products','products','mockup_projects','mockup_artwork_assets','sc_manufacturing_recipes','sc_manufacturing_recipe_versions','mockup_blank_assets','mockup_placements','mockup_outputs','mockup_review_tokens','mockup_reviews'];
 for(const table of tables){
  const rows=await s.query('select to_jsonb(t) data from '+table+' t limit 1');
  let json=JSON.stringify(rows[0].data);
  ids.forEach((old,i)=>{json=json.replaceAll(old,id(200+i));});
  const data=JSON.parse(json);
  if(table==='products'){data.woocommerce_product_id=200;data.woocommerce_variation_id=201;data.sku='UNRELATED';}
  if(table==='mockup_projects')data.woo_product_id=200;
  if(table==='mockup_artwork_assets')data.storage_path='unrelated.png';
  await s.query('insert into '+table+' select (jsonb_populate_record(null::'+table+',$1::jsonb)).*',[data]);
 }
 await s.query('insert into sc_catalog_recipe_assignments(woocommerce_product_id,recipe_id,disposition) values(200,$1,\'assigned\')',[id(202)]);
 await s.query("insert into sc_catalog_artwork_links(woocommerce_product_id,artwork_asset_id,approval_evidence,review_required,reviewed_at,reviewed_by) values(200,$1,'Isolated unrelated source evidence',false,'2026-01-01',$2)",[id(205),actor]);
 await s.register(id(205));
 const configuration=(await s.query('select sc_save_variation_configuration($1,$2,$3,$4) id',[id(200),id(203),[id(208)],'Isolated unrelated configuration']))[0].id;
 return (await s.query('select sc_certify_variation($1) id',[configuration]))[0].id;
}
for(const [name,prepare,mutation] of [
 ['blank specification','',"update blank_products set name='Changed physical blank' where id='"+blank+"'"],
 ['artwork revision','',"update mockup_artwork_assets set storage_path='new-object.png',updated_at='2026-02-01' where id='"+art+"'"],
 ['new recipe revision','',"insert into sc_manufacturing_recipe_versions(recipe_id,revision) values('"+recipe+"',2)"],
 ['production placement','',"update mockup_placements set print_width_inches=9 where id='"+placement+"'"],
 ['machine settings','',"update sc_material_recipes set settings='{\"temperature\":110}' where id='"+id(90)+"'"],
 ['mockup output','',"update mockup_outputs set caption_text='Changed proof' where id='"+output+"'"],
 ['customer withdrawal','',"update mockup_reviews set decision='changes_requested' where id='"+review+"'"],
 ['Woo variation specification','',"update products set size='M' where id='"+product+"'"],
])test('activation matrix: '+name+' revokes only affected evidence and blocks existing traveler',async()=>{
 const s=await setup();try{
  const unrelated=await unrelatedConfiguration(s);
  if(prepare)await s.db.exec(prepare);
  const cert=await s.certify();
  const traveler=(await s.query('select sc_create_grouped_traveler(1,array[1::bigint],$1) id',[version]))[0].id;
  const frozen=(await s.query('select recipe_snapshot from sc_job_travelers where id=$1',[traveler]))[0].recipe_snapshot;
  await s.db.exec(mutation);
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[cert]))[0].status,'revoked');
  const audit=(await s.query("select reason,details from sc_certification_audit where certification_id=$1 and kind='revoked'",[cert]))[0];
  assert.match(audit.reason,/evidence changed/);assert(audit.details.affected_travelers.includes(traveler));
  await assert.rejects(s.query('select sc_certification.require_traveler($1)',[traveler]),/certificate|Order size/);
  await assert.rejects(s.db.exec("update job_items set status='completed' where id=1"),/certificate|Order size/);
  assert.deepEqual((await s.query('select recipe_snapshot from sc_job_travelers where id=$1',[traveler]))[0].recipe_snapshot,frozen);
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[unrelated]))[0].status,'certified');
 }finally{await s.db.close();}
});
test('registered bytes are immutable, required for certification and cannot be forged by browser roles',async()=>{
 const s=await setup();try{
  await s.db.exec("update mockup_artwork_assets set storage_path='new-review.png',updated_at='2026-02-01'");
  assert.match((await s.check()).blockers.join(';'),/checksum/);
  await assert.rejects(s.certify(),/checksum/);
  await s.register();await s.db.exec("update mockup_reviews set created_at='2026-03-01'");
  const cert=await s.certify();
  await assert.rejects(s.db.exec("update sc_artwork_object_revisions set sha256=repeat('b',64)"),/immutable/);
  await s.query('select sc_report_artwork_integrity_failure($1,$2,$3,$4,$5)',[art,'2026-02-01',actor,'a'.repeat(64),'b'.repeat(64)]);
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[cert]))[0].status,'revoked');
  await assert.rejects(s.query("select sc_register_artwork_object_revision(id,updated_at,storage_provider,storage_bucket,storage_path,repeat('b',64),256,$1,'Cannot bless overwritten key') from mockup_artwork_assets",[actor]),/cannot be repinned/);
  for(const role of ['anon','authenticated']){
   await s.db.exec('set role '+role);
   await assert.rejects(s.query('select sc_report_artwork_integrity_failure($1,$2,$3,$4,$5)',[art,'2026-02-01',actor,'a','b']),/permission denied/);
   await assert.rejects(s.db.exec("insert into sc_artwork_object_revisions default values"),/permission denied/);
   await s.db.exec('reset role');
  }
 }finally{await s.db.close();}
});
test('external customer approval keeps honest manager provenance, current evidence and withdrawal enforcement',async()=>{
 const s=await setup();try{
  await s.db.exec('delete from mockup_reviews');
  assert.equal((await s.check()).ready,false);
  const record=()=>s.query('select sc_record_external_mockup_approval($1,$2,$3,$4,$5) id',[output,'Fictional customer','Isolated actual-decision fixture reference','approved','Isolated manager report of externally received customer decision']);
  await s.db.exec("set test.role='operator'");await assert.rejects(record(),/Manager/);await s.db.exec("set test.role='manager'");
  const evidence=(await record())[0].id;
  assert.equal((await s.query('select count(*)::int n from mockup_reviews'))[0].n,0);
  assert.equal((await s.query('select count(*)::int n from mockup_review_tokens'))[0].n,1);
  const state=await s.check();assert.equal(state.ready,true);
  assert.equal(state.snapshot.external_customer_approval_evidence[0].recorded_by,actor);
  assert.equal(state.snapshot.external_customer_approval_evidence[0].source_kind,'manager_recorded_external_approval');
  const cert=await s.certify();
  await assert.rejects(s.query("update sc_external_mockup_approvals set decision='withdrawn' where id=$1",[evidence]),/immutable/);
  await s.query('select sc_record_external_mockup_approval($1,$2,$3,$4,$5)',[output,'Fictional customer','Isolated withdrawal message','withdrawn','Actual withdrawal reported in this isolated fixture']);
  assert.equal((await s.check()).ready,false);
  assert.equal((await s.query('select status from sc_variation_certifications where id=$1',[cert]))[0].status,'revoked');
  await record();assert.equal((await s.check()).ready,true);
  await s.db.exec("update mockup_placements set updated_at=clock_timestamp() where id='"+placement+"'");
  assert.equal((await s.check()).ready,false);
  await record();assert.equal((await s.check()).ready,true);
  await s.db.exec("insert into mockup_reviews(project_id,output_id,review_token_id,decision,created_at) values('"+project+"','"+output+"','"+token+"','changes_requested',clock_timestamp())");
  assert.equal((await s.check()).ready,false);
  await s.db.exec('set role authenticated');await assert.rejects(s.db.exec('insert into sc_external_mockup_approvals default values'),/permission denied/);
 }finally{await s.db.close();}
});
