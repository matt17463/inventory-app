import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGraphicVariant} from '../src/lib/clientGraphicsRules.js';
const variants=[
 {id:'adult',family_id:'school',state:'approved',artwork_asset_id:'asset10',version:2,width_inches:10,height_inches:10,process:'DTF'},
 {id:'youth',family_id:'school',state:'approved',artwork_asset_id:'asset8',version:1,width_inches:8,height_inches:8,process:'DTF'},
 {id:'draft',family_id:'school',state:'draft',artwork_asset_id:'draftAsset',version:1},
];
const rules=[
 {id:'a',family_id:'school',variant_id:'adult',enabled:true,priority:10,size_group:'adult',placement_name:'full_front'},
 {id:'y',family_id:'school',variant_id:'youth',enabled:true,priority:10,size_group:'youth',placement_name:'full_front'},
 {id:'x',family_id:'school',variant_id:'draft',enabled:true,priority:100},
];
test('resolves adult without choosing unapproved higher priority file',()=>{
 const out=resolveGraphicVariant({familyId:'school',variants,rules,context:{size_group:'adult',placement_name:'full_front'}});
 assert.equal(out.status,'resolved');assert.equal(out.artworkAssetId,'asset10');assert.equal(out.variantVersion,2);
});
test('resolves youth size independently',()=>{
 const out=resolveGraphicVariant({familyId:'school',variants,rules,context:{size_group:'youth',placement_name:'full_front'}});
 assert.equal(out.variantId,'youth');
});
test('missing match blocks production',()=>assert.equal(resolveGraphicVariant({familyId:'school',variants,rules,context:{size_group:'other'}}).status,'unresolved'));
test('equal ranked competing variants cause conflict',()=>{
 const duplicate={id:'a2',family_id:'school',variant_id:'youth',enabled:true,priority:10,size_group:'adult',placement_name:'full_front'};
 assert.equal(resolveGraphicVariant({familyId:'school',variants,rules:[...rules,duplicate],context:{size_group:'adult',placement_name:'full_front'}}).status,'conflict');
});
test('fixed current design without rules cannot silently resolve',()=>assert.equal(resolveGraphicVariant({familyId:'school',variants,rules:[]}).status,'unresolved'));
