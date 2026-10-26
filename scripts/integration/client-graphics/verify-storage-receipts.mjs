import assert from 'node:assert/strict';
import { fixture, job, selection, rpc, asRole, uid } from './fixture.mjs';

const db = await fixture();
let passed = 0, failed = 0;
async function check(name, fn) {
 try { await fn(); passed++; console.log('PASS',name); }
 catch(error) { failed++; console.error('FAIL',name,error.message); }
}
async function freshReceipt(jobId, itemId, {expires=false, fingerprint=null}={}) {
 const asset=await db.query('select id,storage_provider,storage_bucket,storage_path,preflight_status from mockup_artwork_assets where id=$1',[uid(11)]);
 const a=asset.rows[0];
 const material=[a.id,a.storage_provider||'',a.storage_bucket||'',a.storage_path||'',a.preflight_status||''].join(':');
 const crypto=await import('node:crypto');
 const hash=fingerprint||crypto.createHash('md5').update(material).digest('hex');
 await db.query(`insert into sc_traveler_storage_preflight
 (job_id,recipe_version_id,requested_by,job_item_ids,artwork_fingerprint,checked_at,expires_at)
 values ($1,$2,$3,$4,$5,now()-interval '3 minutes',now()+interval '1 minute')`,
 [jobId,uid(31),uid(3),[itemId],hash]);
 if(expires)await db.query("update sc_traveler_storage_preflight set expires_at=now()-interval '1 minute' where job_id=$1",[jobId]);
}
try {
 const fs=await import('node:fs/promises');
 const migration=await fs.readFile(new URL('../../../supabase/migrations/202610250005_traveler_storage_preflight.sql',import.meta.url),'utf8');
 await db.exec(migration);
 await check('RPC without receipt fails closed',async()=>{await job(db,71);await selection(db,71);await assert.rejects(asRole(db,'operator',()=>rpc(db,71)),/Fresh trusted artwork storage verification/)});
 await check('Expired receipt fails closed',async()=>{await job(db,72);await selection(db,72);await freshReceipt(72,720,{expires:true});await assert.rejects(asRole(db,'operator',()=>rpc(db,72)),/Fresh trusted artwork storage verification/)});
 await check('Mismatched receipt fingerprint fails closed',async()=>{await job(db,73);await selection(db,73);await freshReceipt(73,730,{fingerprint:'00000000000000000000000000000000'});await assert.rejects(asRole(db,'operator',()=>rpc(db,73)),/Fresh trusted artwork storage verification/)});
 await check('Another user cannot reuse receipt',async()=>{await job(db,74);await selection(db,74);await freshReceipt(74,740);await assert.rejects(asRole(db,'manager',()=>rpc(db,74)),/Fresh trusted artwork storage verification/)});
 await check('Valid operator receipt permits approved traveler',async()=>{await job(db,75);await selection(db,75);await freshReceipt(75,750);const out=await asRole(db,'operator',()=>rpc(db,75));assert.ok(out.rows[0].id)});
 await check('Multi-line traveler rolls back when second lacks receipt',async()=>{await job(db,76);await selection(db,76);await db.query('insert into job_items(id,job_id,quantity,woocommerce_line_item_id,color,size,selected_color,selected_size,ordered_product_name) values (761,76,1,20761,\'Black\',\'M\',\'Black\',\'M\',\'Second line\')');await freshReceipt(76,760);await assert.rejects(asRole(db,'operator',()=>rpc(db,76,[760,761])),/Fresh trusted artwork storage verification/);const n=await db.query('select count(*)::int n from sc_job_travelers where job_id=76');assert.equal(n.rows[0].n,0)});
} finally { await db.close(); }
console.log('STORAGE RECEIPT INTEGRATION',passed,'PASS',failed,'FAIL');
if(failed)process.exitCode=1;
