import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OMNI_PRODUCTS } from '../../src/lib/omniKnowledge.js';
import { OMNI_STUDIO_PROFILES, OMNI_STUDIO_SOURCES, omniStudioProfileFor, omniStudioDraftFor } from '../../src/lib/omniStudioProfiles.js';

test('every built-in Omni product has a source-attributed Studio profile',()=>{
 assert.equal(Object.keys(OMNI_STUDIO_PROFILES).length,OMNI_PRODUCTS.length);
 for(const product of OMNI_PRODUCTS){
  const profile=omniStudioProfileFor(product.id);
  assert.ok(profile,product.id);
  assert.ok(profile.fields.length>=3,product.id);
  assert.ok(profile.matrix.length>=3,product.id);
  for(const f of profile.fields){
   assert.match(f.source,/^https:\/\//,product.id);
   assert.ok(['official example','manufacturer principle','shop trial candidate','public owner report','not supported'].includes(f.evidence));
   assert.ok(f.value);
  }
 }
 assert.match(OMNI_STUDIO_SOURCES.studio,/1306/);
});

test('official material print settings are precise and distinct from shop trials',()=>{
 const rock=omniStudioProfileFor('slate');
 assert.equal(rock.settings.material_preset,'Square Rock Coaster');
 assert.equal(rock.settings.white_layers,2);
 assert.equal(rock.settings.color_layers,1);
 assert.equal(rock.fields.find(x=>x.label==='White ink layers').evidence,'official example');
 const acrylic=omniStudioProfileFor('acrylic');
 assert.equal(acrylic.settings.target_relief_mm,0.6);
 assert.equal(acrylic.settings.texture_smoothness,1);
 assert.match(acrylic.fields.find(x=>x.label==='Texture thickness').source,/3738/);
 const leather=omniStudioProfileFor('leather-patch');
 assert.equal(leather.settings.white_ink_type,'Flexible white');
 assert.equal(leather.settings.target_relief_mm,0.3);
 assert.match(leather.fields.find(x=>x.label==='Texture thickness').source,/3750/);
 const decal=omniStudioProfileFor('uvdtf');
 assert.ok(decal.fields.some(f=>f.value==='Color+White+Color'&&f.evidence==='official example'));
 assert.ok(decal.fields.some(f=>f.value==='1–3'));
});

test('provisional metal and glass settings are clearly not official numeric presets',()=>{
 for(const id of ['brass-coin','stainless-coin','glassware','ornament']){
  const p=omniStudioProfileFor(id);
  assert.ok(p.fields.some(f=>f.evidence==='shop trial candidate'));
  assert.match(String(p.settings.white_layers),/compare|light/);
 }
 const pu=omniStudioProfileFor('synthetic-patch');
 assert.ok(pu.fields.some(f=>f.evidence==='public owner report'));
 assert.match(pu.fields.find(f=>f.evidence==='public owner report').source,/reddit\.com/);
});

test('blocked golf balls have no printable draft nor fabricated numeric parameters',()=>{
 const product=OMNI_PRODUCTS.find(p=>p.id==='golfball');
 assert.equal(omniStudioProfileFor(product.id).settings,null);
 assert.equal(omniStudioDraftFor(product),null);
 assert.ok(omniStudioProfileFor(product.id).fields.every(x=>x.evidence==='not supported'));
});

test('drafts contain provenance but cannot mark themselves approved',()=>{
 for(const product of OMNI_PRODUCTS.filter(p=>p.id!=='golfball')){
  const r=omniStudioDraftFor(product);
  assert.equal(r.machine_type,'xtool_omni');
  assert.equal(r.material_name,product.name);
  assert.ok(r.settings.settings_sources.every(x=>x.startsWith('https://')));
  assert.equal(r.settings.recipe_evidence,'research candidate only; not physically validated');
  assert.ok(!('approved_by' in r));
  assert.ok(!('status' in r));
  assert.ok(!('approved_at' in r));
  assert.ok(r.material_notes.includes('STUDIO TEST MATRIX'));
 }
});

test('new parameter fields and UI integrate with existing recipe validation',()=>{
 const core=fs.readFileSync('src/lib/materialSettings.js','utf8');
 const ui=fs.readFileSync('src/DeviceProductLibrary.jsx','utf8');
 const editor=fs.readFileSync('src/MaterialSettings.jsx','utf8');
 for(const k of ['material_preset','print_effect','ink_mode','white_layers','color_layers','varnish_layers','rotary_modeling_shape']){
  assert.ok(core.includes(k),k);
 }
 assert.match(ui,/studio\.fields\.map/);
 assert.match(ui,/official example/);
 assert.match(ui,/Material setting → Community/);
 assert.match(editor,/omniStudioDraftFor/);
 assert.match(editor,/not a certified setting/);
});
