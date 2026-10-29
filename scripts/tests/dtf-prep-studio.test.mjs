import test from 'node:test';
import { PROCESS_ANGLES, PROCESS_CHANNELS, createProcessScreens, cmykCoverage, screenAngleWarnings } from '../../src/lib/dtfMulticolor.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DTF_DEFAULTS, parseRgb, cmykToRgb, rgbToCmyk, removeEdgeColor,
  processDtfPixels, halftoneSpot, qualityReport, vectorSilhouette,
} from '../../src/lib/dtfStudioEngine.js';

test('DTF defaults are 300-PPI output oriented and use no destructive knockout by default', () => {
  assert.equal(DTF_DEFAULTS.knockout,'none');
  assert.equal(DTF_DEFAULTS.lpi,35);
  assert.equal(DTF_DEFAULTS.alphaMode,'hard');
});
test('CMYK input is marked preview-only and approximate RGB math behaves', () => {
  assert.deepEqual(cmykToRgb(0,0,0,100),[0,0,0]);
  assert.deepEqual(cmykToRgb(0,100,100,0),[255,0,0]);
  assert.deepEqual(rgbToCmyk(0,0,0),[0,0,0,100]);
  assert.deepEqual(parseRgb('#abc'),[170,187,204]);
  assert.throws(()=>parseRgb('red'));
});
test('edge-connected background removal preserves enclosed contrasting artwork', () => {
  const d=new Uint8ClampedArray(3*3*4);
  for(let i=0;i<9;i++){d[i*4]=d[i*4+1]=d[i*4+2]=255;d[i*4+3]=255;}
  d[4*4]=50;d[4*4+1]=40;d[4*4+2]=30;
  const removed=removeEdgeColor(d,3,3,[255,255,255],10);
  assert.equal(removed,8);
  assert.equal(d[4*4+3],255);
});
test('alpha cleanup clears all RGB for invisible pixels to suppress haze', () => {
  const p=new Uint8ClampedArray([255,255,255,2,10,20,30,255]);
  const r=processDtfPixels(p,2,1,{alphaThreshold:4},300);
  assert.deepEqual(Array.from(p.slice(0,4)),[0,0,0,0]);
  assert.deepEqual(Array.from(p.slice(4,8)),[10,20,30,255]);
  assert.equal(r.printable,1);
});
test('a chosen black shirt color knocks out similar pixels', () => {
  const p=new Uint8ClampedArray([0,0,0,255,255,255,255,255]);
  processDtfPixels(p,2,1,{knockout:'shirt',shirtColor:'#000000',knockoutTolerance:40},300);
  assert.equal(p[3],0);
  assert.equal(p[7],255);
});
test('halftone shapes are bounded for arbitrary angles and LPI', () => {
  for(const dot of ['circle','ellipse','diamond','square','line']){
    for(const angle of [0,22.5,45,75]) {
      const v=halftoneSpot(25,37,300,35,angle,dot);
      assert.ok(v>=0&&v<=1,dot+': '+v);
    }
  }
});
test('halftoned pixel output has either zero or full alpha, not hazy intermediate values', () => {
  const p=new Uint8ClampedArray(32*32*4);
  for(let i=0;i<p.length;i+=4){p[i]=120;p[i+1]=90;p[i+2]=30;p[i+3]=125;}
  processDtfPixels(p,32,32,{halftone:'fades',alphaMode:'hard',lpi:35},300);
  const alphas=new Set(Array.from({length:1024},(_,i)=>p[i*4+3]));
  assert.ok([...alphas].every(a=>a===0||a===255));
  assert.ok(alphas.has(0)&&alphas.has(255));
});
test('fully dense black halftone holds solid with no unintended dot gaps', () => {
  const p=new Uint8ClampedArray(32*32*4);
  for(let i=0;i<p.length;i+=4){p[i]=p[i+1]=p[i+2]=0;p[i+3]=255;}
  processDtfPixels(p,32,32,{halftone:'full',lpi:35,alphaMode:'hard'},300);
  assert.ok(Array.from({length:1024},(_,i)=>p[i*4+3]).every(v=>v===255));
});
test('quality report flags resampling and fine dot density', () => {
  const r=qualityReport(300,300,3600,3600,{partialAlpha:0},{halftone:'full',lpi:55});
  assert.ok(r.warnings.some(s=>s.includes('enlarged')));
  assert.ok(r.warnings.some(s=>s.includes('Halftone')));
});
test('single-color silhouette emits actual vector rectangles, not an embedded bitmap', () => {
  const d=new Uint8ClampedArray([100,20,0,255,0,0,0,0]);
  const svg=vectorSilhouette(d,2,1,'#ffffff');
  assert.match(svg,/<rect/);
  assert.doesNotMatch(svg,/<image|data:image/);
});
test('UI routes expose the new studio without replacing original preflight', () => {
  const routes=readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8');
  const nav=readFileSync(new URL('../../src/navigationConfig.js',import.meta.url),'utf8');
  assert.match(routes,/path="\/dtf-studio"/);
  assert.match(routes,/path="\/artwork-preflight"/);
  assert.match(nav,/DTF Prep Studio/);
});

test('CMYK multicolor defaults to conventional four independent rosette angles', () => {
  assert.deepEqual(PROCESS_ANGLES,{C:15,M:75,Y:0,K:45});
  assert.deepEqual(PROCESS_CHANNELS,['C','M','Y','K']);
  assert.deepEqual(cmykCoverage(255,255,255),[0,0,0,0]);
  assert.deepEqual(cmykCoverage(0,0,0),[0,0,0,1]);
  assert.equal(createProcessScreens({lpi:35},300).C.cell,300/35);
});
test('pure CMYK primary colors stay separate and fully opaque in multicolor output', () => {
  const inputs=[
    {rgb:[0,255,255],print:[0,255,255]},
    {rgb:[255,0,255],print:[255,0,255]},
    {rgb:[255,255,0],print:[255,255,0]},
    {rgb:[0,0,0],print:[0,0,0]},
  ];
  for(const {rgb,print} of inputs){
    const p=new Uint8ClampedArray([...rgb,255]);
    const stats=processDtfPixels(p,1,1,{halftone:'multicolor'},300);
    assert.deepEqual(Array.from(p),[...print,255]);
    assert.equal(stats.printable,1);
  }
});
test('multicolor maintains fully transparent gaps and retains multiple distinct ink colors', () => {
  const count=80*80, data=new Uint8ClampedArray(count*4);
  for(let i=0;i<count;i++){data.set([120,170,90,255],i*4);}
  const stats=processDtfPixels(data,80,80,{halftone:'multicolor',lpi:35},300);
  const colors=new Set(),alphas=new Set();
  for(let i=0;i<count;i++){
    const off=i*4;alphas.add(data[off+3]);
    if(data[off+3]===255)colors.add([data[off],data[off+1],data[off+2]].join(','));
    else assert.deepEqual(Array.from(data.slice(off,off+4)),[0,0,0,0]);
  }
  assert.deepEqual([...alphas].sort((a,b)=>a-b),[0,255]);
  assert.ok(colors.size>1,'multiple color-channel combinations must survive rasterization');
  assert.equal(stats.partialAlpha,0);
});
test('single-channel view isolates only one CMYK ink, never a composite',()=>{
  const red=[255,0,0,255];
  const c=new Uint8ClampedArray(red);
  processDtfPixels(c,1,1,{halftone:'multicolor',channelView:'C'},300);
  assert.deepEqual(Array.from(c),[0,0,0,0]);
  const magenta=new Uint8ClampedArray(red);
  processDtfPixels(magenta,1,1,{halftone:'multicolor',channelView:'M'},300);
  assert.deepEqual(Array.from(magenta),[255,0,255,255]);
});
test('disabled channels disappear from the printed multicolor composite',()=>{
  const red=new Uint8ClampedArray([255,0,0,255]);
  processDtfPixels(red,1,1,{halftone:'multicolor',screenEnabled:{C:true,M:false,Y:true,K:true}},300);
  assert.deepEqual(Array.from(red),[255,255,0,255]);
});
test('whites create no CMYK ink even if dot gain is positive',()=>{
  const white=new Uint8ClampedArray([255,255,255,255]);
  processDtfPixels(white,1,1,{halftone:'multicolor',screenGain:20},300);
  assert.deepEqual(Array.from(white),[0,0,0,0]);
});
test('angle collision warns about moire and standard angles have no collision warnings',()=>{
  assert.deepEqual(screenAngleWarnings({}),[]);
  assert.ok(screenAngleWarnings({screenAngles:{C:45,M:45,Y:0,K:45}}).length>=1);
  const report=qualityReport(1800,1800,3600,3600,{partialAlpha:0},{halftone:'multicolor',lpi:35,screenAngles:{C:45,M:45}});
  assert.ok(report.warnings.some(s=>s.includes('moire')||s.includes('moiré')));
});
test('original-color halftone preserves RGB color and has binary alpha',()=>{
  const pixels=new Uint8ClampedArray(30*30*4);
  for(let i=0;i<900;i++)pixels.set([12,130,240,255],i*4);
  processDtfPixels(pixels,30,30,{halftone:'color-dots',colorDotDensity:60},300);
  const opaque=[],transparent=[];
  for(let i=0;i<900;i++){
    const p=Array.from(pixels.slice(i*4,i*4+4));
    if(p[3]===255)opaque.push(p);else transparent.push(p);
  }
  assert.ok(opaque.length>0&&transparent.length>0);
  assert.ok(opaque.every(p=>p.join(',')==='12,130,240,255'));
  assert.ok(transparent.every(p=>p.join(',')==='0,0,0,0'));
});
test('multicolor proof channel selection is isolated from PNG and R2 exports',()=>{
  const studio=readFileSync(new URL('../../src/DTFPrepStudio.jsx',import.meta.url),'utf8');
  assert.match(studio,/renderArtwork\(bitmap,\{\.\.\.opts,channelView,previewMask:true\},950\)/);
  assert.match(studio,/return renderArtwork\(bitmap,\{\.\.\.opts,channelView:'composite'\}\)/);
  assert.match(studio,/screenEnabled/);
  assert.match(studio,/CMYK multicolor rosette/);
});
