import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const files = {
  purchasing: read('src/Purchasing.jsx'),
  api: read('src/lib/purchasingPairingApi.js'),
  css: read('src/purchasingPairing.css'),
  sql: read('deployment/sql/60_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql'),
  verify: read('deployment/sql/61_VERIFY_PURCHASING_SOURCELESS_SUGGESTED_ITEM_REPAIR.sql'),
};

const checks = [
  ['Source-less rows expose Fix Suggested Item', /Fix Suggested Item/.test(files.purchasing)],
  ['Existing line-level Fix Pairing remains present', /Fix Pairing/.test(files.purchasing)],
  ['UI previews source-less reservation drivers', /getPurchasingSuggestedItemPreview/.test(files.purchasing)],
  ['UI can move unlinked reservations', /moveUnlinkedReservations/.test(files.purchasing)],
  ['UI can move low-stock threshold', /moveSuggestedThreshold/.test(files.purchasing)],
  ['UI can remember Purchasing replacement rule', /Remember this as a Purchasing replacement rule/.test(files.purchasing)],
  ['API calls suggested-item preview RPC', /sc_purchasing_suggested_item_preview_v1/.test(files.api)],
  ['API calls suggested-item fix RPC', /sc_purchasing_fix_suggested_item_v1/.test(files.api)],
  ['SQL creates replacement rule table', /sc_purchasing_blank_replacement_rules/.test(files.sql)],
  ['SQL creates row repair audit table', /sc_purchasing_row_repair_log/.test(files.sql)],
  ['SQL only moves reservations without a usable job item', /job_item_id is null or joined_job_item_id is null/.test(files.sql)],
  ['SQL leaves linked inactive work unchanged', /inactive_linked_reservations_skipped/.test(files.sql)],
  ['SQL moves threshold using higher target-or-source value', /greatest\(v_target_threshold, v_source_threshold\)/.test(files.sql)],
  ['SQL explicitly records no physical inventory change', /'physical_inventory_changed', false/.test(files.sql)],
  ['SQL does not cast replacement UUID to bigint', !/p_new_blank_product_id\s*::\s*bigint/i.test(files.sql)],
  ['Verification checks the new six-argument repair RPC', /sc_purchasing_fix_suggested_item_v1\(uuid,uuid,text,boolean,boolean,boolean\)/.test(files.verify)],
  ['Mobile source-less button styling included', /purchasing-suggested-fix-button/.test(files.css)],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
  if (!passed) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
