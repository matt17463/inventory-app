import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHOOL_FLYER_PRINT,effectiveDpi,inspectFlyerAsset} from '../../src/lib/marketingFlyerPrintPreflight.js';

test('US Letter cover uses a 300-DPI output surface',()=>{
 assert.deepEqual(SCHOOL_FLYER_PRINT,{widthPt:612,heightPt:792,widthPx:2550,heightPx:3300,dpi:300});
});
test('full-page raster of 2550 by 3300 pixels meets 300 DPI',()=>{
 const check=inspectFlyerAsset({label:'Cover',width:2550,height:3300,boxWidthPt:612,boxHeightPt:792,minDpi:300});
 assert.equal(check.passes,true);
 assert.equal(check.dpi,300);
});
test('letter-sized 1024px image fails 300 DPI proofing',()=>{
 const check=inspectFlyerAsset({label:'Cover',width:1024,height:1325,boxWidthPt:612,boxHeightPt:792,minDpi:300});
 assert.equal(check.passes,false);
 assert.match(check.message,/Cover.*DPI/);
});
test('small low-quality garment images are flagged at their printed sizes',()=>{
 assert.equal(inspectFlyerAsset({label:'Mockup',width:240,height:170,boxWidthPt:183,boxHeightPt:130,minDpi:200}).passes,false);
 assert.equal(inspectFlyerAsset({label:'Mockup',width:900,height:700,boxWidthPt:183,boxHeightPt:130,minDpi:200}).passes,true);
});
test('bad dimension values cannot pass validation',()=>{
 assert.equal(effectiveDpi({width:0,height:400,boxWidthPt:120,boxHeightPt:100}),0);
 assert.equal(effectiveDpi({width:400,height:400,boxWidthPt:-1,boxHeightPt:100}),0);
});
