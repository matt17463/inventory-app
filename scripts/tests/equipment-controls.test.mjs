import test from 'node:test';
import assert from 'node:assert/strict';
import { controlFor, entityPresentation, validHaUrl } from '../../src/lib/equipment.js';
import { shouldDetectSupabaseCallback } from '../../src/lib/authCallbackRouting.js';

test('Home Assistant callbacks keep their authorization code away from Supabase', () => {
  assert.equal(shouldDetectSupabaseCallback(new URL('https://app.example/equipment-center?auth_callback=1&code=ha-code')), false);
  assert.equal(shouldDetectSupabaseCallback(new URL('https://app.example/?code=supabase-code')), true);
  assert.equal(shouldDetectSupabaseCallback(new URL('https://app.example/equipment-center?code=supabase-code')), true);
});

test('live connection refuses credentials, mixed content and invalid schemes', () => {
  assert.equal(validHaUrl('https://scshoppi.tail934ae0.ts.net/'), 'https://scshoppi.tail934ae0.ts.net');
  for (const address of ['http://100.117.18.123:8123', 'https://user:password@example.com', 'javascript:alert(1)', 'https://example.com/path', 'https://example.com/?token=secret']) assert.throws(() => validHaUrl(address));
});

test('controls allow explicit on/off targets and exclude dangerous or unavailable devices', () => {
  const entity = (id, state = 'off', name = '') => ({ entity_id: id, state, attributes: { friendly_name: name } });
  assert.deepEqual(controlFor(entity('switch.business_hs200_switch'), 'on'), { domain: 'switch', service: 'turn_on', target: { entity_id: 'switch.business_hs200_switch' } });
  for (const id of ['lock.business', 'button.laser_start', 'script.start_job', 'cover.garage', 'switch.xtool_power', 'switch.roland_printer']) assert.equal(controlFor(entity(id), 'on'), null);
  assert.equal(controlFor(entity('switch.socket', 'off', 'Laser power'), 'on'), null);
  assert.equal(controlFor(entity('switch.socket', 'unavailable'), 'on'), null);
  assert.equal(controlFor(entity('switch.socket'), 'toggle'), null);
});

test('missing data is never presented as a live online reading', () => {
  assert.equal(entityPresentation(null).label, 'Not connected');
  assert.equal(entityPresentation({ state: 'unavailable' }).kind, 'pending');
  assert.deepEqual(entityPresentation({ state: 'off', attributes: { device_class: 'connectivity' } }), { label: 'Unreachable', kind: 'warn' });
});

test('maintenance problems and timestamps have readable, truthful labels', () => {
  const problem = (state) => ({ state, attributes: { device_class: 'problem' } });
  assert.deepEqual(entityPresentation(problem('on')), { label: 'Attention requested', kind: 'warn' });
  assert.deepEqual(entityPresentation(problem('off')), { label: 'Clear', kind: 'good' });
  for (const state of ['unknown', 'unavailable', 'unexpected']) assert.equal(entityPresentation(problem(state)).kind, 'pending');
  assert.equal(entityPresentation({ state: 'bad date', attributes: { device_class: 'timestamp' } }).kind, 'pending');
  const date = '2026-10-16T04:33:07+00:00';
  assert.equal(entityPresentation({ state: date, attributes: { device_class: 'timestamp' } }).label, new Date(date).toLocaleString());
});
