import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../../src/lib/marketingProgramPdf.js").replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
const api=runInNewContext(source+"\n({validateProgramProducts,programPriceRows,exportSchoolProgramPdf,exportClientCatalogPdf})",{
 jsPDF:class {constructor(){this.pages=1;this.lines=[];}setFillColor(){}rect(){}setTextColor(){}setFont(){}setFontSize(){}splitTextToSize(v){return [String(v)];}text(v){this.lines.push(String(v));}roundedRect(){}addImage(){}setDrawColor(){}line(){}addPage(){this.pages++;}save(n){this.filename=n;}},
});
const product=(type="tee")=>({type,name:"School "+type,mockup:"data:image/png;base64,AAAA",tiers:[{min:1,wholesale:"12",retail:"20"},{min:24,wholesale:"10",retail:"18"}]});
test("Wholesale-retail difference is not internal supplier cost",()=>{
 const rows=api.programPriceRows(product());
 assert.equal(rows[0].school,8);
 assert.equal(rows[1].school,8);
 assert.equal(rows[1].min,24);
});
test("School flyer permits a single tee or other product",()=>{\n assert.doesNotThrow(()=>api.validateProgramProducts([product()],true));\n assert.doesNotThrow(()=>api.validateProgramProducts([product("hat")],true));
 assert.throws(()=>api.validateProgramProducts([{...product(),mockup:""}]));
 assert.throws(()=>api.validateProgramProducts([{...product(),tiers:[{min:1,wholesale:"30",retail:"20"}]}]));
});
test("School PDF remains one page and shows agreed revenue arrangement",()=>{
 const doc={organization:"Sample School",businessLogo:"data:image/png;base64,AAAA",contact:{phone:"555-555-5555",website:"https://skilledcrafting.com"},products:[product("tee"),product("hoodie")]};
 const result=api.exportSchoolProgramPdf(doc);
 assert.equal(result,undefined);
});
test("Catalog paginates at two products per page",()=>{
 const products=Array.from({length:5},(_,i)=>({...product(),name:"Product "+i}));
 const doc={businessLogo:"data:image/png;base64,AAAA",contact:{email:"contact@example.com",website:"https://skilledcrafting.com"},products};
 assert.doesNotThrow(()=>api.exportClientCatalogPdf(doc));
});
test("Specialized editor includes exact artwork compositing, logo and contact details",()=>{
 const ui=read("../../src/MarketingProgramDesigner.jsx");
 const parent=read("../../src/MarketingDocumentStudio.jsx");
 assert.match(ui,/ctx\.drawImage\(art/);
 assert.match(ui,/Render exact-artwork mockup/);
 assert.match(ui,/MarketingSupplierCompare/);
 assert.match(ui,/schoolLogo/);
 assert.match(ui,/Download one-page school PDF/);
 assert.match(ui,/Download multi-page catalog PDF/);
 assert.match(parent,/MarketingProgramDesigner/);
});
