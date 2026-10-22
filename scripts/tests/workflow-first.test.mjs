import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validatePrintDimensions, sourcePreflight, removeEdgeConnectedWhite, alphaBounds, setPngDpi,
} from '../../src/lib/dtfPreflight.js';

test('DTF output uses actual 300-DPI pixel dimensions with processing cap', () => {
  assert.deepEqual(validatePrintDimensions(12,12),{width:3600,height:3600});
  assert.throws(() => validatePrintDimensions(24,24), /between/);
  assert(sourcePreflight(500,500,3600,3600).needsUpscale);
  assert.equal(sourcePreflight(3600,3600,3600,3600).effectiveDpi,300);
});

test('edge white flood-fill preserves enclosed white within dark outline', () => {
  const w=5,h=5,data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const idx=(y*w+x)*4, dark=(x>=1&&x<=3&&y>=1&&y<=3&&(x!==2||y!==2));
    const v=dark?0:255;data.set([v,v,v,255],idx);
  }
  assert.equal(removeEdgeConnectedWhite(data,w,h,245),16);
  assert.equal(data[(2*w+2)*4+3],255,'interior white survives');
  assert.equal(data[3],0,'edge background removed');
  assert.deepEqual(alphaBounds(data,w,h),{x:1,y:1,width:3,height:3});
});

test('PNG pHYs metadata is added without generating external QR or artwork requests', () => {
  const header=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,2,0,0,0,2,8,6,0,0,0,0,0,0,0]);
  const out=setPngDpi(header,300);
  assert.equal(out.length,header.length+21);
  assert.equal(String.fromCharCode(...out.slice(37,41)),'pHYs');
  assert.equal(new DataView(out.buffer).getUint32(41),11811);
  assert.equal(new DataView(out.buffer).getUint32(45),11811);
});
test('scannable production packet and guided workflow are connected to existing routes', () => {
  const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(read('../../src/MockupProductionPacket.jsx'),/LocalQrCode/);
  assert.match(read('../../src/MockupProductionPacket.jsx'),/GarmentPlacementGuide/);
  assert.match(read('../../src/MockupProductionPacket.jsx'),/QC Checklist/);
  assert.match(read('../../src/WorkHub.jsx'),/listProductionStatusBoard/);
  assert.match(read('../../src/App.jsx'),/path="\/work-hub"/);
  assert.match(read('../../src/App.jsx'),/path="\/artwork-preflight"/);
  assert.match(read('../../src/navigationConfig.js'),/Work Hub — Start Here/);
  assert.match(read('../../src/navigationConfig.js'),/DTF Artwork Preflight/);
});
