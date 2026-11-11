import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workspace = readFileSync(new URL("../../src/MarketingWorkspace.jsx",import.meta.url),"utf8");
const studio = readFileSync(new URL("../../src/MarketingDocumentStudio.jsx",import.meta.url),"utf8");
const logo = readFileSync(new URL("../../src/MarketingClientLogo.jsx",import.meta.url),"utf8");
const artwork = readFileSync(new URL("../../src/lib/marketingArtwork.js",import.meta.url),"utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20261110170000_marketing_account_logo.sql",import.meta.url),"utf8");
test("Edit Client includes a separate marketing-only logo",()=>{
 assert.match(workspace, /<MarketingClientLogo key=\{form.id\} accountId=\{form.id\}/);
 assert.match(workspace, /change\("marketing_logo_key", key\)/);
 assert.match(migration, /add column if not exists marketing_logo_key text/);
});
test("Private client logo upload is authenticated and supports removal",()=>{
 assert.match(logo,/authenticatedFunctionFetch/);
 assert.match(artwork,/marketing-artwork-asset/);
 assert.match(logo,/file.size > 2_500_000/);
 assert.match(logo,/onChange\(null\)/);
});
test("Document Studio loads the CRM logo and persists a private R2 reference",()=>{
 assert.match(studio,/marketingLogoImage\(accountId, marketingLogoKey\)/);
 assert.match(studio,/accountMarketingLogo && guide.logo === logo/);
 assert.match(studio,/marketing_artwork: storedArtwork/);
});

test("Private raster previews reuse account-scoped authenticated storage",()=>{
 const endpoint = readFileSync(new URL("../../netlify/functions/marketing-artwork-asset.js",import.meta.url),"utf8");
 assert.match(artwork,/inline: "1"/);
 assert.match(endpoint,/key\.startsWith\("marketing\/artwork\/"\+accountId\+"\/"\)/);
 assert.match(endpoint,/"X-Content-Type-Options":"nosniff"/);
 assert.match(studio,/\[accountId, marketingLogoKey\]/);
 assert.match(studio,/logoSelection\.current !== selection/);
});
test("Draft updates compare the saved timestamp and preserve the approval boundary",()=>{
 assert.match(studio,/\.eq\("status", "draft"\)\.eq\("updated_at", editingDraft\.updated_at\)/);
 assert.match(studio,/previous_document_id: revisionOf\.id/);
 assert.match(studio,/version: revisionOf\.version \+ 1/);
});
