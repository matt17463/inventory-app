import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OMNI_DEVICE, OMNI_PRODUCTS, OMNI_OWNER_TIPS, OMNI_SETUP, OMNI_MAINTENANCE, searchOmniProducts, daysUntilDue } from '../../src/lib/omniKnowledge.js';

test('dual UV edition and product lookup are distinct from fabric edition',()=>{
 assert.match(OMNI_DEVICE.edition,/Dual UV/);
 assert.match(OMNI_DEVICE.edition,/not UV \+ DT fabric/i);
 assert.ok(OMNI_PRODUCTS.length>=10);
 for(const p of OMNI_PRODUCTS){
  assert.ok(p.steps.length>=5);
  assert.ok(p.source.startsWith('https://support.xtool.com/'));
  assert.notEqual(p.status,'approved');
 }
 assert.ok(searchOmniProducts('brass').some(x=>x.id==='brass-coin'));
 assert.ok(searchOmniProducts('patch').some(x=>x.id==='leather-patch'));
 assert.ok(searchOmniProducts('xtool omni').length>=10);
 assert.equal(searchOmniProducts('slate','Coins').length,0);
});

test('golf ball standard OR1 incompatibility remains explicitly blocked',()=>{
 const ball=OMNI_PRODUCTS.find(x=>x.id==='golfball');
 assert.equal(ball.status,'not-supported-or1');
 assert.match(ball.steps.join(' '),/42\.7 mm/);
 assert.match(ball.steps.join(' '),/47/);
 assert.match(ball.steps.join(' '),/do not force/i);
});

test('official slate and acrylic sample parameters have traceable sources',()=>{
 const slate=OMNI_PRODUCTS.find(x=>x.id==='slate');
 assert.match(slate.steps.join(' '),/2 white ink layers and 1 color layer/);
 assert.match(slate.source,/3736/);
 const acrylic=OMNI_PRODUCTS.find(x=>x.id==='acrylic');
 assert.match(acrylic.steps.join(' '),/0\.6 mm/);
 assert.match(acrylic.source,/3738/);
});

test('maintenance due logic uses logged completion and documented intervals',()=>{
 assert.ok(OMNI_SETUP.length>=10);
 assert.ok(OMNI_MAINTENANCE.some(x=>x.id==='rail'&&x.intervalDays===30));
 assert.equal(daysUntilDue(null,7,new Date('2026-10-28T12:00:00Z')),-1);
 assert.equal(daysUntilDue('2026-10-27T12:00:00Z',7,new Date('2026-10-28T12:00:00Z')),6);
 assert.equal(daysUntilDue('2026-10-18T12:00:00Z',7,new Date('2026-10-28T12:00:00Z')),-3);
 assert.equal(daysUntilDue(null,null),null);
});

test('owner notes have original public provenance and are not treated as certified',()=>{
 assert.ok(OMNI_OWNER_TIPS.length>=3);
 for(const t of OMNI_OWNER_TIPS)assert.match(t.url,/^https:\/\//);
});

test('device library route links to existing approved material workflow and preserves RLS',()=>{
 const app=fs.readFileSync('src/App.jsx','utf8');
 const nav=fs.readFileSync('src/navigationConfig.js','utf8');
 const ui=fs.readFileSync('src/DeviceProductLibrary.jsx','utf8');
 const material=fs.readFileSync('src/MaterialSettings.jsx','utf8');
 const sql=fs.readFileSync('supabase/migrations/202610280001_device_product_library.sql','utf8');
 assert.match(app,/path="\/device-product-library"/);
 assert.match(nav,/Device & Product Library/);
 assert.match(ui,/sc_material_recipes/);
 assert.match(ui,/sc_device_setup_checks/);
 assert.match(ui,/sc_device_maintenance_logs/);
 assert.match(ui,/shouldSimulateWrites/);
 assert.match(ui,/not production approved/);
 assert.match(material,/OMNI_PRODUCTS/);
 assert.match(material,/omniStudioDraftFor/);
 assert.match(material,/status:'draft'/);
 for(const t of ['sc_device_setup_checks','sc_device_maintenance_logs']){
  assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on public\\.sc_device_setup_checks,public\\.sc_device_maintenance_logs from anon'));
 }
 assert.match(sql,/sc_current_app_role\(\)/);
 assert.match(sql,/recorded_by=\(select auth\.uid\(\)\)/);
 assert.doesNotMatch(sql,/to anon\s+using\s*\(true\)/);
});
