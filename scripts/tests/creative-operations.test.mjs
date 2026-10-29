import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {computeDraftPackage} from '../../src/lib/creativePackageMath.js';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
test('packages use integer cent math and explicit uncertainty',()=>{
  const result=computeDraftPackage([{qty:3,cost:.1,price:.3},{qty:2,cost:.2,price:.5}],.3,.1);
  assert.equal(result.cost,1);
  assert.equal(result.revenue,2);
  assert.equal(result.contribution,1);
  assert.equal(result.contributionMargin,50);
  assert.match(result.disclaimer,/excludes sales tax/);
});
test('package economics rejects negative and nonsensical quantities',()=>{
  const r=computeDraftPackage([{qty:-6,cost:10,price:20},{qty:2.9,cost:5.3,price:9.9}],-10,0);
  assert.equal(r.cost,10.6);assert.equal(r.revenue,19.8);
  assert.equal(computeDraftPackage([],0,0).contributionMargin,null);
});
test('creative routes and staff navigation exist',()=>{
  const app=read('src/App.jsx'),nav=read('src/navigationConfig.js');
  assert.match(app,/CreativeOperationsSuite/);
  assert.equal((app.match(/path="\/creative-operations"/g)||[]).length,2);
  assert.match(nav,/path: '\/creative-operations'/);
});
test('knowledge table is internal and requires scoped roles and creator',()=>{
  const sql=read('supabase/migrations/20261029213000_sc_creative_knowledge_documents.sql');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all .* from anon/i);
  assert.match(sql,/sc_internal_access_allowed/i);
  assert.match(sql,/created_by = \(select auth.uid\(\)\)/);
  assert.doesNotMatch(sql,/to anon\s+using\s*\(true\)/i);
});
test('no paid inference APIs are called by creative modules',()=>{
  const js=['src/CreativeOperationsSuite.jsx','src/CreativeLocalAi.jsx','src/CreativeDesignWorkbench.jsx','src/CreativeKnowledgeHub.jsx']
    .map(read).join('\n');
  assert.doesNotMatch(js,/(?:api\.openai\.com|generativelanguage\.googleapis\.com|anthropic\.com|\.netlify\/functions\/dtf-ai-guidance)/i);
  assert.match(js,/onnx-community\/ormbg-ONNX/);
});
test('user-generated artwork is analyzed locally and customer workflow gates remain',()=>{
  const js=read('src/CreativeDesignWorkbench.jsx');
  assert.match(js,/toDataURL\('image\/png'\)/);
  assert.match(js,/not a scale-calibrated production mockup/i);
  assert.match(read('src/CreativeOperationsSuite.jsx'),/Approval|approval/i);
});
