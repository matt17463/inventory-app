import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {marketingTemplates} from "../../src/lib/marketingCatalogPolicy.js";
import {marketingStudioWorkflow} from "../../src/lib/marketingStudioDocumentWorkflow.js";
import {STUDIO_SERVICE_DEFAULTS} from "../../src/lib/marketingStudioServices.js";
test("all 35 document templates have documented, relevant flyer and native-export workflows",()=>{
 assert.equal(marketingTemplates.length,35);
 for(const template of marketingTemplates){
  const workflow=marketingStudioWorkflow(template.id);
  assert.equal(workflow.label,template.label);
  assert.ok(workflow.purpose.length>4);
  assert.ok(workflow.description.length>35);
  assert.match(workflow.recommendedDetailedOutput,/Word and PDF/);
  assert.ok(workflow.featureSet.includes("Editable artwork services"));
 }
 for(const kind of ["client-quote","client-intake"])assert.equal(marketingStudioWorkflow(kind).allowsPromotionalFlyer,false);
});
test("seven audience-specific service programs do not collapse to school wording",()=>{
 assert.equal(Object.keys(STUDIO_SERVICE_DEFAULTS).length,7);
 const headings=Object.values(STUDIO_SERVICE_DEFAULTS).map(x=>x.heading);
 assert.equal(new Set(headings).size,7);
 assert.match(STUDIO_SERVICE_DEFAULTS.school.description,/sport/);
 assert.match(STUDIO_SERVICE_DEFAULTS.wedding.description,/monogram/);
});
test("guided flow asks for approved imagery and verified copy before generating concepts",()=>{
 const ui=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 const merchandise=ui.indexOf("Step 1 — Choose approved merchandise");
 const copy=ui.indexOf("Step 2 — Customize verified headline");
 const services=ui.indexOf("Step 3 — Tailor artwork services");
 const generate=ui.indexOf("Step 4 — Generate and compare");
 const preview=ui.indexOf('aria-label="Generated design concepts"');
 assert.ok(merchandise>0 && merchandise<copy && copy<services && services<generate && generate<preview);
 assert.match(ui,/Add product pricing option/);
 assert.match(ui,/MAX_FUNDRAISING_PRODUCTS/);
 assert.match(ui,/setStudioServices\(normalizeStudioServices\(d\.studioServices/);
});
