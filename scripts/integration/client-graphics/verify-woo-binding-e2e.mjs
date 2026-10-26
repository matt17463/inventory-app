// End-to-end, no-network NONCUSTOMER acceptance: checkout metadata -> webhook reconciliation -> traveler.
import assert from 'node:assert/strict';
import {fixture,uid,job,asRole,rpc} from './fixture.mjs';
import {adapter} from './adapter.mjs';
import {wooGraphicCartMetadata,parseWooGraphicSelection} from '../../../src/lib/wooGraphicSelection.js';
import {persistWooGraphicSelections} from '../../../netlify/functions/_shared/wooGraphicReconciliation.js';
const db=await fixture(),api=adapter(db),product=797;
const reviews=['woo_product_confirmed','existing_selector_reconciled','physical_sample_verified','artwork_storage_verified'];
const evidence=Object.fromEntries(reviews.map(k=>[k,true]));
// Stage, but never preapprove this test product.
const {rows:[binding]}=await db.query(
 "insert into sc_client_graphic_product_bindings(woo_product_id,graphic_family_id,mode,allowed) values($1,$2,'selectable',false) returning id",
 [product,uid(20)]);
await assert.rejects(asRole(db,'operator',()=>db.query(
 'select public.sc_review_woo_graphic_binding($1,$2,$3,$4)',[binding.id,uid(3),'approve',evidence])),/service role only|permission denied/i);
await assert.rejects(db.query('select public.sc_review_woo_graphic_binding($1,$2,$3,$4)',
 [binding.id,uid(3),'approve',evidence]),/manager approval/i);
await assert.rejects(db.query('select public.sc_review_woo_graphic_binding($1,$2,$3,$4)',
 [binding.id,uid(2),'approve',{}]),/verification checks/i);
const approved=await db.query('select (public.sc_review_woo_graphic_binding($1,$2,$3,$4)).allowed as allowed',
 [binding.id,uid(2),'approve',evidence]);
assert.equal(approved.rows[0].allowed,true);
assert.equal((await db.query('select count(*)::int as n from sc_client_graphic_transfer_reviews where source_key=$1 and status=$2',
 [String(binding.id),'verified'])).rows[0].n,1);
await job(db,72);
// A fictional product form sends canonical metadata into a Woo order line.
const meta_data=wooGraphicCartMetadata({familyId:uid(20),label:'School A'});
const graphic_selection=parseWooGraphicSelection({meta_data});
assert.equal(graphic_selection.status,'mapped');
const line={id:20072,product_id:product,variation_id:0,selected_color:'Black',selected_size:'M',placement:'full_front',graphic_selection};
const order={id:10072,line_items:[line]};
for(let n=0;n<2;n++){
 const result=await persistWooGraphicSelections(api,order);
 assert.deepEqual(result.failures,[]);
 assert.equal(result.saved[0].status,'resolved');
}
const snap=(await db.query("select resolution_snapshot from sc_order_graphic_selections where source='woocommerce' and external_order_id='10072'")).rows[0].resolution_snapshot;
assert.equal(snap.artworkAssetId,uid(11));
assert.equal((await db.query("select count(*)::int as n from sc_order_graphic_selections where external_order_id='10072'")).rows[0].n,1);
assert.equal((await db.query("select status from sc_woo_graphic_capture_states where woo_order_id=10072 and woo_line_item_id=20072")).rows[0].status,'managed_resolved');
const traveler=await asRole(db,'operator',()=>rpc(db,72));
assert.ok(traveler.rows[0].id);
const lineSnapshot=(await db.query('select item_snapshot from sc_job_traveler_lines where job_item_id=720')).rows[0].item_snapshot;
assert.equal(lineSnapshot.approved_graphic_selection.resolution_snapshot.artworkAssetId,uid(11));
await db.query('select public.sc_review_woo_graphic_binding($1,$2,$3,$4)',[binding.id,uid(2),'revoke',{reason:'Isolated acceptance completed'}]);
assert.equal((await db.query('select allowed from sc_client_graphic_product_bindings where id=$1',[binding.id])).rows[0].allowed,false);
console.log('PASS NONCUSTOMER checkout order metadata -> verified binding -> replay-safe webhook reconciliation -> artwork resolution -> traveler snapshot -> revoke');
await db.close();
