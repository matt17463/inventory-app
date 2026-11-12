import test from "node:test";
import assert from "node:assert/strict";
import {defaultStudioRetailPricing,normalizeStudioRetailPricing,validateStudioRetailPricing} from "../../src/lib/marketingStudioRetailPricing.js";
import {studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";
import {readFileSync} from "node:fs";

test("customer-facing merchandise pricing uses verified retail values only",()=>{
 const products=[
  {title:"Personalized glass",retail:"16.50",quantity:"12"},
  {title:"Engraved sign",retail:"32.00",quantity:"2"},
  {title:"Welcome gift",retail:"24.25",quantity:"20"},
  {title:"Decorated tote",retail:"12.00",quantity:"25"}
 ];
 const r=validateStudioRetailPricing({enabled:true,products});
 assert.equal(r.ready,true);
 assert.deepEqual(r.examples.map(x=>x.total),["$198.00","$64.00","$485.00","$300.00"]);
 assert.equal(r.grandTotal,"$1,047.00");
 const html=studioPrintHtml({category:"wedding",retailPricing:{enabled:true,products}});
 assert.ok(html.includes("ILLUSTRATIVE APPROVED PRODUCT PRICING"));
 assert.ok(html.includes("Personalized glass"));
 assert.ok(html.includes("$1,047.00"));
 assert.ok(!html.includes("Decorated wholesale"));
});
test("retail price list disallows missing names, excessive entries, invalid amounts and script injection",()=>{
 const p={title:"Cup",retail:"15.50",quantity:"5"};
 for(const products of [[p,p,p,p,p],[{...p,title:""}],[{...p,retail:"-1"}],[{...p,quantity:"2.5"}],[{...p,retail:"12.345"}]]){
  assert.equal(validateStudioRetailPricing({enabled:true,products}).ready,false);
 }
 assert.equal(validateStudioRetailPricing(defaultStudioRetailPricing()).ready,true);
 assert.equal(normalizeStudioRetailPricing({enabled:true,products:[p]}).products[0].title,"Cup");
 const html=studioPrintHtml({category:"business",retailPricing:{enabled:true,products:[{...p,title:'<svg onload=alert(1)>'}]}});
 assert.ok(html.includes("&lt;svg onload=alert(1)&gt;"));
 assert.ok(!html.includes("<svg onload=alert(1)>"));
});
test("retail pricing remains disabled for fundraising audiences, while other flyers can show it",()=>{
 const pricing={enabled:true,products:[{title:"Gift",retail:"10.00",quantity:"10"}]};
 for(const cat of ["school","team","nonprofit"])assert.ok(!studioPrintHtml({category:cat,retailPricing:pricing}).includes('class="retail-mini multi-fundraising"'));
 for(const cat of ["business","wedding","event","general"])assert.ok(studioPrintHtml({category:cat,retailPricing:pricing}).includes('class="retail-mini multi-fundraising"'));
});
test("retail choices persist with the client draft and export requires verified retail input",()=>{
 const ui=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.ok(ui.includes("schoolFundraising,studioServices,retailPricing,productLabels"));
 assert.ok(ui.includes("validateStudioRetailPricing(retailPricing)"));
 assert.ok(ui.includes("setRetailPricing(normalizeStudioRetailPricing(d.retailPricing))"));
 assert.ok(ui.includes("Add retail product option"));
});
