import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=name=>readFileSync(new URL(name,import.meta.url),"utf8");
const issue=file("../../netlify/functions/marketing-review-link.js");
const feedback=file("../../netlify/functions/marketing-review-response.js");
const review=file("../../src/MarketingClientReview.jsx");
const migration=file("../../supabase/migrations/20261019230000_marketing_external_reviews.sql");
test("external review uses private hashed expiring tokens and redacted data",()=>{
 assert.match(issue,/randomBytes\(32\)/);
 assert.match(issue,/createHash\("sha256"\)/);
 assert.match(issue,/allowedRoles:\["admin","manager"\]/);
 assert.match(issue,/const content=\{/);
 assert.doesNotMatch(issue,/content:\{\.\.\.source/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.sc_growth_document_reviews from public,anon,authenticated/);
});
test("client response is single-use and cannot trigger production",()=>{
 assert.match(feedback,/\.is\("decision",null\)/);
 assert.match(feedback,/\.gt\("expires_at"/);
 assert.match(review,/changes_requested/);
 assert.doesNotMatch(feedback,/jobs\)/);
});

test("database review guard rejects token identity changes and replay",()=>{
 const sql=file("../../supabase/migrations/20261019231000_marketing_review_response_guard.sql");
 assert.match(sql,/sc_growth_review_response_guard_v1/);
 assert.match(sql,/old\.decision is not null/);
 assert.match(sql,/new\.token_hash is distinct from old\.token_hash/);
 assert.match(sql,/old\.expires_at<=now\(\)/);
});

test("review endpoints prevent browser caching of private client data",()=>{
 for(const path of ["../../netlify/functions/marketing-review-link.js","../../netlify/functions/marketing-review-response.js"]){
  const src=file(path);
  assert.match(src,/Cache-Control/);
  assert.match(src,/no-store, private/);
  assert.match(src,/Referrer-Policy/);
  assert.match(src,/no-referrer/);
 }
});

test("public client review page disables referrer sharing",()=>{
 assert.match(review,/meta\.name="referrer"/);
 assert.match(review,/meta\.content="no-referrer"/);
});
