import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DTF_STARTER_PRESETS,PLACEMENT_SOURCES,classifyCatalogFamily,readinessStatus} from '../../src/lib/catalogProductionPresets.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('DTF starter recipes are idempotently identifiable and never auto-approved',()=>{
 assert.equal(DTF_STARTER_PRESETS.length,24);
 assert.equal(new Set(DTF_STARTER_PRESETS.map(x=>x.name)).size,24);
 for(const recipe of DTF_STARTER_PRESETS){
  assert.equal(recipe.status,'draft');
  assert.equal(recipe.verified_sample,false);
  assert.equal(recipe.decoration_method,'DTF');
  assert.equal(recipe.placements.length,1);
  assert.equal(recipe.placements[0].center_offset_inches,0);
  assert.ok(recipe.production_notes.includes('UNVERIFIED'));
  assert.equal(recipe.machine_settings_id,undefined);
  assert.ok(recipe.process_steps.some(x=>/manufacturer instructions/i.test(x.instruction)));
  for(const field of ['print_width_inches','print_height_inches','top_offset_inches']){
   assert.ok(Number(recipe.placements[0][field])>0);
  }
 }
});
test('published sources are specific and classifications are explicitly unverified',()=>{
 assert.ok(PLACEMENT_SOURCES.length>=3);
 for(const link of PLACEMENT_SOURCES) assert.match(link.url,/^https:\/\//);
 assert.deepEqual(classifyCatalogFamily('Adult 18500 Heavy Blend Hoodie'),{garment:'hoodie',method:'Needs review',confidence:'review_required'});
 assert.equal(classifyCatalogFamily('Youth DTF Tee').method,'DTF');
 assert.equal(classifyCatalogFamily('Laser Metal Patch').garment,'patch');
});
test('no draft recipe becomes manufacturing ready',()=>{
 assert.equal(readinessStatus({},null,[]),'Needs assignment');
 assert.equal(readinessStatus({}, {recipe_id:'r',disposition:'assigned'},[{recipe_id:'r',status:'draft'}]),'Awaiting physical approval');
 assert.equal(readinessStatus({}, {recipe_id:'r',disposition:'assigned'},[{recipe_id:'r',status:'approved'}]),'Approved recipe linked');
});
test('catalog backfill is additive, role gated, and rejects anonymous product or client edits',()=>{
 const api=read('../../netlify/functions/catalog-production-readiness.js');
 const sql=read('../../supabase/migrations/202610220099_catalog_production_readiness.sql');
 const app=read('../../src/App.jsx');
 const nav=read('../../src/navigationConfig.js');
 assert.match(api,/authorizeEmployee/);
 assert.match(api,/allowedRoles:allRoles/);
 assert.match(api,/editorRoles\.has\(auth\.role\)/);
 assert.match(api,/ignoreDuplicates:true/);
 assert.match(api,/confirm_artwork_verified/);
 assert.match(api,/job_item_id/);
 assert.doesNotMatch(api,/from\('(?:products|job_items|jobs|inventory_movements)'\)\.update/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.sc_catalog_recipe_assignments from public, anon, authenticated/);
 assert.match(sql,/security_invoker = true/);
 assert.match(sql,/unique check \(woocommerce_product_id > 0\)/);
 assert.match(app,/catalog-production-readiness/);
 assert.match(nav,/Catalog Production Readiness/);
});
