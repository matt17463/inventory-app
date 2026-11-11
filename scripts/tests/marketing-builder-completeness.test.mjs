import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marketingTemplates, suggestedBrandGuide } from "../../src/lib/marketingCatalogPolicy.js";
import { marketingDocumentMissing, parseMarketingProductRows, parseMarketingColorSwatches, renderMarketingDocumentHtml } from "../../src/lib/marketingDocumentContent.js";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
test("template gallery spans client acquisition, pricing, mockups, brand approvals, and events",()=>{
 assert(marketingTemplates.length>=30);
 const categories=new Set(marketingTemplates.map(t=>t.category));
 for(const category of ["Client acquisition","Proposals & pricing","Products & mockups","Artwork & branding","Events & packages","Stores & onboarding","Campaigns"])
  assert(categories.has(category),category);
 assert.equal(new Set(marketingTemplates.map(t=>t.id)).size,marketingTemplates.length);
});

test("AI is reachable without mandatory brief and its copy persists into the exported document",()=>{
 const ui=read("../../src/MarketingDocumentStudio.jsx");
 const endpoint=read("../../netlify/functions/marketing-ai-draft.js");
 assert.match(ui,/disabled=\{aiBusy\} onClick=\{assistWithAI\}/);
 assert.match(ui,/aiText, generated_at:/);
 assert.match(ui,/renderMarketingDocumentHtml\(guide\)/);
 assert.match(endpoint,/freeAIEnabled\(\)/);
 assert.match(endpoint,/process\.env\.OPENAI_API_KEY/);
 assert.match(endpoint,/aiFailure\(response/);
 assert.match(endpoint,/api\.openai\.com\/v1\/responses/);
 assert.doesNotMatch(ui,/JSON\.stringify\(\{[^}]*unitCost[^}]*\}\)/);
});

test("template completeness requires actual mockup images and artwork options",()=>{
 const base={organization:"Example school",template:"product-mockup",style:"Spirit tee",logo:"data:image/png;base64,AAAA",placement:"Left chest"};
 assert.deepEqual([...marketingDocumentMissing(base)],["licensed product/mockup image"]);
 assert.equal(marketingDocumentMissing({...base,productImage:"data:image/png;base64,AAAA"}).length,0);
 const opts={organization:"Example school",template:"logo-options",logoOptions:["data:image/png;base64,AAAA"],placement:"Front chest"};
 assert(marketingDocumentMissing(opts).some(x=>x.includes("artwork options")));
 assert.equal(marketingDocumentMissing({...opts,logoOptions:[opts.logoOptions[0],opts.logoOptions[0]]}).length,0);
 const saved={...base,logo:undefined,productImage:undefined,marketing_artwork:{key:"a"},marketing_product_image:{key:"b"}};
 assert.equal(marketingDocumentMissing(saved).length,0);
});

test("brand guide color validation accepts persisted branding palette",()=>{
 const doc={template:"brand-guide",organization:"Demo",branding:suggestedBrandGuide("school",["#FF0000"]),
  marketing_artwork:{key:"private-r2-reference"}};
 assert.equal(marketingDocumentMissing(doc).length,0);
});

test("multi-product catalogs require one matching real photo per line",()=>{
 const rows=parseMarketingProductRows("T-shirt | 5000 | Youth S | Blue | 20 | 4\nHoodie | 18500 | Adult M | Black | 40 | 2");
 const base={template:"product-catalog",organization:"Demo",productRows:rows,description:"Catalog"};
 assert(marketingDocumentMissing(base).some(x=>x.includes("per catalog line")));
 const doc={...base,productImages:["data:image/png;base64,AAAA","data:image/png;base64,BBBB"]};
 assert.equal(marketingDocumentMissing(doc).length,0);
 const html=renderMarketingDocumentHtml(doc);
 assert(html.includes("gallery-card") && html.includes("$80.00"));
 assert(html.includes("Hoodie") && html.includes("T-shirt"));
});

test("multi-product pricing includes correct totals and excludes internal supplier costs",()=>{
 const rows=parseMarketingProductRows("T-shirt | 5000 | Youth S-L | Black | 19.99 | 20\nHoodie | 18500 | Adult S-XL | Blue | 35 | 10");
 assert.equal(rows.length,2);
 const doc={organization:"Example",template:"pricing-sheet",productRows:rows,description:"<script>unsafe</script>",
  aiText:"Custom apparel for your team",offer:{unit_cost:0.01,cost_source:"account_wholesale"},
  branding:suggestedBrandGuide("team",["#004466"]),generated_at:"2026-11-07"};
 assert.equal(marketingDocumentMissing(doc).length,0);
 const html=renderMarketingDocumentHtml(doc);
 for(const part of ["$399.80","$350.00","T-shirt","Hoodie","Custom apparel for your team","&lt;script&gt;unsafe"])
  assert(html.includes(part),part);
 assert(!html.includes("account_wholesale"));
 assert(!html.includes("0.01"));
 assert.throws(()=>parseMarketingProductRows("T-shirt | 5000 | S | Red | -2 | 4"));
 assert.throws(()=>parseMarketingProductRows("T-shirt | 5000 | S | Red | 20 | 1.2"));
});

test("product color chart separates actual garment swatches from logo colors",()=>{
 const colors=parseMarketingColorSwatches("Royal Blue | #004F9E\nBlack | #000000");
 const doc={organization:"Example",template:"product-color-chart",style:"T-shirt",productColors:"Royal Blue, Black",
  productSwatches:colors,branding:suggestedBrandGuide("school",["#FF0000"]),generated_at:"2026-11-07"};
 assert.equal(marketingDocumentMissing(doc).length,0);
 const html=renderMarketingDocumentHtml(doc);
 assert(html.includes("Royal Blue"));
 assert(html.includes("#004F9E"));
 assert(html.includes("Client logo color palette"));
 assert(html.includes("Garment colors"));
 assert.throws(()=>parseMarketingColorSwatches("Royal Blue | not-a-color"));
});

test("manager approval preflight and private R2 client review include the complete sanitized document",()=>{
 const ui=read("../../src/MarketingDocumentStudio.jsx");
 const get=read("../../netlify/functions/marketing-review-link.js");
 const review=read("../../src/MarketingClientReview.jsx");
 assert.match(ui,/marketingDocumentMissing\(document\.content\|\|\{\}\)/);
 assert.match(ui,/marketing_product_image:storedProductImage/);
 assert.match(ui,/marketing_logo_options:storedLogoOptions/);
 assert.match(ui,/offer: internalSupplierOffer/);
 assert.match(get,/signedReviewAsset/);
 assert.match(get,/content\.product_image_url/);
 assert.match(get,/content\.logo_option_urls/);
 assert.match(get,/publicProductRows/);
 assert.match(get,/marketingDocumentMissing/);
 assert.match(get,/content\.product_image_urls/);
 assert.doesNotMatch(get,/source\.offer/);
 assert.match(review,/reviewData\.content\.aiText/);
 assert.match(review,/reviewData\.content\.productRows/);
 assert.match(review,/reviewData\.content\.productSwatches/);
});
