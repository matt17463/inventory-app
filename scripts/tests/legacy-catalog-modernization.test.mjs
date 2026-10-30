import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EXPANDED_STARTER_PRESETS,EXPANDED_SOURCES} from '../../src/lib/expandedProductionPresets.js';
import {guideChapters,GUIDE_VERSION} from '../../src/application-guide/guideData.js';
import {trainingTutorials,TRAINING_VERSION} from '../../src/application-guide/trainingData.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('process-specific starters remain unapproved and use substrate-specific checks',()=>{
 assert.equal(EXPANDED_STARTER_PRESETS.length,17);
 assert.equal(new Set(EXPANDED_STARTER_PRESETS.map(x=>x.name)).size,17);
 for(const x of EXPANDED_STARTER_PRESETS){
  assert.equal(x.status,'draft');assert.equal(x.verified_sample,false);
  assert.equal(x.machine_settings_id,undefined);
  assert.equal(x.placements.length,1);
  assert.ok(x.process_steps.length>=4);
  assert.match(x.production_notes,/UNVERIFIED/);
 }
 assert.ok(['Sublimation','HTV','Omni UV','Laser','BN2-30 Print/Cut'].every(m=>EXPANDED_STARTER_PRESETS.some(x=>x.decoration_method===m)));
 for(const x of EXPANDED_SOURCES)assert.match(x.url,/^https:\/\//);
});
test('new modernization features require manager authorization and preserve historical orders',()=>{
 const code=read('../../netlify/functions/legacy-catalog-modernization.js');
 assert.match(code,/authorizeEmployee/);assert.match(code,/editRoles\.has\(auth\.role\)/);
 for(const key of ['client_candidates','create_client','link_client','link_artwork','flag_artwork_revision','save_checklist','reorder_preview','save_reorder','seed_expanded_recipes'])assert.ok(code.includes(key));
 assert.match(code,/candidate\?\.candidates\?\.length/);
 assert.match(code,/review_required:true/);
 assert.match(code,/confirmed/);
 assert.doesNotMatch(code,/from\('(products|inventory_movements|woocommerce_orders)'\)\.update/);
 assert.match(code,/confirmed/);
});
test('artwork updates trigger review, storage and customer records remain untouched',()=>{
 const sql=read('../../supabase/migrations/202610220100_legacy_adoption_artwork_reorders.sql');
 assert.match(sql,/sc_flag_linked_artwork_changes/);
 assert.match(sql,/after update on public\.mockup_artwork_assets/);
 assert.match(sql,/security definer/);
 assert.match(sql,/revoke all on function public\.sc_flag_linked_artwork_changes/);
 assert.match(sql,/create unique index if not exists sc_unique_live_growth_customer_link/);
 assert.match(sql,/sc_catalog_feature_reviews/);
 assert.match(sql,/sc_catalog_reorder_reviews/);
 assert.match(sql,/enable row level security/);
 assert.doesNotMatch(sql,/grant .* to anon;/i);
});
test('new screens, tutorials and PDF-backed guide have joined the current app',()=>{
 const app=read('../../src/App.jsx'), nav=read('../../src/navigationConfig.js');
 assert.match(app,/path="\/catalog-modernization"/);
 assert.match(nav,/Product & Client Modernization/);
 assert.equal(GUIDE_VERSION,'2.0.0');
 assert.equal(TRAINING_VERSION,'2.0.0');
 for(const route of ['/catalog-modernization','/catalog-production-readiness','/print-center','/production-travelers'])
  assert.ok(guideChapters.some(c=>c.sections?.some(s=>s.relatedRoutes?.includes(route))));
 assert.ok(trainingTutorials.some(t=>t.id==='modernization-legacy-client-identities'));
 assert.ok(trainingTutorials.some(t=>t.id==='modernization-client-print-packet'));
 const pdf=read('../../scripts/build-application-guide-pdf.mjs');
 assert.match(pdf,/guideChapters/);assert.match(pdf,/trainingTutorials/);
 assert.match(pdf,/skilled-crafting-application-user-guide.pdf/);
});
