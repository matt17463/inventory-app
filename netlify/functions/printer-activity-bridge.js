import { createHash } from 'node:crypto';
import { createServiceClient } from './_shared/security.js';
import { METRICS, PRINTER_MODES, printerStatus } from '../../src/lib/printerActivity.js';

const SOURCES = { roland: 'roland_connect', omni: 'omni_studio' };
const EVENT_KEY = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/;
const ISO_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
const response = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

function validMetric(printer, name, value) {
  if (!Object.hasOwn(METRICS[printer], name)) return false;
  const [, unit, min, max] = METRICS[printer][name];
  if (min instanceof RegExp) return typeof value === 'string' && min.test(value);
  if (Array.isArray(min)) return min.includes(value);
  if (min === undefined) return typeof value === 'boolean';
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    && (unit !== '' || Number.isInteger(value));
}

export function normalizePrinterEvent(input, now = Date.now()) {
  if (!input || !Object.hasOwn(SOURCES, input.printer_id)) return null;
  const { printer_id, occurred_at, event_key, kind, observed_mode, readings } = input;
  const detail = typeof input.detail === 'string' ? input.detail.trim() : '';
  const timestamp = Date.parse(occurred_at);
  if (typeof event_key !== 'string' || !EVENT_KEY.test(event_key) || !ISO_TIME.test(occurred_at)
    || !Number.isFinite(timestamp) || timestamp > now + 60000) return null;

  const event = {
    printer_id, occurred_at: new Date(timestamp).toISOString(), event_key, kind,
    actor: null, source: SOURCES[printer_id],
  };
  if (kind === 'print') {
    if (printer_id === 'omni' || input.job_type !== 'production_print' || input.outcome !== 'completed'
      || !detail || detail.length > 200 || readings !== undefined || observed_mode !== undefined) return null;
    return { ...event, detail };
  }
  if (kind !== 'telemetry' || !readings || typeof readings !== 'object' || Array.isArray(readings)
    || (observed_mode !== undefined && !PRINTER_MODES.includes(observed_mode))) return null;

  const entries = Object.entries(readings);
  // Match the database's JSON size bound, reserving space for JSONB formatting.
  if (Buffer.byteLength(JSON.stringify(readings)) + entries.length * 2 > 2048) return null;
  if ((!entries.length && !observed_mode) || !entries.every(([name, value]) => validMetric(printer_id, name, value))) return null;
  return { ...event, readings, observed_mode: observed_mode ?? null };
}

export function makeHandler({ connect = createServiceClient } = {}) {
  return async (event) => {
    const method = event.httpMethod;
    if (method !== 'GET' && method !== 'POST') return response(405, { error: 'Method unavailable.' });

    const auth = event.headers?.authorization || event.headers?.Authorization || '';
    const token = /^Bearer ([0-9a-f]{64})$/.exec(auth)?.[1];
    if (!token) return response(401, { error: 'Unauthorized.' });

    try {
      const db = connect();
      const digest = createHash('sha256').update(token).digest('hex');
      const credential = await db.from('sc_printer_bridge_credentials').select('scope').eq('token_sha256', digest).maybeSingle();
      if (credential.error) return response(503, { error: 'Printer activity unavailable.' });
      const scope = credential.data?.scope;
      if (!scope || (method === 'GET') !== (scope === 'ha_read')) return response(401, { error: 'Unauthorized.' });

      if (method === 'GET') {
        const { data, error } = await db.from('sc_printer_activity').select('*');
        if (error || data.length !== 2) return response(503, { error: 'Printer activity unavailable.' });
        const now = Date.now();
        const printers = Object.fromEntries(data.map((row) => {
          const status = printerStatus(row, now);
          return [row.printer_id, { ...row, ...status, readings: status.telemetry === 'fresh' ? row.readings : null }];
        }));
        return response(200, { checked_at: new Date(now).toISOString(), ...printers });
      }

      if (event.isBase64Encoded || typeof event.body !== 'string' || Buffer.byteLength(event.body) > 4096) {
        return response(400, { error: 'Invalid event body.' });
      }
      let input;
      try { input = JSON.parse(event.body); } catch { return response(400, { error: 'Invalid event body.' }); }
      const record = normalizePrinterEvent(input);
      if (!record) return response(422, { error: 'Invalid printer event.' });
      const requiredScope = record.printer_id === 'omni' ? 'omni_events'
        : record.kind === 'print' ? 'roland_print' : 'roland_health';
      if (scope !== requiredScope) return response(403, { error: 'Wrong source authorization.' });

      const { error } = await db.from('sc_printer_activity_events').insert(record);
      if (error && error.code !== '23505') return response(503, { error: 'Could not record the event.' });
      return response(200, { accepted: true, duplicate: error?.code === '23505' });
    } catch {
      return response(503, { error: 'Printer activity unavailable.' });
    }
  };
}

export const handler = makeHandler();
