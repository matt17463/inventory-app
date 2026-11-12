import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {marketingVisualBrief} from "../../src/lib/marketingVisualBrief.js";
test("visual direction adapts to school, sports, wedding, business and events",()=>{
 for(const [templateId,needle] of [["brochure-schools","mascot-led hero"],["brochure-sports","stadium lighting"],["wedding-package","tasteful florals"],["brochure-business","workwear"],["event-merchandise","celebratory"]]){
  const brief=marketingVisualBrief({templateId,organization:"Client",colors:["#123456","#ffffff"]});
  assert.ok(brief.includes(needle),templateId);
  assert.ok(brief.includes("#123456"));
  assert.ok(brief.includes("editable, verified layers"));
 }
});
test("visual brief includes verified client context but not fabricated prices",()=>{
 const brief=marketingVisualBrief({templateId:"coach-recognition",organization:"Team & Club",description:"Coach awards",colors:["#224466","red"]});
 assert.ok(brief.includes("Team & Club"));
 assert.ok(brief.includes("Coach awards"));
 assert.ok(brief.includes("Palette: #224466."));
 assert.ok(brief.includes("Do not invent"));
});
test("document studio shares the visual brief across all templates",()=>{
 const studio=readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
 assert.ok(studio.includes("marketingVisualBrief({"));
 assert.ok(studio.includes("AI visual design direction"));
 assert.ok(studio.includes("Copy AI visual design prompt"));
 assert.ok(studio.includes("visualDirection:visualBrief"));
});

test("visual generation endpoint is employee authenticated and client-scoped",()=>{
 const endpoint=readFileSync(new URL("../../netlify/functions/marketing-ai-visual.js",import.meta.url),"utf8");
 assert.ok(endpoint.includes("authorizeEmployee(event"));
 assert.ok(endpoint.includes('from("sc_growth_accounts")'));
 assert.ok(endpoint.includes('type:"image_generation"'));
 assert.ok(endpoint.includes("OPENAI_API_KEY"));
});
test("school flyer and general documents expose actual image generation controls",()=>{
 const school=readFileSync(new URL("../../src/MarketingProgramDesigner.jsx",import.meta.url),"utf8");
 const studio=readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
 const renderer=readFileSync(new URL("../../src/lib/marketingDocumentContent.js",import.meta.url),"utf8");
 assert.ok(school.includes("Generate AI school scenery"));
 assert.ok(studio.includes("Generate AI illustrated artwork"));
 assert.ok(studio.includes("marketing_visual_background"));
 assert.ok(renderer.includes("visual-hero"));
});

test("visual design prompt can be edited, reset, saved and used by the server",()=>{
 const studio=readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
 const endpoint=readFileSync(new URL("../../netlify/functions/marketing-ai-visual.js",import.meta.url),"utf8");
 assert.ok(studio.includes('setVisualPromptOverride(e.target.value)'));
 assert.ok(studio.includes("Reset to suggested prompt"));
 assert.ok(studio.includes("visual_prompt:effectiveVisualPrompt"));
 assert.ok(studio.includes("visualPromptOverride,"));
 assert.ok(studio.includes("setVisualPromptOverride(restored.visualPromptOverride??null)"));
 assert.ok(endpoint.includes("input.visual_prompt"));
 assert.ok(endpoint.includes("customPrompt||brief"));
 assert.ok(endpoint.includes("customPrompt.length>14000"));
});

test("AI Studio premium background is opt-in and uses landscape scene without identity assets",()=>{
 const studio=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 const endpoint=readFileSync(new URL("../../netlify/functions/marketing-ai-visual.js",import.meta.url),"utf8");
 assert.ok(studio.includes("onClick={generatePremiumSelected}"));
 assert.ok(studio.includes("paid API credits"));
 assert.ok(studio.includes('aspect_ratio:"landscape"'));
 assert.ok(studio.includes("setConcepts(current=>current.map((old,i)=>i===selected?result.image:old))"));
 assert.ok(endpoint.includes('input.aspect_ratio==="landscape"?"1536x1024":"1024x1536"'));
 assert.ok(studio.includes("renderOfflineArtwork(offlineStudioHeroArtwork("));
});
