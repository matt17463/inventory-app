import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DESIGN_CATEGORIES,DESIGN_STYLES,designCategory,designStudioPrompt,studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";
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
 assert.ok(ai.includes("Generate 3 design concepts"));
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
