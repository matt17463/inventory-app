import test from "node:test";
import assert from "node:assert/strict";
import {marketingPrintImageCheck,marketingPrintPreflightSummary} from "../../src/lib/marketingPrintPreflight.js";

test("logo and merchandise image raster sizes are checked for print",()=>{
 assert.equal(marketingPrintImageCheck({type:"logo",width:500,height:500}).ok,true);
 assert.equal(marketingPrintImageCheck({type:"product",width:800,height:720}).ok,true);
 assert.equal(marketingPrintImageCheck({type:"product",width:220,height:220}).ok,false);
 assert.equal(marketingPrintImageCheck({type:"hero",width:2700,height:900}).ok,true);
 assert.equal(marketingPrintImageCheck({type:"hero",width:1200,height:600}).ok,false);
});
test("image gate aggregates all reasons and does not claim printing certification",()=>{
 const quality=marketingPrintPreflightSummary([
  marketingPrintImageCheck({type:"logo",width:100,height:100}),
  marketingPrintImageCheck({type:"product",width:200,height:400}),
 ]);
 assert.equal(quality.passed,false);
 assert.equal(quality.errors.length,2);
 assert.match(quality.errors[0],/px/);
 assert.deepEqual(marketingPrintPreflightSummary([{ok:true}]),{passed:true,errors:[]});
});
