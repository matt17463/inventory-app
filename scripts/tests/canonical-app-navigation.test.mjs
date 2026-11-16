import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalNavigation } from '../../netlify/edge-functions/canonical-app-navigation.js';

const legacy = 'https://inventory.skilledcrafting.com';
const primary = 'https://app.skilledcrafting.com';
function navigation(path, overrides = {}) {
  return new Request(legacy + path, {
    headers: { 'sec-fetch-mode': 'navigate', accept: 'text/html,application/xhtml+xml' },
    ...overrides,
  });
}

test('normal legacy browser navigation preserves path and query', () => {
  const response = canonicalNavigation(navigation('/client-orders?view=active&search=A%2BB'), true);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), primary + '/client-orders?view=active&search=A%2BB');
});

test('disabled cutover, app host, integration requests and auth callbacks are preserved', () => {
  assert.equal(canonicalNavigation(navigation('/client-orders'), false), undefined);
  assert.equal(canonicalNavigation(new Request(primary + '/client-orders'), true), undefined);
  assert.equal(canonicalNavigation(navigation('/client-orders', { method: 'POST' }), true), undefined);
  assert.equal(canonicalNavigation(navigation('/client-orders', { headers: { accept: 'application/json' } }), true), undefined);
  for (const path of ['/', '/reset-password','/auth/callback','/.netlify/functions/manual-pullsheet','/api/integration','/service-worker.js','/equipment-center?auth_callback=1&code=example','/google-calendar?state=example','/webhook/order','/%2Freset-password']) {
    assert.equal(canonicalNavigation(navigation(path), true), undefined, path);
  }
});
