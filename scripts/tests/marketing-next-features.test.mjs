import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const fetchText = (path) => readFileSync(new URL(path,import.meta.url),"utf8");
test("catalog endpoint is read only, employee restricted and never makes stock or pricing claims",()=>{
 const source=fetchText("../../netlify/functions/marketing-catalog-search.js");
 assert.match(source,/allowedRoles:\["admin","manager","operator","marketing"\]/);
 assert.match(source,/supplier_catalog_review/);
 assert.match(source,/availability_verified:false/);
 assert.match(source,/price_verified:false/);
 assert.doesNotMatch(source,/\.insert\(/);
 assert.doesNotMatch(source,/\.update\(/);
});
test("store concept explicitly omits working checkout",()=>{
 const source=fetchText("../../src/MarketingStorePreview.jsx");
 assert.match(source,/NOT A LIVE STORE/);
 assert.match(source,/No checkout, live orders or product availability implied/);
});

test("imported catalog selection retains matching supplier",()=>{
 const source=fetchText("../../src/MarketingSupplierCompare.jsx");
 assert.match(source,/setSupplier\(Object\.keys\(marketingSuppliers\)/);
 assert.match(source,/p\.supplier_name/);
});

test("supplier readiness does not expose credentials or invent live prices",()=>{
 const src=fetchText("../../netlify/functions/marketing-supplier-feed-status.js");
 assert.match(src,/pricing_live:false/);
 assert.match(src,/supplier_catalog_feeds/);
 assert.doesNotMatch(src,/http_headers|feed_url|unit_cost/);
});
test("mockup editor combines the original product photo and artwork with canvas export",()=>{
 const src=fetchText("../../src/MarketingProductMockup.jsx");
 assert.match(src,/ctx\.drawImage\(blank/);
 assert.match(src,/ctx\.drawImage\(logo/);
 assert.match(src,/toDataURL\("image\/png"\)/);
 assert.match(fetchText("../../src/MarketingStorePreview.jsx"),/MarketingProductMockup/);
});

test("AI prospect search requires employee role and live web research",()=>{
 const endpoint=fetchText("../../netlify/functions/marketing-prospect-research.js");
 const ui=fetchText("../../src/MarketingProspectDiscovery.jsx");
 assert.match(endpoint,/allowedRoles:\["admin","manager","marketing"\]/);
 assert.match(endpoint,/web_search/);
 assert.match(endpoint,/validPublicWebsite/);
 assert.match(endpoint,/requires_review:true/);
 assert.match(ui,/Find prospective clients/);
 assert.match(fetchText("../../src/MarketingWorkspace.jsx"),/ai_prospects/);
});
