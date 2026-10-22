import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wpPluginSlug,summarizePlugins} from '../../netlify/functions/_shared/commerceIntegrityAnalysis.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('live installed basename aliases are recognized without broad fuzzy matching',()=>{
 assert.equal(wpPluginSlug('skilled-crafting-client-stores/skilled-crafting-client-stores.php'),'skilled-crafting-client-storefronts');
 assert.equal(wpPluginSlug('wc-sku-builder-manager-v3-clean/wc-sku-builder-manager-v3-clean.php'),'wc-sku-builder-manager');
 assert.equal(wpPluginSlug('some-other-storefront-manager/plugin.php'),'some-other-storefront-manager');
 const rows=[{plugin:'skilled-crafting-client-stores/plugin.php',version:'0.1.2',status:'active'},
  {plugin:'wc-sku-builder-manager-v3-clean/plugin.php',version:'2.4',status:'active'},
  {plugin:'woocommerce-product-sku-generator/plugin.php',version:'2.5',status:'active'},
  {plugin:'sku-for-woocommerce/plugin.php',version:'1.6',status:'active'}];
 const snap=summarizePlugins(rows);
 assert.equal(snap.storefront.installedVersion,'0.1.2');
 assert.equal(snap.skuWriters.length,3);
 assert.equal(snap.skuWriters.find(x=>x.slug==='sku-for-woocommerce').internalGenerationEnabled,'unknown-from-rest');
});
test('approved-remediation plan distinguishes findings from observed production incidents',()=>{
 const doc=read('../../docs/wordpress-audit/OWNER_REMEDIATION_APPROVAL_20261022.md');
 for(const term of ['AWAITING OWNER APPROVAL','100%','GET','nonce','Staging','>= $200','QuickBooks','Woo','STOREFRONT_DEPLOYED_CODE_COMPARE.md','SHIPPING_RULE_VERIFICATION.md']){
  assert(doc.includes(term),'Missing key remediator '+term);
 }
 assert.match(doc,/No customer.*leakage observed|no leakage observed/i);
 assert.match(doc,/No.*customer charge|No checkout rates observed/i);
});
test('new guide and training keep WordPress write paths read-only',()=>{
 const guide=read('../../src/application-guide/guideData.js');
 const training=read('../../src/application-guide/trainingData.js');
 assert.match(guide,/wordpress-commerce-audit-confirmed-20261022/);
 for(const marker of ['commerce-owner-coupon-policy','commerce-storefront-safe-upgrade','commerce-sku-write-security','commerce-shipping-owner-policy','commerce-isolated-testing'])
  assert(guide.includes(marker),marker);
 assert(training.includes('wp-commerce-confirmed-risks-owner-approval-20261022'));
 assert.match(training,/Do not run a batch SKU rebuild/);
});
test('PDF generator includes confirmed audit findings and safe wrapping before publication',()=>{
 const pdf=read('../../scripts/build-application-guide-pdf.mjs');
 assert.match(pdf,/product-page client-context resolution/);
 assert.match(pdf,/100% coupon/);
 assert.match(pdf,/maxWidth:bodyW-indent-12/);
 assert.match(pdf,/bodyW-indent-20/);
 assert.match(pdf,/No real checkout totals were measured/i);
});
test('commerce snapshot remains dated, leaves staging and owner approval outstanding',()=>{
 const snapshot=JSON.parse(read('../../src/application-guide/commerceIntegritySnapshot.json'));
 assert.equal(snapshot.pendingChecks.length,3);
 assert.equal(snapshot.deepInspection.readOnly,true);
 assert.equal(snapshot.deepInspection.endToEndValidated,false);
 assert.equal(snapshot.deepInspection.shipping.publishedHundredPercentCouponWithFreeShipping,true);
 assert.equal(snapshot.deepInspection.staging.ownerApprovalRequired,true);
});
