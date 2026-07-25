import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { validateSharedSecret, validateWooCommerceSignature } from '../netlify/functions/_shared/security.js';

process.env.TEST_SHARED_SECRET = 'test-secret-value';
process.env.WC_WEBHOOK_SECRET = 'woo-test-secret';

const shared = validateSharedSecret(
  { headers: { 'x-test-secret': 'test-secret-value' } },
  { envNames: ['TEST_SHARED_SECRET'], headerNames: ['x-test-secret'] }
);
assert.equal(shared.ok, true);

const body = JSON.stringify({ id: 123, status: 'processing' });
const signature = crypto.createHmac('sha256', process.env.WC_WEBHOOK_SECRET).update(body, 'utf8').digest('base64');
const signed = validateWooCommerceSignature({ body, headers: { 'x-wc-webhook-signature': signature } });
assert.equal(signed.ok, true);
assert.equal(signed.rawBody, body);

const missing = validateWooCommerceSignature({ body, headers: {} });
assert.equal(missing.ok, false);
assert.equal(missing.statusCode, 401);

console.log('Steps 3-5 shared-secret and WooCommerce HMAC validation tests passed.');
