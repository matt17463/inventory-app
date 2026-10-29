import test from 'node:test';
import assert from 'node:assert/strict';
import {STARTER_PRODUCTS,PACKAGE_TEMPLATES,packageTemplate,packageTotals,productEconomics,opportunityScore,readyForProduction,normalizeGuestNames,normalizeSourceUrl} from '../../src/lib/productDevelopment.js';
test('starter items include weddings, coaches, businesses and all six key devices',()=>{
 assert.ok(STARTER_PRODUCTS.some(p=>p.category==='Weddings & Events'));
 assert.ok(STARTER_PRODUCTS.some(p=>p.category==='Sports & Coaches'));
 assert.ok(STARTER_PRODUCTS.some(p=>p.category==='Business Branding'));
 for(const id of ['xtool_s1','xtool_p2','xtool_omni','mopa_fiber','roland_bn2','sawgrass_sg500'])
  assert.ok(STARTER_PRODUCTS.some(p=>p.equipment.includes(id)),id);
});
test('event packages offer wedding and coach recognition variants',()=>{
 assert.ok(PACKAGE_TEMPLATES.filter(p=>p.event_type==='wedding').length>=3);
 assert.ok(PACKAGE_TEMPLATES.filter(p=>p.event_type==='coach_recognition').length>=2);
 const x=packageTemplate('wedding-signature',125,12);
 assert.equal(x.items.find(i=>i.label==='Guest favors').quantity,125);
 assert.equal(x.items.find(i=>i.label==='Table number').quantity,12);
 assert.equal(packageTemplate('not-found'),null);
});
test('economics accounts for active labor, machine time, fees, fixed setup and spoilage',()=>{
 const p=productEconomics({units:10,sell_price:100,blank_cost:15,consumables:5,packaging:2,labor_minutes:30,labor_hourly_rate:20,
 machine_minutes:20,machine_hourly_rate:30,other_variable_cost:0,spoilage_rate_percent:10,channel_fee_percent:5,setup_cost:100});
 // base variable cost = 42; 10% waste = 46.6667; 5 channel fees; 10 setup = 61.6667
 assert.ok(Math.abs(p.perUnitCost-(42/.9+5+10))<.001);
 assert.ok(Math.abs(p.contribution-(100-42/.9-5-10))<.001);
 assert.equal(p.revenue,1000);
 assert.ok(Number.isFinite(p.contributionPerLaborHour));
 assert.ok(Number.isFinite(p.contributionPerMachineHour));
});
test('package totals use unit quantities and never invent margins',()=>{
 assert.deepEqual(packageTotals([{quantity:5,unit_cost:4,unit_price:15},{quantity:2,unit_cost:2,unit_price:8}]),{units:7,price:91,cost:24});
});
test('market score is bounded and zero without actual input',()=>{
 assert.equal(opportunityScore({}),0);
 assert.equal(opportunityScore({customer_fit:100,demand_score:100,production_fit:100,differentiation_score:100}),100);
});
test('production readiness requires approved recipe and customer proof/artwork revision',()=>{
 const recipe={id:'r',status:'approved'};
 assert.equal(readyForProduction({recipe_id:'r',proof_status:'approved',approved_artwork_revision:'rev2'},[recipe]).ok,true);
 assert.equal(readyForProduction({recipe_id:'r',proof_status:'pending',approved_artwork_revision:'rev2'},[recipe]).ok,false);
 assert.equal(readyForProduction({recipe_id:'r',proof_status:'approved'},[recipe]).ok,false);
 assert.equal(readyForProduction({recipe_id:'r',proof_status:'approved',approved_artwork_revision:'rev2'},[{id:'r',status:'draft'}]).ok,false);
});
test('guest list preserves duplicate real names and strips blank lines',()=>{
 assert.deepEqual(normalizeGuestNames('Alex\nSam\nAlex\n\n'),['Alex','Sam','Alex']);
});
test('external URLs allow only safe HTTPS and no embedded credentials',()=>{
 assert.equal(normalizeSourceUrl('javascript:alert(1)'),null);
 assert.equal(normalizeSourceUrl('http://example.com'),null);
 assert.equal(normalizeSourceUrl('https://user:pass@example.com'),null);
 assert.equal(normalizeSourceUrl('https://example.com/'), 'https://example.com/');
});
