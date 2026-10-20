import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const migration = readFileSync(new URL("../../supabase/migrations/20261019200000_marketing_document_drafts.sql",import.meta.url),"utf8");
const component = readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
test("marketing document data has RLS and no anonymous write permission",()=>{
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all on public\.sc_growth_documents from public,anon,authenticated/i);
  assert.match(migration,/create policy growth_docs_write/i);
  assert.match(migration,/created_by=\(select auth\.uid\(\)\)/);
  assert.match(migration,/Approved documents are immutable/);
});
test("marketing document drafts require a stored client and exclude raw logo bytes",()=>{
  assert.match(component,/if \(!guide \|\| !accountId\)/);
  assert.match(component,/logo: unusedLocalImage/);
  assert.match(component,/logo_upload_required/);
  assert.match(component,/growthWriteAllowed\(\)/);
  assert.match(component,/Save client draft/);
});
