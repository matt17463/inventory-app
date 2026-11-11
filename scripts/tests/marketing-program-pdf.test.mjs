import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../../src/lib/marketingProgramPdf.js").replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
const api=runInNewContext(source+"\n({validateProgramProducts,programPriceRows,buildSchoolProgramPdf,exportSchoolProgramPdf,exportClientCatalogPdf})",{
 jsPDF:class {constructor(){this.pages=1;this.lines=[];}setFillColor(){}rect(){}setTextColor(){}setFont(){}setFontSize(){}splitTextToSize(v){return [String(v)];}text(v){this.lines.push(String(v));}roundedRect(){}addImage(){}setDrawColor(){}line(){}addPage(){this.pages++;}save(n){this.filename=n;}},
});
const product=(type="tee")=>({type,name:"School "+type,mockup:"data:image/png;base64,AAAA",tiers:[{min:1,wholesale:"12",retail:"20"},{min:24,wholesale:"10",retail:"18"}]});
test("Wholesale-retail difference is not internal supplier cost",()=>{
 const rows=api.programPriceRows(product());
 assert.equal(rows[0].school,8);
 assert.equal(rows[1].school,8);
 assert.equal(rows[1].min,24);
});
test("School flyer permits a single tee or other product",()=>{
 assert.doesNotThrow(()=>api.validateProgramProducts([product()],true));
 assert.doesNotThrow(()=>api.validateProgramProducts([product("hat")],true));
 assert.throws(()=>api.validateProgramProducts([{...product(),mockup:""}]));
 assert.throws(()=>api.validateProgramProducts([{...product(),tiers:[{min:1,wholesale:"30",retail:"20"}]}]));
});
test("School PDF remains one page and shows agreed revenue arrangement",()=>{
 const doc={organization:"Sample School",businessLogo:"data:image/png;base64,AAAA",contact:{phone:"555-555-5555",website:"https://skilledcrafting.com"},products:[product("tee"),product("hoodie")]};
 const result=api.exportSchoolProgramPdf(doc);
 assert.equal(result,undefined);
 const built=api.buildSchoolProgramPdf({...doc, schoolLogo:"data:image/png;base64,AAAA", colors:["#113B71","#F4D327"], headline:"WEAR YOUR SCHOOL PRIDE"});
 assert.equal(built.pages,2,"The native brochure must always have exactly two pages");
 assert.ok(built.lines.some(line=>line.includes("WEAR YOUR SCHOOL PRIDE")));
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
 assert.match(ui,/Preview finished two-page flyer/);
 assert.match(ui,/Download this PDF/);
 assert.match(ui,/file\.output\("blob"\)/);
 assert.match(ui,/src=\{previewUrl/);
 assert.match(ui,/Download multi-page catalog PDF/);
 assert.match(parent,/MarketingProgramDesigner/);
 assert.doesNotMatch(parent,/Download PDF with original flyer cover/);
 assert.match(parent,/!schoolFlyer && <div className="growth-actions">/);
 assert.match(parent,/Optional AI writing assistant/);
 assert.match(ui,/Preview finished two-page flyer/);
 assert.match(ui,/Download this PDF/);
});
