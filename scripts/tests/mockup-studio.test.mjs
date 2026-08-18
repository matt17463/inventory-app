import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('mockup database migration contains the complete isolated schema', async () => {
  const sql = await read('deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql');
  for (const table of [
    'mockup_projects', 'mockup_blank_assets', 'mockup_artwork_assets',
    'mockup_placements', 'mockup_generation_jobs', 'mockup_outputs',
    'mockup_review_tokens', 'mockup_reviews', 'mockup_pricing_items',
    'mockup_woo_exports', 'mockup_production_packets',
  ]) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
  for (const bucket of ['sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production']) assert.match(sql, new RegExp(bucket));
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all privileges on table[\s\S]*from public, anon/i);
  assert.match(sql, /security invoker/i);
});

test('mockup routes include employee studio, production packet, and public review', async () => {
  const app = await read('src/App.jsx');
  const navigation = await read('src/navigationConfig.js');
  assert.match(app, /path="\/mockup-studio"/);
  assert.match(app, /path="\/mockup-studio\/:projectId\/production-packet"/);
  assert.match(app, /path="\/mockup-review"/);
  assert.match(navigation, /Mockup Studio/);
});

test('AI generation uses an authenticated background function and server-only key', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const fn = await read('netlify/functions/mockup-generate-background.js');
  assert.match(api, /mockup-generate-background/);
  assert.match(api, /mockup_generation_jobs/);
  assert.match(fn, /authorizeEmployee/);
  assert.match(fn, /requiredEnv\('OPENAI_API_KEY'\)/);
  assert.doesNotMatch(fn, /VITE_OPENAI/);
  assert.match(fn, /input_fidelity', 'high'/);
});

test('customer approval uses hashed tokens and private signed images', async () => {
  const fn = await read('netlify/functions/mockup-customer-review.js');
  const sql = await read('deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql');
  assert.match(fn, /sha256\(token\)/);
  assert.match(fn, /createSignedUrl/);
  assert.match(sql, /public\s*=\s*false/i);
  assert.match(sql, /sc_mockup_create_review_token/i);
});

test('WooCommerce export supports drafts, images, captions, and variations', async () => {
  const fn = await read('netlify/functions/mockup-publish-woocommerce.js');
  assert.match(fn, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn, /createSignedUrl/);
  assert.match(fn, /_sc_mockup_captions/);
  assert.match(fn, /variations\/batch/);
  assert.match(fn, /'draft'/);
});

test('project deletion is privileged and cleans private storage', async () => {
  const api = await read('src/lib/mockupStudioApi.js');
  const fn = await read('netlify/functions/mockup-delete-project.js');
  assert.match(api, /mockup-delete-project/);
  assert.match(fn, /allowedRoles: \['admin', 'manager'\]/);
  assert.match(fn, /storage\.from\(bucket\)\.remove/);
});

test('exact compositor preserves an AI-free rendering path with captions', async () => {
  const canvas = await read('src/lib/mockupCanvas.js');
  assert.match(canvas, /renderMockupComposite/);
  assert.match(canvas, /caption/);
  assert.match(canvas, /font/);
  assert.match(canvas, /fillText/);
});
