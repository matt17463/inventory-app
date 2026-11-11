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
 assert.ok(!brief.includes("red"));
 assert.ok(brief.includes("Do not invent"));
});
test("document studio shares the visual brief across all templates",()=>{
 const studio=readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
 assert.ok(studio.includes("marketingVisualBrief({"));
 assert.ok(studio.includes("AI visual design direction"));
 assert.ok(studio.includes("Copy AI visual design prompt"));
 assert.ok(studio.includes("visualDirection:visualBrief"));
});
