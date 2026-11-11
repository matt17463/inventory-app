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
