import test from 'node:test';
import assert from 'node:assert/strict';
import {BN2_MEDIA, BN2_LIMITS, toBn2Draft} from '../../src/lib/rolandBn2Media.js';
import {MACHINE_TYPES, machineFor, materialSafety, normalizeSettingsJson} from '../../src/lib/materialSettings.js';

test('all eight requested BN2-30 materials have distinct, citable entries',()=>{
  assert.equal(BN2_MEDIA.length,8);
  assert.equal(new Set(BN2_MEDIA.map(x=>x.id)).size,8);
  for(const material of BN2_MEDIA){
    assert.ok(material.name&&material.sku&&material.category);
    assert.ok(material.sources.length>0);
    assert.ok(material.sources.every(source=>source.url.startsWith('https://')));
    assert.ok(material.notes.length>=5);
    assert.equal(material.status,'Unverified starting recipe');
  }
});
test('all draft values are supported by BN2-30 specifications and require physical validation',()=>{
  assert.equal(BN2_LIMITS.maxRollKg,12);
  assert.deepEqual(BN2_LIMITS.printHeaterC,[30,35]);
  assert.deepEqual(BN2_LIMITS.dryerC,[30,38]);
  for(const media of BN2_MEDIA){
    const draft=toBn2Draft(media);
    const settings=normalizeSettingsJson(draft.settings);
    assert.equal(draft.machine_type,'roland_bn2');
    assert.equal(draft.machine_model,'Roland VersaSTUDIO BN2-30');
    assert.equal(draft.id,null);
    assert.equal(draft.machine_configuration,'');
    assert.equal(settings.print_heater_c,35);
    assert.equal(settings.dryer_c,35);
    assert.equal(settings.cut_force_gf,'');
    assert.equal(settings.starting_only,true);
    assert.ok(draft.material_notes.length<=4000);
    assert.ok(draft.safety_notes.length<=4000);
    assert.ok(draft.source_url.length<=1200);
    assert.equal(materialSafety('roland_bn2',media.name).blocked,false);
  }
});
test('BN2-30 appears in machine and process UI without changing laser PVC protections',()=>{
  assert.ok(MACHINE_TYPES.some(x=>x.id==='roland_bn2'));
  assert.deepEqual(machineFor('roland_bn2').modes,['print_only','print_cut']);
  assert.equal(materialSafety('xtool_s1','ORAJET PVC vinyl').blocked,true);
  assert.equal(materialSafety('mopa_fiber','Siser heat-transfer vinyl').blocked,true);
  assert.equal(toBn2Draft(BN2_MEDIA.find(x=>x.id==='greenstar-db13')).operation,'print_only');
  assert.equal(toBn2Draft(BN2_MEDIA.find(x=>x.id==='siser-colorprint-pu')).operation,'print_cut');
});
test('manufacturer heat-press instructions are available separately from printer heat',()=>{
  const siser=BN2_MEDIA.find(x=>x.id==='siser-colorprint-pu');
  assert.equal(siser.press.temperatureF,295);
  const sPrint=BN2_MEDIA.find(x=>x.id==='siser-s-print');
  assert.match(String(sPrint.press.temperatureF),/120°C/);
  const roland=BN2_MEDIA.find(x=>x.id==='roland-heatsoft-htmp');
  assert.equal(roland.press.temperatureF,250);
});
