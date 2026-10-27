import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('reviewed reorder preserves the authenticated request through trusted storage and traveler creation',async()=>{
 const artifact='00000000-0000-4000-8000-000000000007',version='00000000-0000-4000-8000-000000000005';
 const old={id:'prior-traveler',job_id:2,job_item_id:2,recipe_version_id:version,recipe_snapshot:{blank:{sku:'TEST-S',size:'S',color:'Black'},placement:'full_front',artwork_asset_id:artifact,machine_settings_id:'settings'}};
 const review={job_item_id:1,decision:'confirmed',source_traveler_id:old.id};
 const jobs=[{id:1,customer_id:7,customer_name:'Isolated fixture'},{id:2,customer_id:7,customer_name:'Isolated fixture'}];
 const data={job_items:[{id:1,job_id:1,order_sku:'TEST-S',size:'S',color:'Black',placement:'full_front',woocommerce_product_id:100}],sc_job_travelers:[old],sc_catalog_reorder_reviews:[review],sc_catalog_artwork_links:[{woocommerce_product_id:100,artwork_asset_id:artifact,review_required:false}],sc_manufacturing_recipe_versions:[{id:version,status:'approved',verified_sample:true}],sc_job_artwork_links:[{id:'proof'}]};
 const db={from(table){let single=false;let inValues;const q={select(){return q;},not(){return q;},limit(){return q;},order(){return q;},eq(){return q;},in(field,ids){if(table==='jobs'&&field==='id')inValues=ids;return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},then(resolve){const rows=table==='jobs'?(inValues?jobs.filter(j=>inValues.includes(j.id)):[jobs[0]]):data[table]||[];return Promise.resolve({data:single?rows[0]:rows,error:null}).then(resolve);}};return q;}};
 const event={httpMethod:'POST',headers:{authorization:'Bearer isolated-fixture-token'},body:JSON.stringify({action:'create_reorder_traveler',job_item_id:1,confirm:true})};
 let received;
 globalThis.__scReorderFixture={auth:{ok:true,role:'manager',user:{id:'fixture-actor'},supabase:db},create:async(request,input)=>{assert.equal(request,event);received=input;return 'new-traveler';}};
 try{
  let source=await readFile(new URL('../../netlify/functions/legacy-catalog-modernization.js',import.meta.url),'utf8');
  source=source.replace(/import .*createVerifiedTraveler.*\n/, 'const createVerifiedTraveler=(...args)=>globalThis.__scReorderFixture.create(...args);\n')
   .replace(/import .*authorizeEmployee.*\n/, 'const authorizeEmployee=async()=>globalThis.__scReorderFixture.auth;const jsonResponse=(statusCode,payload)=>({statusCode,body:JSON.stringify(payload)});\n')
   .replace(/import .*EXPANDED_STARTER_PRESETS.*\n/, 'const EXPANDED_STARTER_PRESETS=[];\n');
  const {handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const result=await handler(event);
  assert.equal(result.statusCode,200,result.body);
  assert.deepEqual(received,{jobId:1,itemIds:[1],recipeVersionId:version});
  assert.equal(JSON.parse(result.body).data.traveler_id,'new-traveler');
 }finally{delete globalThis.__scReorderFixture;}
});
