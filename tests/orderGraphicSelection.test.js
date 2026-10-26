import test from 'node:test';import assert from 'node:assert/strict';
import {buildOrderGraphicSelection,makeProductionGraphicSnapshot} from '../src/lib/orderGraphicSelection.js';
const id='01234567-89ab-4cde-8abc-0123456789ab';
test('QuickBooks graphic mapping is independent of invoice amounts',()=>{
 const x=buildOrderGraphicSelection({source:'quickbooks',externalOrderId:'INV-42',externalLineId:'1',familyId:id,label:'Orca C'});
 assert.equal(x.source,'quickbooks');assert.equal(x.selected_payload.constructor,Object);
});
test('cannot create graphic selection without order line id',()=>assert.throws(()=>buildOrderGraphicSelection({source:'manual',externalOrderId:'X',familyId:id})));
test('unresolved art never enters production snapshot',()=>assert.throws(()=>makeProductionGraphicSnapshot({selection:{family_id:id},resolution:{status:'conflict'}})));
