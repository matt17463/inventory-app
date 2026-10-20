import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const server = readFileSync(new URL("../../netlify/functions/marketing-ai-draft.js", import.meta.url),"utf8");
const client = readFileSync(new URL("../../src/lib/marketingAI.js", import.meta.url),"utf8");
const studio = readFileSync(new URL("../../src/MarketingDocumentStudio.jsx", import.meta.url),"utf8");
test("AI marketing endpoint requires employee authentication and server-side key", () => {
 assert.match(server,/authorizeEmployee\(event/);
 assert.match(server,/allowedRoles: \["admin", "manager", "operator", "marketing"\]/);
 assert.match(server,/process\.env\.OPENAI_API_KEY/);
 assert.doesNotMatch(client,/OPENAI_API_KEY/);
 assert.match(server,/review_required: true/);
});
test("marketing studio edits generated draft and never auto-sends it",()=>{
 assert.match(studio,/generateMarketingDraft/);
 assert.match(studio,/Edit AI generated copy/);
 assert.match(studio,/Use as document description/);
 assert.doesNotMatch(studio,/sendEmail\(/);
});
