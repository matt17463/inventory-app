import test from 'node:test';
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
