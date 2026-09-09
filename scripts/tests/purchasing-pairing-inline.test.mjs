import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const files = {
  purchasing: read('src/Purchasing.jsx'),
  api: read('src/lib/purchasingPairingApi.js'),
  css: read('src/purchasingPairing.css'),
  sql: read('deployment/sql/58_PURCHASING_INLINE_PAIRING_REPAIR.sql'),
  verify: read('deployment/sql/59_VERIFY_PURCHASING_INLINE_PAIRING_REPAIR.sql'),
};

const checks = [
  ['Purchasing exposes Fix Pairing', /Fix Pairing/.test(files.purchasing)],
  ['Purchasing shows remember-future-order control', /Remember this pairing for future orders/.test(files.purchasing)],
  ['Purchasing refreshes report after a saved correction', /await loadData\(\)/.test(files.purchasing)],
  ['Purchasing calls dedicated correction API', /fixPurchasingPairing/.test(files.purchasing)],
  ['API calls sc_purchasing_fix_pairing_v1', /sc_purchasing_fix_pairing_v1/.test(files.api)],
  ['API rejects MANUAL placeholder SKUs as reusable keys', /MANUAL-\\d\+-LINE-\\d\+/.test(files.api)],
  ['SQL enriches demand source with job item id', /'job_item_id', job_item_id/.test(files.sql)],
  ['SQL enriches demand source with Woo variation id', /'woocommerce_variation_id', woocommerce_variation_id/.test(files.sql)],
  ['SQL uses pull-sheet override RPC', /override_job_item_blank_pairing/.test(files.sql)],
  ['SQL uses durable mapping lifecycle RPC', /sc_set_product_blank_mapping_v1/.test(files.sql)],
  ['SQL does not cast replacement blank UUID to bigint', !/p_new_blank_product_id\s*::\s*bigint/i.test(files.sql)],
  ['Verification checks new RPC', /sc_purchasing_fix_pairing_v1\(bigint,uuid,text,boolean\)/.test(files.verify)],
  ['Mobile-friendly modal CSS included', /@media \(max-width: 640px\)/.test(files.css)],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}`);
  if (!passed) failed += 1;
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
