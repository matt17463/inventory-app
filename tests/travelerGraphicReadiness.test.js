import test from 'node:test';import assert from 'node:assert/strict';
import {validateTravelerGraphicReadiness as check} from '../src/lib/travelerGraphicReadiness.js';
const id='01234567-89ab-4cde-8abc-0123456789ab';
const recipe={status:'approved',placements:[{artwork_asset_id:id}]};
const assets=[{id,preflight_status:'passed'}];
test('allows approved matching artwork',()=>assert.equal(check({items:[{id:1}],recipeVersion:recipe,artworkAssets:assets}).ready,true));
test('blocks missing artwork',()=>assert.equal(check({items:[{id:1}],recipeVersion:recipe}).ready,false));
test('blocks unapproved artwork',()=>assert.equal(check({items:[{id:1}],recipeVersion:recipe,artworkAssets:[{id,preflight_status:'pending'}]}).ready,false));
test('blocks incompatible graphic families',()=>assert.equal(check({items:[{id:1},{id:2}],recipeVersion:recipe,artworkAssets:assets,selections:[{family_id:'a'},{family_id:'b'}]}).ready,false));
test('blocks mismatched customer art',()=>assert.equal(check({items:[{id:1}],recipeVersion:recipe,artworkAssets:assets,selections:[{family_id:'a',resolution_snapshot:{artworkAssetId:'different'}}]}).ready,false));

test('supports legacy approved recipe-wide artwork when no per-placement entries exist',()=>assert.equal(check({items:[{id:1}],recipeVersion:{status:'approved',artwork_asset_id:id,placements:[]},artworkAssets:assets}).ready,true));

const generic={status:'approved',artwork_asset_id:null,placements:[
 {placement_name:'full_front',print_width_inches:8},
 {placement_name:'sleeve',print_width_inches:3.5},
 {placement_name:'full_back',print_width_inches:11},
]};
const assignment=(n,placements)=>({[n]:placements.map(name=>({placement_name:name,artwork_asset_id:id}))});
test('generic two-position recipe allows exact approved line artwork',()=>{
 const result=check({items:[{id:10}],recipeVersion:{...generic,placements:generic.placements.slice(0,2)},
  artworkAssets:assets,lineArtworkByItem:assignment(10,['full_front','sleeve'])});
 assert.equal(result.ready,true);
});
test('generic three-position recipe allows exact approved line artwork',()=>{
 const result=check({items:[{id:11}],recipeVersion:generic,artworkAssets:assets,
  lineArtworkByItem:assignment(11,['full_front','sleeve','full_back'])});
 assert.equal(result.ready,true);
});
test('generic recipe blocks missing one of three artwork positions',()=>{
 const result=check({items:[{id:12}],recipeVersion:generic,artworkAssets:assets,
  lineArtworkByItem:assignment(12,['full_front','sleeve'])});
 assert.equal(result.ready,false);assert.match(result.blockers.join(' '),/full_back/);
});
test('generic recipe blocks a position assigned to another line',()=>{
 const result=check({items:[{id:13}],recipeVersion:generic,artworkAssets:assets,
  lineArtworkByItem:assignment(14,['full_front','sleeve','full_back'])});
 assert.equal(result.ready,false);
});
test('generic recipe blocks unapproved attached artwork',()=>{
 const result=check({items:[{id:15}],recipeVersion:generic,artworkAssets:[{id,preflight_status:'failed'}],
  lineArtworkByItem:assignment(15,['full_front','sleeve','full_back'])});
 assert.equal(result.ready,false);
});

test('managed selection cannot borrow a sibling order line artwork assignment',()=>{
 const different='01234567-89ab-4cde-8abc-0123456789ac';
 const result=check({items:[{id:20},{id:21}],recipeVersion:{status:'approved',placements:[{placement_name:'full_front'}]},
  artworkAssets:[...assets,{id:different,preflight_status:'passed'}],
  lineArtworkByItem:{20:[{placement_name:'full_front',artwork_asset_id:different}],
   21:[{placement_name:'full_front',artwork_asset_id:id}]},
  selections:[{job_item_id:20,family_id:'customer-one',resolution_snapshot:{status:'resolved',artworkAssetId:id}}]});
 assert.equal(result.ready,false);assert.match(result.blockers.join(' '),/does not match/);
});
