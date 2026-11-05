import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeHex,separateCoinColors,coinStudioManifest,DEFAULT_COIN_LAYERS} from '../../src/lib/omniCoinLayers.js';
const source=()=>({width:3,height:1,data:new Uint8ClampedArray([200,164,77,255,32,32,32,255,5,100,220,255])});
test('layer separation creates aligned transparent bitmaps and reports unmatched colors',()=>{
 const result=separateCoinColors(source(),DEFAULT_COIN_LAYERS);
 assert.equal(result.layers.length,2);
 assert.equal(result.layers[0].pixels,1);
 assert.equal(result.layers[1].pixels,1);
 assert.equal(result.unmatchedPixels,1);
 assert.equal(result.layers[0].data[3],255);
 assert.equal(result.layers[0].data[7],0);
 assert.equal(result.layers[1].data[7],255);
});
test('layer order, selection and intent are retained',()=>{
 const layers=[{id:'white',name:'Underbase',color:'#ffffff',tolerance:255,order:2,process:'White'},
 {id:'dark',name:'Detail',color:'#202020',tolerance:70,order:1,process:'CMYK'}];
 const result=separateCoinColors(source(),layers);
 assert.deepEqual(result.layers.map(x=>x.id),['dark','white']);
 assert.equal(result.layers[0].process,'CMYK');
});
test('rejects invalid color and source; manifest makes Studio manual steps explicit',()=>{
 assert.deepEqual(normalizeHex('#00ff80'),[0,255,128]);
 assert.throws(()=>normalizeHex('red'));
 assert.throws(()=>separateCoinColors({width:1,height:1,data:[]},DEFAULT_COIN_LAYERS));
 const result=separateCoinColors(source(),DEFAULT_COIN_LAYERS);
 const manifest=coinStudioManifest({title:'Coin',widthMm:38.1,heightMm:38.1,depthMm:0.35,layers:result.layers,unmatchedPixels:result.unmatchedPixels});
 assert.equal(manifest.relativeReliefOnly,true);
 assert.match(manifest.operatorInstructions.join(' '),/actual white, color and varnish passes/);
});
test('existing relief editor exposes Omni export and on-screen completion checklist',()=>{
 const ui=fs.readFileSync(new URL('../../src/LaserReliefStudio.jsx',import.meta.url),'utf8');
 assert.match(ui,/exportCoinLayers/);
 assert.match(ui,/Finish this coin in xTool Studio/);
 assert.match(ui,/unmatchedPixels/);
});
