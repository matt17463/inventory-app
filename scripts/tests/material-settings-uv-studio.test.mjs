import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { MACHINE_TYPES, OPERATION_LABELS, machineFor, materialSafety, normalizeSettingsJson, formatRecipeCSV } from '../../src/lib/materialSettings.js';

test('all six equipment categories map to supported operations',()=>{
 assert.equal(MACHINE_TYPES.length,6);
 for (const machine of MACHINE_TYPES){
   assert.ok(machine.modes.length);
   assert.equal(machineFor(machine.id).id,machine.id);
   for(const op of machine.modes)assert.ok(OPERATION_LABELS[op],op);
 }
});
test('blocks laser engraving PVC or unidentified plastic, regardless of case',()=>{
 for(const m of ['mopa_fiber','xtool_s1','xtool_p2']){
  for(const s of ['PVC sheet','polyvinyl chloride film','unknown plastic','VINYL CHLORIDE']){
   assert.equal(materialSafety(m,s).blocked,true,m+' '+s);
  }
 }
});
test('does not wrongly block UV printing compatible transfer products',()=>{
 assert.equal(materialSafety('xtool_omni','3D TPU transfer film').blocked,false);
 assert.match(materialSafety('xtool_omni','HTV film').warning,/not automatically compatible/);
});
test('requires identified materials',()=>{
 assert.equal(materialSafety('heat_press',' ').blocked,true);
});
test('settings objects must be valid JSON object not arrays',()=>{
 assert.deepEqual(normalizeSettingsJson('{"speed_mm_s":20}'),{speed_mm_s:20});
 assert.throws(()=>normalizeSettingsJson('[]'),/one JSON object/);
 assert.throws(()=>normalizeSettingsJson('not-json'),SyntaxError);
});
test('CSV export escapes values and spreadsheet formulas',()=>{
 const csv=formatRecipeCSV([{machine_type:'mopa_fiber',machine_model:'X',material_name:'=HYPERLINK("BAD")',settings:{angle:30}}]);
 assert.ok(csv.includes("'=HYPERLINK"));
 assert.ok(csv.includes('angle'));
});
test('UV Studio and settings are routed and provide secured data migration',()=>{
 const app=fs.readFileSync('src/App.jsx','utf8');
 const menu=fs.readFileSync('src/navigationConfig.js','utf8');
 const sql=fs.readFileSync('supabase/migrations/202610200001_uv_studio_material_recipes.sql','utf8');
 const html=fs.readFileSync('public/uv-studio/index.html','utf8');
 const api=fs.readFileSync('netlify/functions/material-settings-ai.js','utf8');
 const netlify=fs.readFileSync('netlify.toml','utf8');
 assert.match(app,/path="\/uv-studio"/);
 assert.match(app,/path="\/material-settings"/);
 assert.match(menu,/UV Studio — Textured Patches/);
 assert.match(menu,/Material & Machine Settings/);
 for(const table of ['sc_uv_projects','sc_uv_project_events','sc_material_recipes','sc_material_recipe_trials']){
  assert.match(sql,new RegExp('create table if not exists public\\.'+table));
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(sql,/passing physical test/);
 assert.match(html,/SC_UV_REQUEST_SNAPSHOT/);
 assert.match(html,/height-map-grayscale/);
 assert.match(api,/authorizeEmployee/);
 assert.match(api,/OPENAI_API_KEY/);
 assert.match(netlify,/ignore = "node scripts\/netlify-ignore-non-production\.mjs"/);
});


test('embedded UV design editor JavaScript is valid and Design Pro actions are connected',()=>{
  const html=fs.readFileSync('public/uv-studio/index.html','utf8');
  const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length,'At least one inline script must be present');
  for(const [,script] of blocks)new vm.Script(script,{filename:'uv-studio-inline.js'});
  for(const id of ['cleanupWhite','effectStyle','productProofCanvas','personalizationRows','downloadRosterSheet']) assert.ok(html.includes('id="'+id+'"'));
  for(const marker of ['scRosterRows','scProductProof','SC_UV_SNAPSHOT']) assert.ok(html.includes(marker));
});
