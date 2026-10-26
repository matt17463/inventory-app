import test from 'node:test';import assert from 'node:assert/strict';
import {graphicCompatibilityState as check} from '../src/lib/graphicCompatibility.js';
test('legacy Woo order stays usable with manual recipe',()=>assert.deepEqual(check({channel:'woocommerce',unmapped_line_ids:[1]}).blocked,false));
test('partial migration blocks mismatched orders',()=>assert.equal(check({channel:'woocommerce',unmapped_line_ids:[2],selections:[{family_id:'a',resolution_snapshot:{artworkAssetId:'asset'}}]}).blocked,true));
test('unresolved verified graphic blocks production',()=>assert.equal(check({channel:'woocommerce',selections:[{family_id:'a'}]}).blocked,true));
test('lookup error remains fail closed',()=>assert.equal(check({channel:'woocommerce',error:'network error'}).blocked,true));

test('managed capture failure cannot fall back to legacy',()=>assert.equal(check({channel:'woocommerce',selections:[{capture_status:'managed_failed'}]}).blocked,true));
test('managed pending is not treated as legacy',()=>assert.equal(check({channel:'woocommerce',selections:[{capture_status:'managed_pending'}]}).blocked,true));

test('resolved managed capture without selection is blocked',()=>assert.equal(check({channel:'woocommerce',selections:[{capture_status:'managed_resolved'}]}).blocked,true));
