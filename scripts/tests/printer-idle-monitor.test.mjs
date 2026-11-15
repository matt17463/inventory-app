import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { DAY_MS, printerStatus } from '../../src/lib/printerActivity.js';
import { makeHandler, normalizePrinterEvent } from '../../netlify/functions/printer-activity-bridge.js';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const now = Date.parse('2026-11-14T23:00:00Z');
const fixture = {
  printer_id: 'roland',
  event_key: 'connect-hub:324',
  occurred_at: '2026-11-14T22:00:00Z',
  kind: 'print',
  job_type: 'production_print',
  outcome: 'completed',
  detail: 'Connect Hub print 324',
};

test('reminder boundaries use elapsed time, including DST, and keep overdue visible', () => {
  const row = { last_print_at: '2026-10-31T16:00:00-07:00', idle_days: 7, warning_days: 2, planned_mode: 'vacation' };
  const started = Date.parse(row.last_print_at);
  assert.equal(printerStatus(null, started).status, 'unknown');
  assert.equal(printerStatus(row, started - 61000).status, 'unknown');
  assert.equal(printerStatus(row, started + 5 * DAY_MS - 1).status, 'ok');
  const warning = started + 5 * DAY_MS;
  assert.equal(printerStatus(row, warning).status, 'soon');
  const snoozed = { ...row, snoozed_until: new Date(started + 9 * DAY_MS).toISOString() };
  assert.equal(printerStatus(snoozed, warning).reminder_snoozed, true);
  const deadline = printerStatus(snoozed, started + 7 * DAY_MS);
  assert.equal(deadline.status, 'overdue');
  assert.equal(deadline.reminder_snoozed, false);
  assert.equal(deadline.due_at, '2026-11-07T23:00:00.000Z');
});

test('only fresh hardware telemetry contributes an observed hardware mode', () => {
  const row = { staff_observed_mode: 'vacation', hardware_mode: 'sleep', telemetry_at: new Date(now).toISOString() };
  assert.equal(printerStatus(row, now).verified_mode, 'sleep');
  assert.equal(printerStatus(row, now + 5 * 60000 + 1).telemetry, 'stale');
  assert.equal(printerStatus(row, now + 5 * 60000 + 1).verified_mode, 'unknown');
  assert.equal(printerStatus({ ...row, telemetry_at: null }, now).telemetry, 'unavailable');
});

test('ingest requires typed successful production evidence and a valid telemetry report', () => {
  assert.equal(normalizePrinterEvent(fixture, now).source, 'roland_connect');
  for (const job_type of ['maintenance', 'adjustment', 'calibration', undefined]) {
    assert.equal(normalizePrinterEvent({ ...fixture, job_type }, now), null);
  }
  for (const occurred_at of ['2026-11-14', 'invalid', '2026-11-14T23:02:00Z']) {
    assert.equal(normalizePrinterEvent({ ...fixture, occurred_at }, now), null);
  }
  assert.equal(normalizePrinterEvent({ ...fixture, outcome: 'failed' }, now), null);
  assert.equal(normalizePrinterEvent({ ...fixture, printer_id: 'constructor' }, now), null);
  const sample = {
    printer_id: 'omni', event_key: 'studio:334', occurred_at: fixture.occurred_at,
    kind: 'telemetry', readings: { uv_head_1_c: 31, humidity_pct: 48, waste_ink_full: false },
  };
  assert.deepEqual(normalizePrinterEvent(sample, now).readings, sample.readings);
  for (const readings of [{ humidity_pct: 101 }, { file_name: 'private' }, { waste_ink_full: 'false' }, {}]) {
    assert.equal(normalizePrinterEvent({ ...sample, readings }, now), null);
  }
});

test('bridge isolates read and write credentials, disables caching, and accepts duplicate retries', async () => {
  const readToken = 'r'.repeat(40);
  const writeToken = 'w'.repeat(40);
  const rolandPrintToken = 'p'.repeat(40);
  let writes = 0;
  const handler = makeHandler({
    env: { PRINTER_HA_READ_TOKEN: readToken, PRINTER_EVENT_WRITE_TOKEN: writeToken, PRINTER_ROLAND_PRINT_TOKEN: rolandPrintToken },
    connect: () => ({ from: (table) => ({
      select: async () => {
        assert.equal(table, 'sc_printer_activity');
        return { data: [
          { printer_id: 'roland', telemetry_at: '2026-10-17T22:14:35Z', hardware_mode: 'sleep', readings: { jobs_7d: 1 } },
          { printer_id: 'omni' },
        ] };
      },
      insert: async (record) => {
        assert.equal(table, 'sc_printer_activity_events');
        assert.equal(record.kind, 'print');
        return { error: ++writes === 1 ? null : { code: '23505' } };
      },
    }) }),
  });
  const request = (httpMethod, key, body = fixture) => handler({
    httpMethod, headers: { authorization: `Bearer ${key}` }, body: JSON.stringify(body),
  });
  assert.equal((await request('GET', writeToken)).statusCode, 401);
  assert.equal((await request('POST', readToken)).statusCode, 401);
  assert.equal((await request('POST', writeToken, { ...fixture, kind: 'settings' })).statusCode, 422);
  assert.equal((await request('POST', writeToken)).statusCode, 403);
  const result = await request('GET', readToken);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  const { roland } = JSON.parse(result.body);
  assert.equal(roland.verified_mode, 'unknown');
  assert.equal(roland.readings, null);
  assert.equal(JSON.parse((await request('POST', rolandPrintToken)).body).duplicate, false);
  assert.equal(JSON.parse((await request('POST', rolandPrintToken)).body).duplicate, true);
});

test('Postgres enforces event roles, provenance, immutable history and correction ordering', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.sc_current_app_role() returns text language sql stable as
      $$ select current_setting('request.jwt.claim.app_role', true) $$;
    grant usage on schema auth to authenticated;
  `);
  await db.exec(read('supabase/migrations/20261114235540_printer_activity.sql'));
  const setRole = async (role, account = 'authenticated') => db.exec(`
    reset role;
    set role ${account};
    set "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';
    set "request.jwt.claim.app_role" = '${role}';
  `);
  const projection = () => db.query("select * from public.sc_printer_activity where printer_id = 'roland'");
  const correction = `insert into public.sc_printer_activity_events (printer_id, kind, occurred_at, detail)
    values ('roland', 'correction', now() - interval '2 days', 'Operator checked production log')`;
  const settings = `insert into public.sc_printer_activity_events
    (printer_id, kind, idle_days, warning_days, planned_mode) values ('roland', 'settings', 6, 2, 'vacation')`;
  const print = (key, time) => `insert into public.sc_printer_activity_events
    (printer_id, kind, source, event_key, actor, occurred_at, detail)
    values ('roland','print','roland_connect','${key}',null,${time},'Job number ${key}')`;
  await setRole('viewer', 'anon');
  await assert.rejects(projection, { code: '42501' });
  await setRole('marketing');
  assert.equal((await projection()).rows.length, 0);
  await setRole('viewer');
  assert.equal((await projection()).rows[0].last_print_at, null);
  await assert.rejects(() => db.exec(correction), { code: '42501' });
  await setRole('operator');
  await assert.rejects(() => db.exec(settings), { code: '42501' });
  await assert.rejects(() => db.exec(print('forgery', 'now()')), { code: '42501' });
  await db.exec(correction);
  assert.equal((await projection()).rows[0].last_print_source, 'staff');
  await assert.rejects(() => db.exec('delete from public.sc_printer_activity_events'), { code: '42501' });
  await setRole('manager');
  await db.exec(settings);
  assert.equal((await projection()).rows[0].planned_mode, 'vacation');
  assert.equal((await projection()).rows[0].hardware_mode, null);

  await setRole('', 'service_role');
  await db.exec(print('old-job', "now() - interval '1 day'"));
  await assert.rejects(() => db.exec(print('old-job', "now() - interval '1 day'")), { code: '23505' });
  assert.equal((await projection()).rows[0].last_print_source, 'staff');
  await db.exec(print('new-job', "now() + interval '1 second'"));
  assert.equal((await projection()).rows[0].last_print_evidence, 'Job number new-job');
  await assert.rejects(() => db.exec(print('too-far', "now() + interval '3 minutes'")), { code: '23514' });
  await assert.rejects(() => db.exec('update public.sc_printer_activity_events set actor = null'), { code: '42501' });
});

test('monitoring surfaces retain the established private remote shortcut and have no printer control actions', () => {
  assert.match(read('src/Home.jsx'), /<PrinterIdleMonitor \/>/);
  assert.match(read('src/EquipmentCenter.jsx'), /<PrinterActivityPanel activity=/);
  assert.match(read('src/RemoteAccessShortcuts.jsx'), /href=\{MAC_DESKTOP\}/);
  assert.doesNotMatch(read('src/components/PrinterIdleMonitor.jsx'), /callService\(|localStorage/);
  const source = read('deployment/home-assistant/packages/skilled_crafting_printer_activity.yaml');
  assert.match(source, /device_verified/);
  assert.match(source, /'kind': 'telemetry'/);
  assert.doesNotMatch(source, /'kind': 'print'|action:.*turn_off/);
});
