import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizePlugins,summarizeShippingZones,skuSampleDiagnostics,wpPluginSlug} from '../../netlify/functions/_shared/commerceIntegrityAnalysis.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const snapshot=JSON.parse(read('../../src/application-guide/commerceIntegritySnapshot.json'));
test('plugin snapshot makes historic source dated and does not claim end-to-end verification',()=>{
 assert.equal(snapshot.sourceStatus,'partial-audit-not-live-certified');
 assert.equal(snapshot.pluginSnapshot.storefront.installedVersion,'0.1.2');
 const php=read('../../wordpress/skilled-crafting-client-stores/skilled-crafting-client-stores.php');
 assert.equal(php.match(/Version:\s*(\S+)/)?.[1],snapshot.pluginSnapshot.storefront.repositoryVersion);
 assert.equal(snapshot.pluginSnapshot.storefront.repositoryVersion,'0.1.4');
 assert.equal(snapshot.pendingChecks.length,3);
});
test('WordPress plugin API normalization identifies active SKU candidates and storefront version mismatch',()=>{
 const rows=[
  {plugin:'skilled-crafting-client-stores/skilled-crafting-client-stores.php',version:'0.1.2',status:'active'},
  {plugin:'wc-sku-builder-manager-v3-clean/wc-sku-builder-manager-v3-clean.php',version:'2.4',status:'active'},
  {plugin:'woocommerce-product-sku-generator/main',version:'2.5',status:'active'},
  {plugin:'sku-for-woocommerce/main',version:'1.6',status:'inactive'},
  {plugin:'woocommerce-advanced-free-shipping/main',version:'1.1',status:'active'},
 ];
 assert.equal(wpPluginSlug(rows[0].plugin),'skilled-crafting-client-storefronts');
 assert.equal(wpPluginSlug(rows[1].plugin),'wc-sku-builder-manager');
 const result=summarizePlugins(rows);
 assert.equal(result.storefront.match,false);
 assert.equal(result.storefront.originalBasename,'skilled-crafting-client-stores');
 assert.equal(result.multipleSkuWriterCandidates,true);
 assert.equal(result.skuWriters.length,2);
 assert(result.skuWriters.some(x=>x.slug==='wc-sku-builder-manager'&&x.originalBasename==='wc-sku-builder-manager-v3-clean'));
 assert(result.skuWriters.every(x=>x.internalGenerationEnabled==='unknown-from-rest'));
 assert.equal(result.advancedFreeShippingActive,true);
});
test('Woo shipping methods show configuration, not calculated checkout rates',()=>{
 const zones=[{id:2,name:'Kitsap County'},{id:0,name:'Rest of US'}];
 const methods={2:[
  {instance_id:3,method_id:'free_shipping',title:'Free shipping',enabled:true,
   settings:{requires:{value:'either'},min_amount:{value:'200'}}},
  {instance_id:5,method_id:'flat_rate',title:'Flat rate',enabled:true,settings:{cost:{value:'0'}}},
 ],0:[]};
 const result=summarizeShippingZones(zones,methods);
 assert.equal(result.zones[0].hasCoreFreeShipping,true);
 assert.equal(result.zones[0].hasFlatRate,true);
 assert.equal(result.zones[0].methods[0].minAmount,'200');
 assert.match(result.caveat,/not calculated against any real cart/);
 assert.equal(result.zones[1].activeMethodCount,0);
});
test('SKU sampling returns only aggregate counts and never exposes customer or product identifiers',()=>{
 const x=skuSampleDiagnostics([{id:1,sku:'A'},{id:2,sku:''}],[{id:3,sku:'A'},{id:4,sku:'B'}]);
 assert.deepEqual({count:x.recordsScanned,blank:x.withoutSku,duplicates:x.duplicateSkuCount}, {count:4,blank:1,duplicates:1});
 assert(!JSON.stringify(x).includes('"A"'));
 assert(x.limitedSample);
});
test('server endpoint is manager-only GET with bounded reads and no data mutation',()=>{
 const api=read('../../netlify/functions/wordpress-commerce-integrity.js');
 assert.match(api,/allowedRoles:\['admin','manager'\]/);
 assert.match(api,/event\.httpMethod!=='GET'/);
 assert.match(api,/AbortSignal\.timeout\(10000\)/);
 assert.match(api,/per_page=25/);
 assert.match(api,/slice\(0,8\)/);
 assert.match(api,/action:\s*'read-only'|readOnly:true/);
 assert.doesNotMatch(api,/method:'(?:POST|PUT|PATCH|DELETE)'|\.from\([^)]+\)\.(?:insert|update|delete)|upsertWpStore/);
 assert.match(api,/WordPress.*WAF/);
});
test('manager UI states unmatched details and never allows editing SKU or shipping methods',()=>{
 const src=read('../../src/WordPressCommerceIntegrity.jsx');
 const app=read('../../src/App.jsx'),nav=read('../../src/navigationConfig.js');
 assert.match(src,/access\?\.role==='admin'\|\|access\?\.role==='manager'/);
 assert.match(src,/Run read-only checks/);
 assert.match(src,/not a verified customer charge error/i);
 assert.match(src,/not confirmed/i);
 assert.match(src,/baseline\.pendingChecks/);
 assert.match(app,/path="\/wordpress-integrity"/);
 assert.match(nav,/WordPress Commerce Integrity/);
 assert.doesNotMatch(src,/onClick=.*(?:saveSku|updateShippingZone|activatePlugin)/);
});
test('guide covers each risk with owner handoff and staging fixtures',()=>{
 const guide=read('../../src/application-guide/guideData.js');
 assert.match(guide,/wordpress-commerce-integrity-preflight/);
 assert.match(guide,/wp-integrity-storefront/);
 assert.match(guide,/wp-integrity-sku/);
 assert.match(guide,/wp-integrity-shipping/);
 assert.match(guide,/\$199\.99\/\$200\/\$200\.01/);
});
