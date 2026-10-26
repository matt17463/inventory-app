import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture,uid,job,rpc,asRole} from './fixture.mjs';
const db=await fixture();let passed=0,failed=0;
async function check(label,fn){try{await fn();passed++;console.log('PASS',label)}catch(e){failed++;console.error('FAIL',label,e.message)}}
const art=uid(11),version=uid(132);
try{
 const migration=await readFile(new URL('../../../supabase/migrations/202610250005_traveler_storage_preflight.sql',import.meta.url),'utf8');
 await db.exec(migration);
 await db.query(`insert into sc_manufacturing_recipe_versions(id,recipe_id,revision,placements,artwork_asset_id,verified_sample,status,approved_by,approved_at,created_by)
 values($1,$2,2,$3,null,true,'approved',$4,now(),$4)`,[version,uid(30),[
  {placement_name:'full_front',size_group:'Youth',print_width_inches:8},
  {placement_name:'sleeve',size_group:'Youth',print_width_inches:3.5},
  {placement_name:'full_back',size_group:'Youth Medium',print_width_inches:11}
 ],uid(2)]);
 const approved=async(n,placements,versionId=version)=>{
  await job(db,n);
  for(const placement_name of placements){
   const res=await db.query('select sc_approve_job_line_placement_artwork($1,$2,$3,$4,$5) as id',[n*10,versionId,placement_name,art,uid(2)]);
   assert.ok(res.rows[0].id);
  }
 };
 const receipt=async(n,versionId=version)=>{
  const {rows:[a]}=await db.query('select id,storage_provider,storage_bucket,storage_path,preflight_status from mockup_artwork_assets where id=$1',[art]);
  const mappings=await db.query('select placement_name,artwork_asset_id from sc_job_line_placement_artwork where job_item_id=$1 and recipe_version_id=$2 order by placement_name,artwork_asset_id',[n*10,versionId]);
  const suffix=mappings.rows.length?'|placements:'+mappings.rows.map(row=>row.placement_name+':'+row.artwork_asset_id).join('|'):'';
  const fingerprint=createHash('md5').update([a.id,a.storage_provider||'',a.storage_bucket||'',a.storage_path||'',a.preflight_status||''].join(':')+suffix).digest('hex');
  await db.query(`insert into sc_traveler_storage_preflight(job_id,recipe_version_id,requested_by,job_item_ids,artwork_fingerprint,checked_at,expires_at)
 values($1,$2,$3,$4,$5,now(),now()+interval '2 minutes')`,[n,versionId,uid(3),[n*10],fingerprint]);
 };
 const run=(n,versionId=version)=>db.query('select sc_create_grouped_traveler($1,$2,$3) as id',[n,[n*10],versionId]);
 await check('Generic three-position approved artwork works with real SQL',async()=>{
  await approved(201,['full_front','sleeve','full_back']);await receipt(201);
  const out=await asRole(db,'operator',()=>run(201));assert.ok(out.rows[0].id);
  const saved=await db.query('select item_snapshot from sc_job_traveler_lines where job_item_id=2010');
  assert.equal(saved.rows[0].item_snapshot.approved_placement_artwork.length,3);
 });
 await check('Generic two-position approved artwork works with real SQL',async()=>{
  const two=uid(133);
  await db.query(`insert into sc_manufacturing_recipe_versions(id,recipe_id,revision,placements,artwork_asset_id,verified_sample,status,approved_by,approved_at,created_by)
  values($1,$2,3,$3,null,true,'approved',$4,now(),$4)`,[two,uid(30),[
    {placement_name:'full_front',size_group:'Youth',print_width_inches:8},
    {placement_name:'sleeve',size_group:'Youth',print_width_inches:3.5}
  ],uid(2)]);
  await approved(205,['full_front','sleeve'],two);
  await receipt(205,two);
  const out=await asRole(db,'operator',()=>run(205,two));
  assert.ok(out.rows[0].id);
  const saved=await db.query('select item_snapshot from sc_job_traveler_lines where job_item_id=2050');
  assert.equal(saved.rows[0].item_snapshot.approved_placement_artwork.length,2);
 });
 await check('Partial placements block direct traveler creation',async()=>{
  await approved(202,['full_front','sleeve']);await receipt(202);
  await assert.rejects(asRole(db,'operator',()=>run(202)),/preflight|placement/i);
 });
 await check('No assignments block generic recipe',async()=>{
  await job(db,203);await assert.rejects(asRole(db,'operator',()=>run(203)),/preflight|placement/i);
 });
 await check('Changing approved placement invalidates earlier receipt',async()=>{
  await approved(206,['full_front','sleeve','full_back']);
  await receipt(206);
  await db.query('update sc_job_line_placement_artwork set artwork_asset_id=$1 where job_item_id=$2 and placement_name=$3',[uid(12),2060,'sleeve']);
  await assert.rejects(asRole(db,'operator',()=>run(206)),/Fresh trusted artwork storage verification/);
 });
 await check('Wrong placement cannot be approved',async()=>{
  await job(db,204);
  await assert.rejects(db.query('select sc_approve_job_line_placement_artwork($1,$2,$3,$4,$5)',[2040,version,'left_chest',art,uid(2)]),/invalid/i);
 });
 await check('Approved job artwork cannot change after traveler',async()=>{
  await assert.rejects(db.query('select sc_approve_job_line_placement_artwork($1,$2,$3,$4,$5)',[2010,version,'full_front',art,uid(2)]),/Cannot change/i);
 });
} finally {await db.close()}
console.log('GENERIC RECIPE INTEGRATION',passed,'PASS',failed,'FAIL');if(failed)process.exitCode=1;
