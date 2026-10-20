import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../supabase/migrations/20261019220000_marketing_sample_production_review.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../../src/MarketingWorkspace.jsx",import.meta.url),"utf8");
test("sample requests require manager review and do not mutate stock",()=>{
 assert.match(sql,/sc_require_internal_access\(array\['admin','manager'\]\)/);
 assert.match(sql,/sc_growth_sample_review_guard_v1/);
 assert.match(sql,/production_review_status/);
 assert.match(sql,/on conflict\(opportunity_id,task_key\) do nothing/);
 assert.match(sql,/production_job_created',false/);
 assert.doesNotMatch(sql,/update public\.blank_products/);
});
test("marketing approval calls review RPC rather than job creation",()=>{
 assert.match(ui,/sc_growth_review_sample_v1/);
 assert.match(ui,/Approve sample for production review/);
});
