import test from 'node:test';import assert from 'node:assert/strict';
import {parseWooGraphicSelection,wooGraphicCartMetadata} from '../src/lib/wooGraphicSelection.js';
const id='01234567-89ab-4cde-8abc-0123456789ab';
test('captures canonical family id and label',()=>{
 const m=wooGraphicCartMetadata({familyId:id,label:'Orca Design B'});
 assert.deepEqual(parseWooGraphicSelection({meta_data:m}),{status:'mapped',familyId:id,label:'Orca Design B',rawFamilyId:id});
});
test('legacy text-only order is flagged for manual mapping',()=>assert.equal(parseWooGraphicSelection({meta_data:[{key:'Graphic',value:'Classic Logo'}]}).status,'legacy-unmapped'));
test('invalid family id cannot masquerade as approved selection',()=>assert.equal(parseWooGraphicSelection({meta_data:[{key:'_sc_graphic_family_id',value:'abc'}]}).status,'invalid-id'));
