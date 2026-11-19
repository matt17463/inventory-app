import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../public/uv-studio/index.html', import.meta.url), 'utf8');

test('UV patch shape choices include circle, oval and octagon with a shared outline geometry', () => {
  for (const shape of ['rounded','rectangle','oval','circle','capsule','octagon','hexagon','pentagon','diamond','shield']) {
    assert.match(src, new RegExp('<option value="' + shape + '"'));
  }
  assert.match(src, /if\(shape==='octagon'\)/);
  assert.match(src, /if\(shape==='circle'|shape==='oval'\|\|shape==='circle'/);
  assert.match(src, /v\.cutMode==='geometric'\|\|\(v\.cutMode!=='artwork'&&v\.edgeStyle!=='none'\)/);
});

test('independent artwork dimensions drive preview, print separation and cut silhouette', () => {
  for (const id of ['artworkWidth','artworkX','artworkY','artworkDimensions']) {
    assert.match(src, new RegExp('id="' + id + '"'));
  }
  assert.match(src, /v\.artworkWidth\*\(w\/v\.width\)\/image\.width/);
  assert.match(src, /function paintBase\(w,h,v=values\(\)\)/);
  assert.match(src, /paintBase\(cw,ch,v\)/);
  assert.match(src, /paintBase\(w,h,v\)/);
  assert.match(src, /v\.artworkWidth,v\.artworkX,v\.artworkY/);
  assert.match(src, /artwork_width_in:v\.artworkWidth/);
});

test('patch dimensions remain the basis of physical SVG cutline and batch layout', () => {
  assert.match(src, /function scCutPath\(v,wIn=v\.width,hIn=v\.height\)/);
  assert.match(src, /outlinePath\(wIn\*25\.4,hIn\*25\.4,v\.patchShape/);
  assert.match(src, /function layoutPlan\(v\)/);
  assert.match(src, /function exportProjectJSON\(\)/);
});
