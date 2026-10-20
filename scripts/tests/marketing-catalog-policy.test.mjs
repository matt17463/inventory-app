import test from "node:test";
import assert from "node:assert/strict";
import { marketingSuppliers, marketingTemplates, brandGuideProfiles,
  normalizeSupplierOffer, suggestedBrandGuide, hexToPrintColor, normalizeMarketingCatalogItem, compareMarketingOffers } from "../../src/lib/marketingCatalogPolicy.js";
test("supplier cost source is account wholesale only at S&S and SanMar", () => {
  assert.equal(marketingSuppliers.sanmar.cost_source, "account_wholesale");
  assert.equal(marketingSuppliers.ssactivewear.cost_source, "account_wholesale");
  assert.equal(marketingSuppliers.jpplus.cost_source, "published_web");
  assert.equal(marketingSuppliers.uscutter.cost_source, "published_web");
  const offer = normalizeSupplierOffer({ supplier: "JPPlus", sku: "TEST", unit_cost: "8.25", observed_at: "2026-10-19T00:00:00Z" });
  assert.equal(offer.cost_source, "published_web");
  assert.equal(offer.unit_cost, 8.25);
  assert.throws(() => normalizeSupplierOffer({ supplier: "other", sku: "X", unit_cost: 1, observed_at: "2026-10-19" }));
  assert.throws(() => normalizeSupplierOffer({ supplier: "USCutter", sku: "X", unit_cost: -1, observed_at: "2026-10-19" }));
});
test("template gallery and brand profiles include every promised primary class", () => {
  assert(marketingTemplates.some(t => t.kind === "brand"));
  assert(marketingTemplates.some(t => t.kind === "store"));
  assert(marketingTemplates.some(t => t.kind === "sample"));
  for (const segment of ["team","school","business","nonprofit"]) assert(brandGuideProfiles[segment]);
  const guide = suggestedBrandGuide("team", ["#aabbcc", "#AABBCC"]);
  assert.deepEqual(guide.colors, ["#AABBCC"]);
  assert.equal(guide.approval_required, true);
  assert.match(guide.printing, /Pantone/);
  assert.throws(() => suggestedBrandGuide("team", ["red"]));
});

test("brand color output includes RGB and labeled approximate CMYK", () => {
  assert.deepEqual(hexToPrintColor("#ff0000").rgb, { r:255, g:0, b:0 });
  assert.deepEqual(hexToPrintColor("#000000").cmyk_approx, { c:0, m:0, y:0, k:1 });
  const guide = suggestedBrandGuide("school",["#336699"]);
  assert.equal(guide.color_details.length,1);
  assert.match(guide.color_details[0].note,/ICC profile/);
});

test("comparison keeps verified supplier pricing distinctions", () => {
 const base = {sku:"ABC",name:"Blank",observed_at:"2026-10-19",sizes:["M"],colors:["Black"]};
 const offers=compareMarketingOffers([{...base,supplier:"SanMar",unit_cost:9},{...base,supplier:"JPPlus",unit_cost:7}]);
 assert.equal(offers[0].supplier_name,"Johnson Plastics Plus");
 assert.equal(offers[0].cost_source,"published_web");
 assert.equal(offers[1].cost_source,"account_wholesale");
 assert.equal(offers[0].availability_verified,false);
 assert.equal(normalizeMarketingCatalogItem({...base,supplier:"USCutter",unit_cost:6}).supplier_sku,"ABC");
});

test("missing costs and future observations cannot become verified prices",()=>{
 for(const cost of ["",null,undefined]){
  assert.throws(()=>normalizeSupplierOffer({supplier:"SanMar",sku:"ABC",unit_cost:cost,observed_at:"2026-10-19"}));
 }
 assert.throws(()=>normalizeSupplierOffer({supplier:"SanMar",sku:"ABC",unit_cost:5,observed_at:"2099-01-01"}));
});
