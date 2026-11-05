import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeHex,separateCoinColors,coinStudioManifest,DEFAULT_COIN_LAYERS,buildCoinStudioParameters} from '../../src/lib/omniCoinLayers.js';
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

test('metal candidates and approved material recipes remain distinct',()=>{
 const baseline=buildCoinStudioParameters({material:'brass'});
 assert.equal(baseline.values.effect,'Flat');assert.equal(baseline.values.whiteLayers,1);
 assert.equal(baseline.evidence,'shop trial candidate');
 const approved=buildCoinStudioParameters({material:'steel',recipe:{id:'verified-1',status:'approved',machine_type:'xtool_omni',
 settings:{print_effect:'Texture',white_layers:2,color_layers:1,target_relief_mm:0.3,texture_smoothness:1}},
 overrides:{varnishLayers:1}});
 assert.equal(approved.evidence,'approved material recipe');
 assert.equal(approved.values.effect,'Texture');assert.equal(approved.values.whiteLayers,2);
 assert.equal(approved.values.textureThicknessMm,0.3);assert.equal(approved.values.varnishLayers,1);
});
test('unapproved and wrong machine recipes cannot inject settings',()=>{
 for(const recipe of [{status:'draft',machine_type:'xtool_omni',settings:{white_layers:19}},
 {status:'approved',machine_type:'mopa_fiber',settings:{white_layers:19}}]){
 assert.equal(buildCoinStudioParameters({recipe}).values.whiteLayers,1);}
 assert.throws(()=>buildCoinStudioParameters({overrides:{whiteLayers:21}}));
 assert.throws(()=>buildCoinStudioParameters({overrides:{effect:'Cut'}}));
});
test('manifest includes Studio setup controls and process order instructions',()=>{
 const manifest=coinStudioManifest({title:'Coin',widthMm:38.1,heightMm:38.1,depthMm:0.35,
 layers:[],processingParameters:buildCoinStudioParameters({material:'brass'})});
 assert.equal(manifest.processingParameters.values.inkMode,'White+Color');
 assert.match(manifest.operatorInstructions.join(' '),/white ink choke/);
 assert.match(manifest.operatorInstructions.join(' '),/By layer/);
});
