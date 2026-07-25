import crypto from 'node:crypto';

export function cleanText(value) {
  return String(value ?? '').trim();
}

export function timingSafeEqualText(left, right) {
  const a = Buffer.from(cleanText(left));
  const b = Buffer.from(cleanText(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function rawRequestBody(event) {
  if (event?.isBase64Encoded && event?.body) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event?.rawBody || event?.body || '';
}

export function wooSignatureForBody(body, secret) {
  return crypto
    .createHmac('sha256', cleanText(secret))
    .update(String(body ?? ''), 'utf8')
    .digest('base64');
}
