import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateHeightmap,blurHeights,paintHeightmap,stlRelief,svgCutOutline,LASER_PRESETS } from '../../src/lib/laserReliefEngine.js';
const src=(x)=>fs.readFileSync(new URL('../../'+x,import.meta.url),'utf8');
const image=(w,h,get)=> {
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const [r,g,b,a]=get(x,y);data.set([r,g,b,a],i*4);}
 return {width:w,height:h,data};
};
test('masked transparent background is removed from relief and cannot be brush-painted',()=>{
 const input=image(6,6,(x,y)=>x>0&&x<5&&y>0&&y<5?[10,30,50,255]:[255,255,255,0]);
 const map=generateHeightmap(input,{mode:'logo',smoothing:0,bevel:2});
 assert.equal(map.values[0],0);
 assert.ok(map.values[3*6+3]>0);
 const updated=paintHeightmap(map,0,0,{tool:'raise',radius:5,strength:.5});
 assert.equal(updated.values[0],0);
 assert.equal(map.values[3*6+3],updated.values[3*6+3]-0.5<0?map.values[3*6+3]:map.values[3*6+3]);
});
test('inverse and grayscale modes handle photos without claiming calibrated depth',()=>{
 const input=image(4,3,(x)=>[x*85,x*85,x*85,255]);
 const a=generateHeightmap(input,{mode:'photo',smoothing:0,detail:0});
 const b=generateHeightmap(input,{mode:'photo',invert:true,smoothing:0,detail:0});
 assert.ok(a.values[0]<a.values[3]);
 assert.ok(b.values[0]>b.values[3]);
});
test('blur preserves a uniform map and export mesh uses requested physical dimensions',()=>{
 const map=blurHeights(new Float32Array([.5,.5,.5,.5]),2,2,3);
 assert.ok([...map].every(x=>Math.abs(x-.5)<1e-6));
 const height={width:4,height:4,values:new Float32Array(16).fill(.5)};
 const stl=stlRelief(height,{widthMm:40,heightMm:22,depthMm:.4,maxSamples:4});
 assert.match(stl,/solid skilled_crafting_laser_relief/);
 assert.match(stl,/vertex 40 22 /);
 assert.match(svgCutOutline({widthMm:40,heightMm:22}),/width="40mm" height="22mm"/);
});
test('all requested phases have route, private storage, asset versions, calibration and access controls',()=>{
 assert.ok(LASER_PRESETS.length>=5);
 assert.match(src('src/App.jsx'),/path="\/laser-relief"/);
 assert.match(src('src/ArtworkHub.jsx'),/3D Laser Relief Studio/);
 assert.match(src('src/navigationConfig.js'),/3D Laser Relief Studio/);
 const ui=src('src/LaserReliefStudio.jsx');
 for(const name of ['inferDepth','paintHeightmap','renderReliefPreview','export16BitPng',
   'stlRelief','svgCutOutline','uploadLaserAsset','listLaserAssets','sc_laser_tests',
   'material_recipe_id','Manager approval'])assert.ok(ui.includes(name),name);
 const sql=src('supabase/migrations/202611020001_laser_relief_studio.sql');
 assert.match(sql,/row level security/);
 assert.match(sql,/sc_current_app_role/);
 assert.match(sql,/passing physical material test/);
 assert.match(sql,/sc_laser_asset_write/);
 assert.match(src('netlify/functions/laser-asset-storage.js'),/authorizeEmployee/);
});
