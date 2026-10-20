import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../supabase/migrations/20261019210000_marketing_document_manager_approval.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
test("only admins and managers can approve immutable documents",()=>{
 assert.match(sql,/sc_require_internal_access\(array\['admin','manager'\]\)/);
 assert.match(sql,/Approved documents are immutable/);
 assert.match(sql,/p_expected_updated_at/);
 assert.match(sql,/sc_growth_approve_document_v1/);
});
test("document UI gates approval by manager and testing-mode controls",()=>{
 assert.match(ui,/manager && d.status==="draft"/);
 assert.match(ui,/growthWriteAllowed\(\)/);
 assert.match(ui,/sc_growth_approve_document_v1/);
});

test("release policy allows manager approval but retains draft-only editor access",()=>{
 const fix=readFileSync(new URL("../../supabase/migrations/20261019232000_marketing_release_policy_fixes.sql",import.meta.url),"utf8");
 assert.match(fix,/status='approved' and \(select public\.sc_internal_access_allowed\(array\['admin','manager'\]\)\)/);
 assert.match(fix,/drop policy if exists growth_docs_update/);
 assert.match(fix,/old\.expires_at<=now\(\)/);
 assert.match(fix,/Review revocation cannot be reversed/);
});
