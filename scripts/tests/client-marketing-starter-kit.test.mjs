import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kit = readFileSync(new URL('../../src/ClientMarketingStarterKit.jsx', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../../src/MarketingDocumentStudio.jsx', import.meta.url), 'utf8');

test('Document Studio exposes reusable marketing assets', () => {
  assert.match(studio, /<ClientMarketingStarterKit/);
  assert.match(studio, /onSelectLogo=/);
  assert.match(studio, /onSelectProduct=/);
});

test('Client artwork uses exact customer ID, not client-name matching', () => {
  assert.match(kit, /eq\("customer_id_text", String\(customerId\)\)/);
  assert.doesNotMatch(kit, /\.ilike\("customer_name"/);
});

test('Only R2-backed blank graphics from linked Mockup Studio projects are offered', () => {
  assert.match(kit, /item\.storage_provider === "r2"/);
  assert.match(kit, /item\.storage_path && item\.storage_bucket/);
  assert.doesNotMatch(kit, /searchMockupBlankCatalog/);
  assert.match(kit, /getMockupProjectBundle/);
});

test('Asset picker does not upload or overwrite originals (document persistence requires separate verification)', () => {
  assert.doesNotMatch(kit, /\.insert\(|\.update\(|\.upsert\(|create_upload|presignedR2Put/);
  assert.match(kit, /marketing-shared-asset/);
});

test('Only approved mockup outputs are offered', () => {
  assert.match(kit, /approval_status === "internal_approved"/);
  assert.match(kit, /approval_status === "customer_approved"/);
});

test('Private asset access is checked on the server before signing', () => {
  const server = readFileSync(new URL('../../netlify/functions/marketing-shared-asset.js', import.meta.url), 'utf8');
  assert.match(server, /authorizeEmployee/);
  assert.match(server, /String\(project.customer_id_text\) !== String\(account.customer_id\)/);
  assert.match(server, /signedStoredAssetUrl/);
  assert.match(server, /internal_approved/);
});
test('Database guards direct writes of shared artwork references', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/20261109140000_marketing_shared_asset_reference_guard.sql', import.meta.url), 'utf8');
  assert.match(migration, /before insert or update of content, account_id/);
  assert.match(migration, /Shared artwork belongs to another customer/);
});
