import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {studioEffectiveImageDpi,inspectStudioImage,checkStudioPrintImages} from "../../src/lib/marketingStudioPrintImages.js";

test("effective source resolution reflects physical printed dimensions and cropping",()=>{
 assert.equal(studioEffectiveImageDpi({width:2550,height:3300,boxWidthPx:816,boxHeightPx:1056}),300);
 assert.equal(studioEffectiveImageDpi({width:960,height:1200,boxWidthPx:816,boxHeightPx:420,fit:"cover"}),112);
 assert.equal(studioEffectiveImageDpi({width:1536,height:1024,boxWidthPx:816,boxHeightPx:320,fit:"cover"}),180);
 assert.equal(studioEffectiveImageDpi({width:0,height:1024,boxWidthPx:816,boxHeightPx:320}),0);
});
test("large logos and tiny mockups require sufficient intrinsic pixels",()=>{
 assert.equal(inspectStudioImage({label:"approved logo",width:120,height:120,boxWidthPx:82,boxHeightPx:82}).passes,false);
 assert.equal(inspectStudioImage({label:"garment",width:900,height:900,boxWidthPx:220,boxHeightPx:220}).passes,true);
 assert.match(inspectStudioImage({label:"garment",width:120,height:100,boxWidthPx:220,boxHeightPx:190}).message,/minimum 200 DPI/);
});
test("browser preflight checks approved art and scenic background independently",async()=>{
 const rect=(width,height)=>({width,height});
 const logo={naturalWidth:800,naturalHeight:800,getBoundingClientRect:()=>rect(80,80)};
 const garment={naturalWidth:900,naturalHeight:1100,getBoundingClientRect:()=>rect(180,230)};
 const hero={getBoundingClientRect:()=>rect(816,350)};
 const page={querySelector:s=>({".client-logo":logo,".hero":hero})[s]||null,querySelectorAll:s=>s===".piece img"?[garment]:[]};
 class Image{constructor(){this.naturalWidth=2550;this.naturalHeight=3300;}set src(_){this.onload();}}
 const doc={querySelector:s=>s===".page"?page:null,defaultView:{Image}};
 const result=await checkStudioPrintImages(doc,{scene:"data:image/jpeg;base64,AAAA"});
 assert.equal(result.ready,true);assert.equal(result.checks.length,3);
 const bad={...doc,querySelector:()=>({...page,querySelector:s=>s===".client-logo"?{...logo,naturalWidth:50,naturalHeight:50}:page.querySelector(s)})};
 const fail=await checkStudioPrintImages(bad,{scene:""});
 assert.equal(fail.ready,false);
 assert.match(fail.errors.join(" "),/client logo/);
});
test("print UI uses photo DPI checks and offline artwork renders at print resolution",()=>{
 const ui=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.match(ui,/checkStudioPrintImages\(popup\.document/);
 assert.match(ui,/canvas\.width=2550;canvas\.height=3300/);
 assert.match(ui,/context\.drawImage\(img,0,0,2550,3300\)/);
});
