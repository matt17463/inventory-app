import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  rawRequestBody,
  timingSafeEqualText,
  wooSignatureForBody,
} from '../../netlify/functions/_shared/cryptoSecurity.js';

test('WooCommerce HMAC matches SHA-256 base64', () => {
  const body = JSON.stringify({ id: 123, status: 'processing' });
  const secret = 'test-secret';
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  assert.equal(wooSignatureForBody(body, secret), expected);
});

test('timing-safe comparison rejects unequal values and accepts equal values', () => {
  assert.equal(timingSafeEqualText('same', 'same'), true);
  assert.equal(timingSafeEqualText('same', 'different'), false);
});

test('raw body preserves base64 encoded webhook payload', () => {
  const body = '{"id":42}';
  assert.equal(rawRequestBody({ body: Buffer.from(body).toString('base64'), isBase64Encoded: true }), body);
});
