import assert from 'node:assert/strict';
import test from 'node:test';

const original = {
  clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  redirect: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  state: process.env.GOOGLE_CALENDAR_STATE_SECRET,
  encryption: process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY,
};

process.env.GOOGLE_CALENDAR_CLIENT_ID = 'calendar-test-client.apps.googleusercontent.com';
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALENDAR_REDIRECT_URI = 'https://inventory.example.com/.netlify/functions/google-calendar-oauth';
process.env.GOOGLE_CALENDAR_STATE_SECRET = 'state-secret-that-is-longer-than-thirty-two-characters';
process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const calendar = await import('../../netlify/functions/_shared/googleCalendar.js');

test('Google refresh tokens are encrypted with authenticated encryption', () => {
  const encrypted = calendar.encryptCalendarToken('refresh-token-example');
  assert.match(encrypted, /^v1\.[^.]+\.[^.]+\.[^.]+$/);
  assert.notEqual(encrypted, 'refresh-token-example');
  assert.equal(calendar.decryptCalendarToken(encrypted), 'refresh-token-example');
  assert.throws(() => calendar.decryptCalendarToken(`${encrypted}broken`), /cannot be decrypted|invalid/);
});

test('OAuth state is signed, expiring, and bound to the employee', () => {
  const state = calendar.createCalendarOAuthState({ userId: 'employee-123', role: 'admin' });
  const verified = calendar.verifyCalendarOAuthState(state);
  assert.equal(verified.user_id, 'employee-123');
  assert.equal(verified.role, 'admin');
  assert.ok(verified.expires_at > Date.now());

  const [payload, signature] = state.split('.');
  const changed = `${payload.slice(0, -1)}A.${signature}`;
  assert.throws(() => calendar.verifyCalendarOAuthState(changed), /security check|invalid/);
});

test('OAuth asks only for app-created calendar access', () => {
  const url = new URL(calendar.buildCalendarAuthorizationUrl({ userId: 'employee-123', role: 'admin' }));
  const scope = url.searchParams.get('scope') || '';
  assert.match(scope, /calendar\.app\.created/);
  assert.doesNotMatch(scope, /\/auth\/calendar(?:\s|$)/);
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.has('client_secret'), false);
});

test.after(() => {
  const mapping = {
    GOOGLE_CALENDAR_CLIENT_ID: original.clientId,
    GOOGLE_CALENDAR_CLIENT_SECRET: original.clientSecret,
    GOOGLE_CALENDAR_REDIRECT_URI: original.redirect,
    GOOGLE_CALENDAR_STATE_SECRET: original.state,
    GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: original.encryption,
  };
  for (const [name, value] of Object.entries(mapping)) {
    if (value == null) delete process.env[name];
    else process.env[name] = value;
  }
});
