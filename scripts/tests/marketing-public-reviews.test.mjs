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
