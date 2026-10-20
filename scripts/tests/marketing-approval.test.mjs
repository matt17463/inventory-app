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
