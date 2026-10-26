import test from 'node:test';import assert from 'node:assert/strict';
import {resolveGraphicVariant} from '../src/lib/clientGraphicsRules.js';
import {persistWooGraphicSelections} from '../netlify/functions/_shared/wooGraphicReconciliation.js';
const family='01234567-89ab-4cde-8abc-0123456789ab',variant='11234567-89ab-4cde-8abc-0123456789ab';
test('matching rule resolves to specific artwork asset',()=>{
 const result=resolveGraphicVariant({familyId:family,variants:[{id:variant,family_id:family,state:'approved',artwork_asset_id:'asset-1'}],
 rules:[{id:'rule',family_id:family,variant_id:variant,enabled:true,priority:100,garment_color:'Black'}],
 context:{garment_color:'BLACK'}});
 assert.equal(result.status,'resolved');assert.equal(result.artworkAssetId,'asset-1');
});
test('Woo reconciliation never assigns legacy text-only artwork',async()=>{
 const db={from(){throw Error('Legacy should not hit DB')}};
 assert.deepEqual(await persistWooGraphicSelections(db,{id:1,line_items:[{id:2,graphic_selection:{status:'legacy-unmapped',label:'Orca'}}]}),{saved:[],failures:[]});
});
