import assert from "node:assert/strict";
import test from "node:test";
import {studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";

const data={client:"Example Elementary",category:"school",colors:["#193b60","#e0b54c"],headline:"SCHOOL SPIRIT",description:"School-approved program description",benefits:["School pride","Online ordering"],steps:["Plan","Approve"],cta:"CONTACT OUR TEAM",contact:"skilledcrafting.com",plan:{accent:"#ff5533",composition:"split"}};
test("three distinctly styled school flyers retain approved identity and copy",()=>{
 const variants=[0,1,2].map(concept=>studioPrintHtml({...data,concept}));
 for(const [index,html] of variants.entries()){
  assert.match(html,/Example Elementary/);
  assert.match(html,/SCHOOL SPIRIT/);
  assert.match(html,/APPROVED APPAREL PHOTOGRAPHY/);
  assert.match(html,/#193b60/);
  assert.doesNotMatch(html,/#ff5533/i,"model color must not override verified branding");
  assert.match(html,/<footer>/);
  assert.ok(html.includes(["athletic","editorial","bold"][index]));
 }
 assert.notEqual(variants[0],variants[1]);
 assert.notEqual(variants[1],variants[2]);
});
test("verified product images are used and unknown image URLs are rejected",()=>{
 const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
 const html=studioPrintHtml({...data,productImages:[png,"https://untrusted.example/cat.png"]});
 assert.match(html,/Approved merchandise photo 1/);
 assert.doesNotMatch(html,/untrusted.example/);
 assert.doesNotMatch(html,/APPROVED APPAREL PHOTOGRAPHY/);
});
test("copy is escaped and does not execute markup",()=>{
 const html=studioPrintHtml({...data,headline:'<script>alert(1)</script>'});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
});
