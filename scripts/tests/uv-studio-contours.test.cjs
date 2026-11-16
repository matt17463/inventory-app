const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const html=readFileSync(process.argv[2] || require('node:path').join(__dirname,'../../public/uv-studio/index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const source=scripts.map(match=>match[1]).join('\n');
function declaration(name,next){
 const start=source.indexOf(name);
 const end=source.indexOf(next,start+name.length);
 assert.ok(start>=0 && end>start);
 return source.slice(start,end);
}
const getEngine=new Function(
 declaration('function distanceField','function cap')+
 declaration('function outlinePath','function rgbHex')+
 declaration('function sheetPosition','function makeSheetCanvas')+
 `let image;
 function paintBase(width,height){
  const data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)
   data[(y*width+x)*4+3]=image(x/width,y/height);
  return {data};
 }
 return {graphicContour,scCutPath,patchOutlineSVG,batchSheetSvg,setArtwork:fn=>{image=fn}};`);
const engine=getEngine();
const v={width:2,height:2,edgeStyle:'none',contourOffset:1,contourAlpha:50};
const fill=(x,y)=>x>.2 && x<.8 && y>.2 && y<.8 ? 255:0;
const plan={originX:.5,originY:.75,gapX:.21,gapY:.39,cols:2,rows:2,capacity:4,sw:8,sh:8};
test('all inline scripts parse',()=>scripts.forEach(match=>new Function(match[1])));
test('transparent artwork produces no contour or SVG',()=>{
 engine.setArtwork(()=>0);
 assert.equal(engine.graphicContour(v).d,'');
 assert.throws(()=>engine.patchOutlineSVG(v),/No cut contour/);
});
test('offset expands one square without tracing raster frame',()=>{
 engine.setArtwork(fill);
 const small=engine.graphicContour(v);
 const large=engine.graphicContour({...v,contourOffset:5});
 assert.equal(small.components,1);
 assert.equal(large.components,1);
 assert.deepEqual(large.bounds,small.bounds.map((n,i)=>n+(i<2?-4:4)));
 assert.equal(engine.graphicContour({...v,contourOffset:5}),large);
});
test('circle, nested hole and disconnected islands trace as separate closed loops',()=>{
 engine.setArtwork((x,y)=>Math.hypot(x-.5,y-.5)<.35?255:0);
 assert.equal(engine.graphicContour(v).components,1);
 engine.setArtwork((x,y)=>fill(x,y) && !(x>.35 && x<.65 && y>.35 && y<.65)?255:0);
 assert.equal(engine.graphicContour(v).components,2);
 engine.setArtwork((x,y)=>(x<.2&&y<.2)||(x>.8&&y>.8)?255:0);
 assert.equal(engine.graphicContour(v).components,2);
});
test('opacity threshold rejects faint pixels',()=>{
 engine.setArtwork((x,y)=>fill(x,y)?125:0);
 assert.equal(engine.graphicContour(v).components,0);
 assert.equal(engine.graphicContour({...v,contourAlpha:45}).components,1);
});
test('asymmetric jig offsets preserve identical artwork contours for each piece',()=>{
 engine.setArtwork(fill);
 const {d}=engine.graphicContour(v);
 const svg=engine.batchSheetSvg(v,plan,4);
 assert.ok(svg.includes(d));
 assert.match(svg,/translate\(10\.700 17\.050\)/);
 assert.match(svg,/translate\(66\.834 77\.756\)/);
});
test('batch rejects clipping and potential overlap',()=>{
 engine.setArtwork(()=>255);
 assert.throws(()=>engine.batchSheetSvg(v,{...plan,originX:0},4),/beyond the sheet/);
 assert.throws(()=>engine.batchSheetSvg({...v,contourOffset:5},plan,4),/overlap/);
});
test('Merrow retains geometric outlines',()=>{
 const cut=engine.scCutPath({...v,edgeStyle:'merrow',patchShape:'rounded'});
 assert.match(cut.d,/Q/);
 assert.equal(cut.originOffset,0);
});
test('optional contour cleanup suppresses small artwork islands before they expand',()=>{
 engine.setArtwork((x,y)=>fill(x,y)||(x<.025&&y<.025)?255:0);
 assert.equal(engine.graphicContour(v).components,2);
 assert.equal(engine.graphicContour({...v,contourIslandArea:3}).components,1);
});
test('optional hole cleanup retains the outer contour',()=>{
 engine.setArtwork((x,y)=>fill(x,y)&&!(x>.45&&x<.55&&y>.45&&y<.55)?255:0);
 assert.equal(engine.graphicContour(v).components,2);
 assert.equal(engine.graphicContour({...v,contourHoleArea:20}).components,1);
});
