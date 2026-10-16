import test from 'node:test';
import assert from 'node:assert/strict';
import { isOpenShopJob, shopMetrics } from '../../src/lib/shopJobs.js';
import { productLogoOptions } from '../../netlify/functions/_shared/finishedLogoOptions.js';
import { mergeLogoOptions } from '../../src/lib/finishedLogoOptions.js';

test('completed and closed jobs never enter overdue lanes, regardless of cached status', () => {
  for (const key of ['saved_job_status','production_status','board_column','pullsheet_status','woo_status']) {
    for (const status of ['completed','production_complete','closed','cancelled','voided']) {
      assert.equal(isOpenShopJob({ production_status:'needs_attention',due_date_bucket:'overdue',[key]:status }), false, `${key}:${status}`);
    }
  }
  assert.equal(isOpenShopJob({woo_status:'wc-completed'}), false);
  assert.equal(isOpenShopJob({production_status:'qc',woo_status:'processing'}), true);
  const rows = [{ saved_job_status:'completed',due_date_bucket:'overdue' }, { production_status:'in_production',status_bucket:'in_production',due_date_bucket:'overdue' }].filter(isOpenShopJob);
  assert.equal(shopMetrics(rows).overdue, 1);
  assert.equal(shopMetrics(rows).in_production, 1);
});
test('local Logo Selection choices and global logo attributes are discovered without confusing placement', () => {
  const names = productLogoOptions([{ attributes:[
    {name:'Logo Selection',options:['EPO Orcas Black & White | East Port Orchard ES Orcas Classic','EPO Orcas Full Color']},
    {name:'Color',options:['Red']}, {name:'Placement',options:['Left Chest']},
    {name:'Logo Type',options:['Burley Bear']},
  ] }]);
  assert.equal(names.length, 4);
  assert(names.includes('EPO Orcas Full Color'));
  assert(!names.includes('Left Chest'));
  assert(!names.includes('Red'));
});
test('merging multiple logo pages preserves real foreign keys and keeps local choices name-only', () => {
  let rows = mergeLogoOptions([{id:'real-uuid',name:'Burley Bear'}], ['burley bear','EPO Orcas Full Color']);
  rows = mergeLogoOptions(rows, ['Other Design']);
  assert.equal(rows.length,3);
  assert.equal(rows.find((r)=>r.name==='Burley Bear').logoId,'real-uuid');
  assert.equal(rows.find((r)=>r.name==='EPO Orcas Full Color').logoId,null);
  rows = mergeLogoOptions([{id:'new-uuid',name:'EPO Orcas Full Color'}], rows.map((r)=>r.name));
  assert.equal(rows.find((r)=>r.name==='EPO Orcas Full Color').logoId,'new-uuid');
});
