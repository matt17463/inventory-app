import assert from "node:assert/strict";
import test from "node:test";
import {normalizeApparelPlacement,apparelOverlayBox} from "../../src/lib/marketingApparelComposite.js";

test("apparel placement converts percent center and width to photo pixels",()=>{
 const box=apparelOverlayBox(1200,1200,500,250,{x:50,y:43,width:30});
 assert.deepEqual(box,{x:420,y:426,width:360,height:180});
});
test("placement values are clamped and nonfinite inputs use safe defaults",()=>{
 assert.deepEqual(normalizeApparelPlacement({x:Infinity,y:-100,width:100}),{x:50,y:35,width:70});
 assert.deepEqual(normalizeApparelPlacement({x:0,y:100,width:20}),{x:10,y:90,width:20});
});
test("invalid image dimensions and off-photo placements are rejected",()=>{
 assert.throws(()=>apparelOverlayBox(0,900,500,250),/dimensions/);
 assert.throws(()=>apparelOverlayBox(1200,300,100,100,{x:50,y:50,width:70}),/exceeds/);
});
