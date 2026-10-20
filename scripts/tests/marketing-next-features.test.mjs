import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const fetchText = (path) => readFileSync(new URL(path,import.meta.url),"utf8");
test("catalog endpoint is read only, employee restricted and never makes stock or pricing claims",()=>{
 const source=fetchText("../../netlify/functions/marketing-catalog-search.js");
 assert.match(source,/allowedRoles:\["admin","manager","operator","marketing"\]/);
 assert.match(source,/supplier_catalog_review/);
 assert.match(source,/availability_verified:false/);
 assert.match(source,/price_verified:false/);
 assert.doesNotMatch(source,/\.insert\(/);
 assert.doesNotMatch(source,/\.update\(/);
});
test("store concept explicitly omits working checkout",()=>{
 const source=fetchText("../../src/MarketingStorePreview.jsx");
 assert.match(source,/NOT A LIVE STORE/);
 assert.match(source,/No checkout, live orders or product availability implied/);
});
