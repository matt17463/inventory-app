import test from "node:test";
import assert from "node:assert/strict";
import { dominantMarketingColors } from "../../src/lib/marketingLogoPalette.js";

test("logo palette recognizes prominent opaque colors and ignores white/transparent background",()=>{
  const pixels = Uint8ClampedArray.from([
    220,20,20,255, 220,20,20,255, 220,20,20,255,
    20,40,180,255, 255,255,255,255, 0,0,0,0,
  ]);
  const colors=dominantMarketingColors(pixels);
  assert.equal(colors.length,2);
  assert.equal(colors[0],"#E01010");
  assert.equal(colors[1],"#1030B0");
});
test("logo palette handles empty or entirely transparent images",()=>{
  assert.deepEqual(dominantMarketingColors(new Uint8ClampedArray()),[]);
  assert.deepEqual(dominantMarketingColors(Uint8ClampedArray.from([1,2,3,0])),[]);
});

test("confirmed client accents preserve readable heading contrast and early-stage branding", async()=>{
 const { marketingDocumentModel }=await import("../../src/lib/marketingDocumentModel.js");
 const client=marketingDocumentModel({template:"brand-guide",confirmedColors:["#FFFFAA"]});
 assert.equal(client.accent,"#FFFFAA");
 assert.equal(client.headingColor,"#24364A");
 assert.equal(marketingDocumentModel({template:"brand-guide",confirmedColors:["#274B62"]}).headingColor,"#274B62");
 assert.equal(marketingDocumentModel({template:"outreach-letter",confirmedColors:["#274B62"]}).accent,"#A82135");
});
