import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,resolveDesignTokens,studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";
test("all marketing categories have specific design guidance",()=>{
 for(const name of ["school","business","team","nonprofit","wedding","general"])assert.ok(DESIGN_CATEGORIES[name].brief.length>60);
 assert.equal(DESIGN_STYLES.length,3);
 assert.equal(designCategory("brochure-schools","school"),"school");
 assert.equal(designCategory("wedding-package","business"),"wedding");
 assert.equal(designCategory("coach-recognition","team"),"team");
});
test("three concept prompts are distinct and brand-specific",()=>{
 const prompts=[0,1,2].map(variation=>designStudioPrompt({category:"school",client:"Greywolf Elementary",colors:["#123456"],variation}));
 assert.equal(new Set(prompts).size,3);
 assert.ok(prompts.every(x=>x.includes("Greywolf Elementary")&&x.includes("#123456")&&x.length<6000));
});
test("print layout escapes client content and only embeds data images",()=>{
 const html=studioPrintHtml({client:"<script>alert(1)</script>",headline:"Pride & Support",image:"https://untrusted.example/evil.png",benefits:["A < B"],steps:["Approve"],cta:"Contact"});
 assert.ok(!html.includes("<script>"));
 assert.ok(html.includes("&lt;script&gt;"));
 assert.ok(html.includes("Pride &amp; Support"));
 assert.ok(!html.includes("untrusted.example"));
 assert.ok(html.includes("@page{size:letter"));
});
test("new studio is primary, classic builder remains available",()=>{
 const studio=readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
 const ai=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.ok(studio.includes("MarketingAIDesignStudio"));
 assert.ok(studio.includes("showClassicBuilder"));
 assert.ok(ai.includes("Generate 3 design concepts — no API credits"));
 assert.ok(ai.includes('value="hybrid"'));
 assert.ok(ai.includes('value="artwork"'));
 assert.ok(ai.includes("studioPrintHtml"));
});

test("native PDF is one US Letter page with factual overlays",async()=>{
 const sharp=(await import("sharp")).default;
 const {PDFDocument}=await import("pdf-lib");
 const {buildStudioPdf}=await import("../../src/lib/marketingDesignStudioPdf.js");
 const png=await sharp({create:{width:400,height:600,channels:3,background:"#345678"}}).png().toBuffer();
 const bytes=await buildStudioPdf({image:"data:image/png;base64,"+png.toString("base64"),headline:"SCHOOL SPIRIT WEAR PROGRAM",description:"Support the school",benefits:["School pride","Program funding"],steps:["Plan together","Open store"],cta:"Contact Skilled Crafting",contact:"skilledcrafting.com",plan:{sections:["hero","steps","benefits","cta"],composition:"editorial",accent:"#123456"}});
 const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),1);
 assert.deepEqual(pdf.getPage(0).getSize(),{width:612,height:792});
});
test("server layout validation restricts section names and colors",async()=>{
 const {validatePlan}=await import("../../netlify/functions/marketing-ai-layout.js");
 const plan=validatePlan({sections:["steps","malicious","benefits","steps"],emphasis:"other",composition:"editorial",align:"left",accent:"not-color"});
 assert.deepEqual(plan.sections,["hero","steps","benefits","cta"]);
 assert.equal(plan.accent,"#234667");
});

test("school prompt tokens use verified values and leave no invented contact",()=>{
 const output=resolveDesignTokens("School {{school_name}} · {{primary_color}} · Phone {{business_phone}}",{school_name:"Greywolf Elementary",primary_color:"#123456"});
 assert.match(output,/Greywolf Elementary/);
 assert.match(output,/#123456/);
 assert.match(output,/not supplied; do not invent/);
});

test("layout quota fallback is deterministic and concept-specific",async()=>{
 const {fallbackPlan}=await import("../../netlify/functions/marketing-ai-layout.js");
 const first=fallbackPlan({concept:1,colors:["#112233"]});
 const second=fallbackPlan({concept:2,colors:["#112233"]});
 const third=fallbackPlan({concept:3,colors:["#112233"]});
 assert.equal(first.accent,"#112233");
 assert.notEqual(first.composition,second.composition);
 assert.notEqual(second.composition,third.composition);
 assert.equal(first.sections[0],"hero");
 assert.equal(third.sections.at(-1),"cta");
});

test("offline artwork is distinct, branded, safe, and requires no API",async()=>{
 const {offlineStudioArtwork}=await import("../../src/lib/marketingDesignStudio.js");
 const images=[1,2,3].map(concept=>offlineStudioArtwork({concept,colors:["#112233","#445566","#aabbcc"]}));
 assert.equal(new Set(images).size,3);
 for(const svg of images){assert.match(svg,/^<svg /);assert.match(svg,/#112233|#445566/);assert.ok(!svg.includes("<script"));assert.ok(!svg.includes("http://")&&!svg.includes("https://"));}
 const invalid=offlineStudioArtwork({colors:['"><script>alert(1)</script>']});
 assert.ok(!invalid.includes("<script")&&!invalid.includes("alert(1)"));
 const studio=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.match(studio,/offline:true/);
 assert.ok(studio.includes("onClick={generatePremiumSelected}"));
 assert.match(studio,/paid API credits/);
 assert.match(studio,/marketing-ai-visual/);
});

test("credit-free landscape hero scenery is distinct, category-specific, and logo-safe",async()=>{
 const {offlineStudioHeroArtwork}=await import("../../src/lib/marketingDesignStudio.js");
 const kinds=["school","team","business","nonprofit","wedding","event","general"];
 const outputs=kinds.map(category=>offlineStudioHeroArtwork({category,colors:["#114477","#ebb64c"],concept:1}));
 assert.equal(new Set(outputs).size,kinds.length);
 for(const result of outputs){
  assert.match(result,/width="1200" height="540"/);
  assert.match(result,/viewBox="0 0 1200 540"/);
  assert.ok(!result.includes("<text"));
  assert.ok(!result.includes("<script"));
 }
 const variants=[1,2,3].map(concept=>offlineStudioHeroArtwork({category:"school",concept,colors:["#114477"]}));
 assert.equal(new Set(variants).size,3);
 const unsafe=offlineStudioHeroArtwork({colors:['"><script>bad()</script>']});
 assert.ok(!unsafe.includes("bad()"));
});

test("event campaigns use distinct category, messaging and landscape imagery from weddings",async()=>{
 const {designCategory,STUDIO_CATEGORY_COPY,studioPrintHtml,offlineStudioHeroArtwork}=await import("../../src/lib/marketingDesignStudio.js");
 assert.equal(designCategory("event-merchandise","all"),"event");
 assert.equal(designCategory("wedding-package","all"),"wedding");
 assert.equal(designCategory("brochure-schools","school"),"school");
 assert.notEqual(STUDIO_CATEGORY_COPY.event.collection,STUDIO_CATEGORY_COPY.wedding.collection);
 assert.match(studioPrintHtml({category:"event",headline:"Event Merchandise"}),/CUSTOM MERCHANDISE FOR YOUR EVENT/);
 assert.notEqual(offlineStudioHeroArtwork({category:"event"}),offlineStudioHeroArtwork({category:"wedding"}));
 const ui=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.match(ui,/Campaign audience/);
 assert.match(ui,/setCategoryOverride\(d\.category\)/);
});
