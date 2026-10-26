import test from 'node:test';import assert from 'node:assert/strict';
import {graphicCompatibilityState as check} from '../src/lib/graphicCompatibility.js';
test('legacy Woo order stays usable with manual recipe',()=>assert.deepEqual(check({channel:'woocommerce',unmapped_line_ids:[1]}).blocked,false));
test('partial migration blocks mismatched orders',()=>assert.equal(check({channel:'woocommerce',unmapped_line_ids:[2],selections:[{family_id:'a',resolution_snapshot:{artworkAssetId:'asset'}}]}).blocked,true));
test('unresolved verified graphic blocks production',()=>assert.equal(check({channel:'woocommerce',selections:[{family_id:'a'}]}).blocked,true));
test('lookup error remains fail closed',()=>assert.equal(check({channel:'woocommerce',error:'network error'}).blocked,true));
