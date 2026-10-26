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

// In-memory Supabase-shaped fixture: verifies the real reconciliation path,
// including persisted checkout metadata, binding checks, and replay identity.
function fixture({mode='selectable',allowed=true,verified=true,variants,rules}={}){
 const rows=new Map(),captures=new Map();
 const data={
  sc_client_graphic_product_bindings:[{graphic_family_id:family,allowed,verified_at:verified?'2026-10-25':null,mode}],
  sc_client_graphic_families:[{id:family,state:'approved'}],
  sc_client_graphic_variants:variants||[{id:variant,family_id:family,state:'approved',artwork_asset_id:'asset-1'}],
  sc_client_graphic_rules:rules||[{id:'rule',family_id:family,variant_id:variant,enabled:true,priority:100,placement_name:'left_chest'}],
 };
 return {rows,captures,db:{from(table){
  const filters=[];
  const query={select(){return query},eq(k,v){filters.push([k,v]);return query},
   maybeSingle(){return Promise.resolve({data:(data[table]||[]).find(x=>filters.every(([k,v])=>k==='woo_product_id'||x[k]===v)),error:null})},
   then(resolve,reject){return Promise.resolve({data:(data[table]||[]).filter(x=>filters.every(([k,v])=>x[k]===v)),error:null}).then(resolve,reject)},
   upsert(payload,options){if(table==='sc_woo_graphic_capture_states'){assert.equal(options.onConflict,'woo_order_id,woo_line_item_id');captures.set([payload.woo_order_id,payload.woo_line_item_id].join(':'),payload)}else{assert.equal(options.onConflict,'source,external_order_id,external_line_id');rows.set([payload.source,payload.external_order_id,payload.external_line_id].join(':'),payload)}return Promise.resolve({error:null})}
  };return query;
 }}};
}
const line=(extra={})=>({id:2,product_id:7,selected_color:'Black',selected_size:'adult',meta_data:[{key:'Print location',value:'left_chest'}],graphic_selection:{status:'mapped',familyId:family,label:'School design B'},...extra});
test('checkout design and placement survive reconciliation, and duplicate webhook upserts one row',async()=>{
 const {db,rows}=fixture();
 const order={id:1,line_items:[line()]};
 for(let i=0;i<2;i++)assert.deepEqual(await persistWooGraphicSelections(db,order),{saved:[{lineId:2,status:'resolved'}],failures:[]});
 assert.equal(rows.size,1);
 const saved=[...rows.values()][0];
 assert.equal(saved.family_id,family);assert.equal(saved.selected_label,'School design B');
 assert.equal(saved.selected_payload.placement_name,'left_chest');assert.equal(saved.resolution_snapshot.artworkAssetId,'asset-1');
});
test('internal, unverified and disabled bindings cannot authorize customer selection',async()=>{
 for(const options of [{mode:'internal'},{verified:false},{allowed:false}]){
  const {db,rows}=fixture(options);
  const result=await persistWooGraphicSelections(db,{id:1,line_items:[line()]});
  assert.equal(result.failures.length,1);assert.equal(rows.size,0);
 }
});
test('missing and conflicting artwork persist unresolved snapshots rather than production files',async()=>{
 for(const options of [{variants:[]},{variants:[{id:variant,family_id:family,state:'approved',artwork_asset_id:'asset-1'},{id:'other',family_id:family,state:'approved',artwork_asset_id:'asset-2'}],rules:[{id:'r1',family_id:family,variant_id:variant,enabled:true,priority:100},{id:'r2',family_id:family,variant_id:'other',enabled:true,priority:100}]}]){
  const {db,rows}=fixture(options);
  await persistWooGraphicSelections(db,{id:1,line_items:[line()]});
  assert.equal([...rows.values()][0].resolution_snapshot,null);
 }
});
test('rule lookup failure is reported without persisting an assignment',async()=>{
 const db={from(table){const query={select(){return query},eq(){return query},upsert(){return Promise.resolve({error:null})},maybeSingle(){return Promise.resolve({data:null,error:{message:'unavailable'}})}};return query}};
 const result=await persistWooGraphicSelections(db,{id:1,line_items:[line()]});
 assert.equal(result.failures[0].reason,'Binding lookup failed');
 await assert.rejects(persistWooGraphicSelections(db,{id:1,line_items:[line()]},{strict:true}),/reconciliation failed/);
});

test('invalid managed graphic ID persists a failure marker',async()=>{
 const {db,captures,rows}=fixture();
 const result=await persistWooGraphicSelections(db,{id:1,line_items:[line({graphic_selection:{status:'invalid-id',rawFamilyId:'bad'}})]});
 assert.equal(result.failures.length,1);assert.equal(rows.size,0);
 assert.equal(captures.get('1:2').status,'managed_failed');
});
test('verified managed capture becomes resolved and is replay-safe',async()=>{
 const {db,captures}=fixture();
 for(let n=0;n<2;n++)await persistWooGraphicSelections(db,{id:1,line_items:[line()]});
 assert.equal(captures.size,1);assert.equal(captures.get('1:2').status,'managed_resolved');
});
test('invalid binding retains pending capture status',async()=>{
 const {db,captures}=fixture({allowed:false});
 await persistWooGraphicSelections(db,{id:1,line_items:[line()]});
 assert.equal(captures.get('1:2').status,'managed_pending');
});

test('Woo variation uses verified parent product binding, never guessed variation binding',async()=>{
 const {db,rows}=fixture();
 const result=await persistWooGraphicSelections(db,{id:100,line_items:[line({product_id:7,variation_id:801})]});
 assert.equal(result.failures.length,0);
 const saved=[...rows.values()][0];
 assert.equal(saved.selected_payload.product_id,7);
 assert.equal(saved.selected_payload.variation_id,801);
});
test('Woo graphic capture with invalid product binding remains pending and not production-resolved',async()=>{
 const {db,captures,rows}=fixture({allowed:false});
 const result=await persistWooGraphicSelections(db,{id:101,line_items:[line({variation_id:801})]});
 assert.equal(result.saved.length,0);
 assert.equal(rows.size,0);
 assert.equal(captures.get('101:2').status,'managed_pending');
});
test('mixed order with one managed line does not invent selections for legacy siblings',async()=>{
 const {db,rows}=fixture();
 const result=await persistWooGraphicSelections(db,{id:102,line_items:[line(),{id:3,product_id:7,graphic_selection:{status:'none'}}]});
 assert.equal(result.saved.length,1);
 assert.equal(rows.size,1);
 assert.ok(rows.has('woocommerce:102:2'));
 assert.equal(rows.has('woocommerce:102:3'),false);
});
