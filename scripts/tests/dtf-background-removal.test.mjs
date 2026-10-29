import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { detectEdgeBackground, removeDtfBackground, inspectPngAlpha, validateDtfTransparency, applyDtfMaskStrokes } from '../../src/lib/dtfBackgroundRemoval.js';
import { setPngDpi } from '../../src/lib/dtfPreflight.js';
const pixels=(w,h,color=[255,255,255,255])=>{
  const array=new Uint8ClampedArray(w*h*4);
  for(let n=0;n<w*h;n++)array.set(color,n*4);
  return array;
};
const fill=(data,w,x,y,color)=>data.set(color,(y*w+x)*4);
const at=(data,w,x,y)=>[...data.slice((y*w+x)*4,(y*w+x)*4+4)];

test('automatic removal identifies a dominant background without touching opaque design colors',()=>{
  const w=7,h=7,data=pixels(w,h);
  for(let y=2;y<=4;y++)for(let x=2;x<=4;x++)fill(data,w,x,y,[24,90,210,255]);
  const found=detectEdgeBackground(data,w,h);
  assert.deepEqual(found.color,[255,255,255]);
  const result=removeDtfBackground(data,w,h,{mode:'auto',tolerance:14,feather:0});
  assert.equal(result.removed,40);
  assert.deepEqual(at(data,w,0,0),[0,0,0,0]);
  assert.deepEqual(at(data,w,3,3),[24,90,210,255]);
  assert.equal(inspectPngAlpha(data,w,h).transparent,40);
});
test('automatic background removal works on a solid colored (not white) image background',()=>{
  const w=7,h=7,data=pixels(w,h,[11,203,111,255]);
  fill(data,w,3,3,[230,20,80,255]);
  const result=removeDtfBackground(data,w,h,{mode:'auto',tolerance:12,feather:0});
  assert.deepEqual(result.color,[11,203,111]);
  assert.equal(result.removed,48);
  assert.deepEqual(at(data,w,3,3),[230,20,80,255]);
});
test('connected edge removal preserves enclosed white lettering or design details',()=>{
  const w=7,h=7,data=pixels(w,h);
  for(let y=2;y<=4;y++)for(let x=2;x<=4;x++)fill(data,w,x,y,[0,0,0,255]);
  fill(data,w,3,3,[255,255,255,255]);
  const result=removeDtfBackground(data,w,h,{mode:'white',tolerance:15,feather:0,scope:'connected'});
  assert.equal(result.removed,40);
  assert.deepEqual(at(data,w,3,3),[255,255,255,255]);
  assert.deepEqual(at(data,w,0,0),[0,0,0,0]);
});
test('click-pick removes enclosed interior background without erasing disconnected exterior',()=>{
  const w=7,h=7,data=pixels(w,h);
  for(let y=2;y<=4;y++)for(let x=2;x<=4;x++)fill(data,w,x,y,[0,0,0,255]);
  fill(data,w,3,3,[255,255,255,255]);
  const result=removeDtfBackground(data,w,h,{mode:'pick',point:{x:3,y:3},tolerance:12,feather:0});
  assert.equal(result.removed,1);
  assert.deepEqual(at(data,w,3,3),[0,0,0,0]);
  assert.deepEqual(at(data,w,0,0),[255,255,255,255]);
});
test('all-matching removal is optional and also removes isolated regions',()=>{
  const w=7,h=7,data=pixels(w,h);
  for(let y=2;y<=4;y++)for(let x=2;x<=4;x++)fill(data,w,x,y,[0,0,0,255]);
  fill(data,w,3,3,[255,255,255,255]);
  const result=removeDtfBackground(data,w,h,{mode:'white',tolerance:10,feather:0,scope:'all'});
  assert.equal(result.removed,41);
  assert.deepEqual(at(data,w,3,3),[0,0,0,0]);
});
test('edge feather creates partial alpha at matte transition and full transparent exterior',()=>{
  const data=pixels(3,1,[255,255,255,255]);
  fill(data,3,1,0,[237,237,237,255]);
  fill(data,3,2,0,[10,40,140,255]);
  const result=removeDtfBackground(data,3,1,{mode:'sampled',color:'#ffffff',scope:'all',tolerance:10,feather:20});
  assert.equal(result.removed,1);
  assert.equal(result.softened,1);
  assert.equal(at(data,3,0,0)[3],0);
  assert.ok(at(data,3,1,0)[3]>0&&at(data,3,1,0)[3]<255);
  assert.deepEqual(at(data,3,2,0),[10,40,140,255]);
});
test('auto fails closed for highly diverse edge photos, instead of destroying foreground',()=>{
  const w=32,h=32,data=pixels(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)fill(data,w,x,y,[(x*57+y*91)%256,(x*79+y*31)%256,(x*3+y*131)%256,255]);
  assert.equal(detectEdgeBackground(data,w,h),null);
  assert.throws(()=>removeDtfBackground(data,w,h,{mode:'auto'}),/Pick from Source/);
});
test('inconsistent mask input is rejected, avoiding accidental all-transparent image',()=>{
  const data=pixels(2,2);
  assert.throws(()=>removeDtfBackground(data,2,2,{mode:'pick'}),/Click/);
  assert.throws(()=>removeDtfBackground(data,2,2,{mode:'pick',point:{x:12,y:0}}),/Click/);
  assert.throws(()=>removeDtfBackground(data,2,2,{mode:'unknown'}),/Unknown/);
});
test('alpha preflight rejects fake transparency from padding with no background removal',()=>{
  assert.throws(()=>validateDtfTransparency({
    settings:{background:'auto'},
    report:{removed:0,softened:0,originalHadTransparency:false},
    finalAlpha:{allTransparent:false,transparent:100,opaque:900,hasTransparency:true}
  }),/No source-background pixels/);
  assert.ok(validateDtfTransparency({
    settings:{background:'auto'},
    report:{removed:50,softened:0,originalHadTransparency:false},
    finalAlpha:{allTransparent:false,transparent:50,opaque:50,hasTransparency:true}
  }));
  assert.throws(()=>validateDtfTransparency({
    settings:{background:'white'},
    report:{removed:100,softened:0,originalHadTransparency:false},
    finalAlpha:{allTransparent:true,transparent:100,opaque:0,hasTransparency:true}
  }),/erased all artwork/);
});
test('final PNG contains true RGBA alpha 0 on background and alpha 255 on original art',async()=>{
  const w=5,h=5,data=pixels(w,h);
  for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)fill(data,w,x,y,[0,90,240,255]);
  removeDtfBackground(data,w,h,{mode:'auto',tolerance:12,feather:0});
  const encoded=await sharp(Buffer.from(data),{raw:{width:w,height:h,channels:4}}).png().toBuffer();
  const stamped=setPngDpi(new Uint8Array(encoded),300);
  const {data:decoded,info}=await sharp(Buffer.from(stamped)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4);
  assert.equal(decoded[3],0);
  assert.equal(decoded[(2*w+2)*4+3],255);
  assert.equal(decoded[(2*w+2)*4+2],240);
});
test('the studio uses original-source background cleanup and presents click-to-pick controls',()=>{
  const jsx=readFileSync(new URL('../../src/DTFPrepStudio.jsx',import.meta.url),'utf8');
  assert.match(jsx,/preparedMask\(bitmap,original\.data/);
  assert.match(jsx,/validateDtfTransparency/);
  assert.match(jsx,/Remove background automatically/);
  assert.match(jsx,/Click unwanted regions in SOURCE/);
  assert.match(jsx,/background_removed:render\.backgroundResult\.removed>0/);
});

test('manual erase brush makes JPEG-like opaque pixels truly transparent while preserving original',()=>{
  const w=9,h=9,source=pixels(w,h,[210,175,98,255]),working=new Uint8ClampedArray(source);
  const result=applyDtfMaskStrokes(working,source,w,h,[{kind:'erase',x:4,y:4,r:2}]);
  assert.ok(result.erased>=9);
  assert.deepEqual(at(working,w,4,4),[0,0,0,0]);
  assert.deepEqual(at(working,w,0,0),[210,175,98,255]);
  assert.deepEqual(at(source,w,4,4),[210,175,98,255]);
});
test('restore brush recovers original artwork after automated removal without modifying original pixels',()=>{
  const w=9,h=9,source=pixels(w,h),working=new Uint8ClampedArray(source);
  const change=removeDtfBackground(working,w,h,{mode:'white',tolerance:15,feather:0});
  assert.equal(change.removed,81);
  applyDtfMaskStrokes(working,source,w,h,[{kind:'restore',x:4,y:4,r:2}]);
  assert.deepEqual(at(working,w,4,4),[255,255,255,255]);
  assert.deepEqual(at(working,w,0,0),[0,0,0,0]);
});
test('manual mask replay is deterministic and clearing strokes recovers original source',()=>{
  const w=11,h=11,src=pixels(w,h,[200,30,60,255]),one=new Uint8ClampedArray(src),two=new Uint8ClampedArray(src);
  const strokes=[{kind:'erase',x:3,y:3,r:3},{kind:'restore',x:3,y:3,r:1},{kind:'erase',x:8,y:8,r:2}];
  applyDtfMaskStrokes(one,src,w,h,strokes);
  applyDtfMaskStrokes(two,src,w,h,strokes);
  assert.deepEqual(one,two);
  const clear=new Uint8ClampedArray(src);
  applyDtfMaskStrokes(clear,src,w,h,[]);
  assert.deepEqual(clear,src);
});
test('UI provides non-destructive mask editing and stores mask recipe for reproducible R2 revisions',()=>{
  const jsx=readFileSync(new URL('../../src/DTFPrepStudio.jsx',import.meta.url),'utf8');
  assert.match(readFileSync(new URL('../../src/lib/dtfMaskGuidance.js',import.meta.url),'utf8'),/applyDtfMaskStrokes/);
  assert.match(jsx,/Erase to transparency/);
  assert.match(jsx,/Restore original design pixels/);
  assert.match(jsx,/maskStrokes/);
  assert.match(jsx,/onPointerMove/);
});

test('exterior and enclosed white can be removed in independent passes',()=>{
  const w=9,h=9,data=pixels(w,h,[12,12,12,255]);
  for(let y=2;y<7;y++)for(let x=2;x<7;x++)fill(data,w,x,y,[160,40,70,255]);
  fill(data,w,4,4,[255,255,255,255]);
  const exterior=removeDtfBackground(data,w,h,{mode:'auto',scope:'connected',tolerance:12,feather:0});
  assert.equal(exterior.removed,56);
  assert.deepEqual(at(data,w,4,4),[255,255,255,255]);
  const interior=removeDtfBackground(data,w,h,{mode:'white',scope:'all',tolerance:10,feather:0});
  assert.equal(interior.removed,1);
  assert.deepEqual(at(data,w,4,4),[0,0,0,0]);
  assert.deepEqual(at(data,w,3,3),[160,40,70,255]);
});
test('studio offers separate optional enclosed white knockout controls',()=>{
  const jsx=readFileSync(new URL('../../src/DTFPrepStudio.jsx',import.meta.url),'utf8');
  assert.match(jsx,/removeInteriorWhite/);
  assert.match(jsx,/Clean exterior \+ enclosed white/);
  assert.match(readFileSync(new URL('../../src/lib/dtfMaskGuidance.js',import.meta.url),'utf8'),/interiorRemoved/);
});
