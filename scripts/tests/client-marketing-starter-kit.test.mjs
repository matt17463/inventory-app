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

test('Shared blanks come from existing Mockup Studio catalog', () => {
  assert.match(kit, /searchMockupBlankCatalog\(search\)/);
  assert.match(kit, /row\.image_url/);
});

test('Reusing graphics does not upload or overwrite originals', () => {
  assert.doesNotMatch(kit, /\.insert\(|\.update\(|\.upsert\(|create_upload|presignedR2Put/);
  assert.match(kit, /signedAssetUrl\(asset\.row/);
});

test('Only approved mockup outputs are offered', () => {
  assert.match(kit, /approval_status === "internal_approved"/);
  assert.match(kit, /approval_status === "customer_approved"/);
});
