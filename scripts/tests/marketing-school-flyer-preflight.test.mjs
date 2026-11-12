import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolFlyerPreflight} from '../../src/lib/marketingSchoolFlyerPreflight.js';

const valid=()=>({
 organization:'Example School',schoolLogo:'data:image/png;base64,approved',
 businessLogo:'data:image/png;base64,approved',colors:['#1A326A'],
 contact:{website:'https://example.org'},
 products:[{name:'School hoodie',mockup:'data:image/png;base64,approved',tiers:[{min:1,wholesale:'20.00',retail:'30.00'}]}]
});
test('verified school flyer can proceed to human review',()=>{
 assert.deepEqual(schoolFlyerPreflight(valid()),{ready:true,errors:[]});
});
test('missing logo, mockup, price, and contact cannot silently render',()=>{
 const d=valid();d.schoolLogo='';d.products[0].mockup='';d.products[0].tiers[0].wholesale='';d.contact={};
 const r=schoolFlyerPreflight(d);
 assert.equal(r.ready,false);
 assert.match(r.errors.join(' '),/logo|mockup|prices|contact/i);
});
test('an uploaded cover does not waive required program-detail mockups and prices',()=>{
 const d=valid();d.products[0].mockup='';
 assert.equal(schoolFlyerPreflight(d).ready,false);
 d.products[0].mockup='data:image/png;base64,approved';
 d.products[0].tiers[0].retail='2.00';
 assert.equal(schoolFlyerPreflight(d).ready,false);
});
test('invalid tier minimum, negative values and fabricated numeric values fail',()=>{
 for(const tier of [{min:0,wholesale:1,retail:2},{min:1,wholesale:-2,retail:3},{min:1,wholesale:'x',retail:3},{min:1,wholesale:4,retail:3}]){
  const d=valid();d.products[0].tiers=[tier];
  assert.equal(schoolFlyerPreflight(d).ready,false);
 }
});
test('no merchandise and missing color both fail',()=>{
 const d=valid();d.products=[];d.colors=[];
 assert.equal(schoolFlyerPreflight(d).ready,false);
});

test('school illustrated cover refuses products it cannot display',()=>{
 const d=valid();d.products=Array.from({length:6},()=>structuredClone(valid().products[0]));
 assert.equal(schoolFlyerPreflight(d).ready,false);
 assert.match(schoolFlyerPreflight(d).errors.join(' '),/at most five/i);
});
