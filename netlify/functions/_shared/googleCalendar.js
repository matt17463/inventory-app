import crypto from 'node:crypto';
import { createServiceClient } from './security.js';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const GOOGLE_AUTH_SCOPE = `openid email ${GOOGLE_CALENDAR_SCOPE}`;
const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const MAX_EVENTS_PER_RUN = 275;

export const CALENDAR_DEFINITIONS = [
  {
    eventKind: 'order_due',
    summary: 'Skilled Crafting — Order Commitments',
    description: 'Customer order and pull-sheet due dates managed by the Skilled Crafting Operations application.',
    backgroundColor: '#0b57d0',
  },
  {
    eventKind: 'purchase_order_expected',
    summary: 'Skilled Crafting — Purchasing',
    description: 'Purchase-order expected arrival dates managed by the Skilled Crafting Operations application.',
    backgroundColor: '#137333',
  },
  {
    eventKind: 'owner_task',
    summary: 'Skilled Crafting — Owner Tasks',
    description: 'High-priority owner tasks managed by the Skilled Crafting Operations application.',
    backgroundColor: '#b06000',
  },
];

function clean(value) {
  return String(value ?? '').trim();
}

function safeError(error) {
  const message = clean(error?.message || error || 'Unknown error');
  return message.slice(0, 1000);
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input) {
  return Buffer.from(input, 'base64url');
}

function appUrl() {
  return clean(process.env.SC_APP_URL || process.env.URL || 'https://inventory.skilledcrafting.com').replace(/\/+$/, '');
}

function oauthConfiguration() {
  const clientId = clean(process.env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecret = clean(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  const redirectUri = clean(
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
      || `${appUrl()}/.netlify/functions/google-calendar-oauth`
  );
  const stateSecret = clean(process.env.GOOGLE_CALENDAR_STATE_SECRET);

  const missing = [];
  if (!clientId) missing.push('GOOGLE_CALENDAR_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CALENDAR_CLIENT_SECRET');
  if (!redirectUri) missing.push('GOOGLE_CALENDAR_REDIRECT_URI');
  if (stateSecret.length < 32) missing.push('GOOGLE_CALENDAR_STATE_SECRET (minimum 32 characters)');
  if (missing.length) throw new Error(`Missing Google Calendar configuration: ${missing.join(', ')}`);

  return { clientId, clientSecret, redirectUri, stateSecret };
}

function encryptionKey() {
  const encoded = clean(process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY);
  if (!encoded) throw new Error('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY is not configured.');

  const candidates = [];
  try { candidates.push(Buffer.from(encoded, 'base64')); } catch { /* use next format */ }
  if (/^[0-9a-f]{64}$/i.test(encoded)) candidates.push(Buffer.from(encoded, 'hex'));
  const key = candidates.find((candidate) => candidate.length === 32);
  if (!key) {
    throw new Error('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64 or hexadecimal 32-byte key.');
  }
  return key;
}

export function encryptCalendarToken(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${base64Url(iv)}.${base64Url(tag)}.${base64Url(encrypted)}`;
}

export function decryptCalendarToken(value) {
  const [version, ivValue, tagValue, encryptedValue] = clean(value).split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('The stored Google Calendar credential is invalid. Reconnect Google Calendar.');
  }
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), fromBase64Url(ivValue));
    decipher.setAuthTag(fromBase64Url(tagValue));
    return Buffer.concat([
      decipher.update(fromBase64Url(encryptedValue)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('The stored Google Calendar credential cannot be decrypted. Reconnect Google Calendar.');
  }
}

export function createCalendarOAuthState({ userId, role }) {
  const { stateSecret } = oauthConfiguration();
  const payload = base64Url(JSON.stringify({
    user_id: clean(userId),
    role: clean(role),
    nonce: crypto.randomBytes(18).toString('hex'),
    expires_at: Date.now() + (10 * 60 * 1000),
  }));
  const signature = crypto.createHmac('sha256', stateSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyCalendarOAuthState(state) {
  const { stateSecret } = oauthConfiguration();
  const [payload, signature] = clean(state).split('.');
  if (!payload || !signature) throw new Error('The Google connection request is invalid or incomplete.');
  const expected = crypto.createHmac('sha256', stateSecret).update(payload).digest();
  const actual = fromBase64Url(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error('The Google connection request failed its security check.');
  }
  const decoded = JSON.parse(fromBase64Url(payload).toString('utf8'));
  if (!decoded.user_id || Number(decoded.expires_at || 0) < Date.now()) {
    throw new Error('The Google connection request has expired. Start the connection again.');
  }
  return decoded;
}

export function buildCalendarAuthorizationUrl({ userId, role }) {
  const { clientId, redirectUri } = oauthConfiguration();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GOOGLE_AUTH_SCOPE,
    state: createCalendarOAuthState({ userId, role }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 1000) }; }
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastResponse = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, options);
    lastResponse = response;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) return response;
    await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
  }
  return lastResponse;
}

export async function exchangeCalendarAuthorizationCode(code) {
  const { clientId, clientSecret, redirectUri } = oauthConfiguration();
  const response = await fetchWithRetry(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: clean(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Google authorization failed: ${clean(payload?.error_description || payload?.error || payload?.message || response.status)}`);
  }
  const grantedScopes = clean(payload.scope);
  if (!grantedScopes.split(/\s+/).includes(GOOGLE_CALENDAR_SCOPE)) {
    throw new Error('Google Calendar permission was not granted. Reconnect and allow the requested calendar access.');
  }
  return payload;
}

async function refreshCalendarAccessToken(refreshToken) {
  const { clientId, clientSecret } = oauthConfiguration();
  const response = await fetchWithRetry(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload?.access_token) {
    const reason = clean(payload?.error_description || payload?.error || payload?.message || response.status);
    throw new Error(`Google Calendar authorization must be renewed: ${reason}`);
  }
  return payload.access_token;
}

async function googleApiRequest(path, { accessToken, method = 'GET', body = null, allowStatuses = [] } = {}) {
  const response = await fetchWithRetry(`${GOOGLE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body == null ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await parseResponse(response);
  if (!response.ok && !allowStatuses.includes(response.status)) {
    const details = clean(payload?.error?.message || payload?.message || response.statusText || response.status);
    const error = new Error(`Google Calendar API error (${response.status}): ${details}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return { status: response.status, data: payload, etag: response.headers.get('etag') || payload?.etag || null };
}

async function googleUserInfo(accessToken) {
  const response = await fetchWithRetry('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(`Unable to identify the connected Google account: ${clean(payload?.error_description || payload?.message || response.status)}`);
  return payload || {};
}

async function createGoogleCalendar(accessToken, definition, timeZone) {
  const created = await googleApiRequest('/calendars', {
    accessToken,
    method: 'POST',
    body: {
      summary: definition.summary,
      description: definition.description,
      timeZone,
    },
  });
  const calendarId = created.data?.id;
  if (!calendarId) throw new Error(`Google did not return an ID for ${definition.summary}.`);

  try {
    await googleApiRequest(`/users/me/calendarList/${encodeURIComponent(calendarId)}?colorRgbFormat=true`, {
      accessToken,
      method: 'PATCH',
      body: {
        backgroundColor: definition.backgroundColor,
        foregroundColor: '#ffffff',
        selected: true,
      },
    });
  } catch (error) {
    console.warn(`Unable to set Google calendar color for ${definition.eventKind}:`, safeError(error));
  }
  return calendarId;
}

export async function ensureCalendarTargets({ supabase, accessToken, timeZone = 'America/Los_Angeles' }) {
  const { data: existingRows, error: existingError } = await supabase
    .from('sc_google_calendar_targets')
    .select('*');
  if (existingError) throw existingError;
  const existing = new Map((existingRows || []).map((row) => [row.event_kind, row]));
  const result = [];

  for (const definition of CALENDAR_DEFINITIONS) {
    let target = existing.get(definition.eventKind) || null;
    let calendarId = clean(target?.google_calendar_id);
    if (calendarId) {
      const check = await googleApiRequest(`/calendars/${encodeURIComponent(calendarId)}`, {
        accessToken,
        allowStatuses: [404],
      });
      if (check.status === 404) calendarId = '';
    }
    if (!calendarId) calendarId = await createGoogleCalendar(accessToken, definition, timeZone);

    const row = {
      event_kind: definition.eventKind,
      connection_key: 'primary',
      calendar_summary: definition.summary,
      google_calendar_id: calendarId,
      background_color: definition.backgroundColor,
      is_active: target?.is_active !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('sc_google_calendar_targets')
      .upsert(row, { onConflict: 'event_kind' })
      .select('*')
      .single();
    if (error) throw error;
    result.push(data);
  }
  return result;
}

export async function connectGoogleCalendar({ authorizationCode, connectedBy }) {
  const supabase = createServiceClient();
  const tokens = await exchangeCalendarAuthorizationCode(authorizationCode);
  const userInfo = await googleUserInfo(tokens.access_token);
  const { data: existing, error: existingError } = await supabase
    .from('sc_google_calendar_connections')
    .select('*')
    .eq('singleton_key', 'primary')
    .maybeSingle();
  if (existingError) throw existingError;

  const encryptedRefreshToken = tokens.refresh_token
    ? encryptCalendarToken(tokens.refresh_token)
    : existing?.refresh_token_encrypted;
  if (!encryptedRefreshToken) throw new Error('Google did not provide an offline refresh token. Reconnect and approve access.');

  const connection = {
    singleton_key: 'primary',
    connected_by: connectedBy || null,
    connected_email: clean(userInfo.email) || null,
    google_subject: clean(userInfo.sub) || null,
    refresh_token_encrypted: encryptedRefreshToken,
    oauth_scope: clean(tokens.scope) || GOOGLE_AUTH_SCOPE,
    status: 'connected',
    connected_at: new Date().toISOString(),
    disconnected_at: null,
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error: saveError } = await supabase
    .from('sc_google_calendar_connections')
    .upsert(connection, { onConflict: 'singleton_key' })
    .select('*')
    .single();
  if (saveError) throw saveError;

  const targets = await ensureCalendarTargets({
    supabase,
    accessToken: tokens.access_token,
    timeZone: saved.time_zone || 'America/Los_Angeles',
  });
  return { connection: saved, targets };
}

async function loadConnection(supabase) {
  const { data, error } = await supabase
    .from('sc_google_calendar_connections')
    .select('*')
    .eq('singleton_key', 'primary')
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'connected' || !data.refresh_token_encrypted) {
    throw new Error('Google Calendar is not connected. Open Google Calendar Integration and connect the owner account.');
  }
  return data;
}

async function fetchAllRows(supabase, relation, columns = '*') {
  const pageSize = 1000;
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from(relation)
      .select(columns)
      .order('id', { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw new Error(`${relation}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function dateOnly(value) {
  const match = clean(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function truncate(value, length = 140) {
  const text = clean(value).replace(/\s+/g, ' ');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function descriptionLines(lines) {
  return lines.filter((line) => clean(line)).join('\n');
}

function managedProperties(kind, sourceId) {
  return {
    private: {
      sc_managed: 'true',
      sc_event_kind: kind,
      sc_source_id: clean(sourceId),
      sc_schema_version: '1',
    },
  };
}

function allDayEvent({ kind, sourceId, summary, description, date, reminders }) {
  return {
    summary: truncate(summary),
    description,
    start: { date },
    end: { date: nextDate(date) },
    transparency: 'transparent',
    visibility: 'private',
    reminders: { useDefault: false, overrides: reminders },
    extendedProperties: managedProperties(kind, sourceId),
  };
}

function timedTaskEvent({ sourceId, summary, description, dueAt, timeZone }) {
  const start = new Date(dueAt);
  const end = new Date(start.getTime() + (30 * 60 * 1000));
  return {
    summary: truncate(summary),
    description,
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    transparency: 'transparent',
    visibility: 'private',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    extendedProperties: managedProperties('owner_task', sourceId),
  };
}

function eventHash(event) {
  return crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
}

function deterministicEventId(kind, sourceId) {
  return `sc${crypto.createHash('sha256').update(`${kind}:${sourceId}`).digest('hex')}`;
}

function sourceKey(kind, sourceId) {
  return `${kind}:${sourceId}`;
}

function activeStatus(value) {
  return !['completed', 'complete', 'cancelled', 'canceled', 'voided', 'deleted', 'refunded', 'received'].includes(clean(value).toLowerCase());
}

async function buildDesiredEvents({ supabase, connection, targets }) {
  const targetMap = new Map(targets.filter((target) => target.is_active).map((target) => [target.event_kind, target]));
  const [jobs, purchaseOrders, tasks] = await Promise.all([
    targetMap.has('order_due') ? fetchAllRows(supabase, 'jobs') : [],
    targetMap.has('purchase_order_expected') ? fetchAllRows(supabase, 'phase1_purchase_orders_with_totals') : [],
    targetMap.has('owner_task') && connection.owner_employee_id ? fetchAllRows(supabase, 'phase5_tasks_detail') : [],
  ]);
  const desired = [];
  const base = appUrl();

  for (const job of jobs) {
    const dueDate = dateOnly(job.due_date);
    if (!dueDate || !activeStatus(job.status)) continue;
    const sourceId = clean(job.id);
    const orderLabel = job.woocommerce_order_id ? `#${job.woocommerce_order_id}` : `Job #${job.id}`;
    const customer = clean(job.customer_name || job.job_name || 'Customer');
    const link = `${base}/pullsheets/${encodeURIComponent(job.id)}`;
    const event = allDayEvent({
      kind: 'order_due',
      sourceId,
      summary: `ORDER DUE • ${orderLabel} • ${customer}`,
      description: descriptionLines([
        `Customer: ${customer}`,
        `Order: ${orderLabel}`,
        `Pull sheet / job: ${job.id}`,
        `Status: ${clean(job.status) || 'Open'}`,
        job.job_name && job.job_name !== customer ? `Job: ${job.job_name}` : '',
        '',
        `Open in Skilled Crafting: ${link}`,
        '',
        'Managed by Skilled Crafting. Change the due date in the application, not in Google Calendar.',
      ]),
      date: dueDate,
      reminders: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 120 }],
    });
    desired.push({
      eventKind: 'order_due', sourceTable: 'jobs', sourceId, target: targetMap.get('order_due'), event,
      hash: eventHash(event), sourceUpdatedAt: job.updated_at || null,
    });
  }

  for (const po of purchaseOrders) {
    const expectedDate = dateOnly(po.expected_at);
    if (!expectedDate || !activeStatus(po.status)) continue;
    const sourceId = clean(po.id || po.purchase_order_id);
    if (!sourceId) continue;
    const poNumber = clean(po.po_number) || `PO ${sourceId}`;
    const supplier = clean(po.supplier_name || po.supplier || 'Supplier');
    const link = `${base}/purchase-orders/${encodeURIComponent(sourceId)}/receive`;
    const event = allDayEvent({
      kind: 'purchase_order_expected',
      sourceId,
      summary: `PO EXPECTED • ${poNumber} • ${supplier}`,
      description: descriptionLines([
        `Purchase order: ${poNumber}`,
        `Supplier: ${supplier}`,
        `Status: ${clean(po.status) || 'Open'}`,
        po.total_units_open != null ? `Open units: ${po.total_units_open}` : '',
        po.total_units_ordered != null ? `Ordered units: ${po.total_units_ordered}` : '',
        '',
        `Open / receive in Skilled Crafting: ${link}`,
        '',
        'Managed by Skilled Crafting. Change the expected date in the application, not in Google Calendar.',
      ]),
      date: expectedDate,
      reminders: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 120 }],
    });
    desired.push({
      eventKind: 'purchase_order_expected', sourceTable: 'phase1_purchase_orders_with_totals', sourceId,
      target: targetMap.get('purchase_order_expected'), event, hash: eventHash(event), sourceUpdatedAt: po.updated_at || null,
    });
  }

  const minimumPriority = Number(connection.owner_task_priority_min ?? 5);
  for (const task of tasks) {
    const sourceId = clean(task.id);
    const dueAt = new Date(task.due_at);
    const ownerMatches = clean(task.assigned_to_employee_id) === clean(connection.owner_employee_id);
    if (!sourceId || !ownerMatches || !Number.isFinite(dueAt.getTime())) continue;
    if (!activeStatus(task.status) || Number(task.priority || 0) < minimumPriority) continue;
    const link = `${base}/employee-tasks`;
    const event = timedTaskEvent({
      sourceId,
      summary: `OWNER TASK • ${clean(task.title) || `Task ${sourceId}`}`,
      description: descriptionLines([
        `Task type: ${clean(task.task_type) || 'General'}`,
        `Priority: ${Number(task.priority || 0)}`,
        `Assigned to: ${clean(task.assigned_to_name) || 'Owner'}`,
        task.job_name ? `Job: ${task.job_name}` : '',
        task.notes ? `Notes: ${task.notes}` : '',
        '',
        `Open tasks in Skilled Crafting: ${link}`,
        '',
        'Managed by Skilled Crafting. Complete or reschedule the task in the application.',
      ]),
      dueAt: task.due_at,
      timeZone: connection.time_zone || 'America/Los_Angeles',
    });
    desired.push({
      eventKind: 'owner_task', sourceTable: 'phase5_tasks_detail', sourceId,
      target: targetMap.get('owner_task'), event, hash: eventHash(event), sourceUpdatedAt: task.updated_at || null,
    });
  }
  return desired;
}

async function upsertGoogleEvent({ accessToken, desired, mapping, force }) {
  const calendarId = desired.target.google_calendar_id;
  const eventId = mapping?.google_event_id || deterministicEventId(desired.eventKind, desired.sourceId);
  if (!force && mapping?.sync_status === 'synced' && mapping?.event_hash === desired.hash && mapping?.google_calendar_id === calendarId) {
    return { action: 'skipped', eventId, etag: mapping.google_etag || null };
  }

  if (mapping?.google_calendar_id && mapping.google_calendar_id !== calendarId) {
    await googleApiRequest(`/calendars/${encodeURIComponent(mapping.google_calendar_id)}/events/${encodeURIComponent(eventId)}`, {
      accessToken,
      method: 'DELETE',
      allowStatuses: [404, 410],
    });
  }

  if (mapping && mapping.google_calendar_id === calendarId) {
    const updated = await googleApiRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      accessToken,
      method: 'PUT',
      body: desired.event,
      allowStatuses: [404, 410],
    });
    if (![404, 410].includes(updated.status)) return { action: 'updated', eventId, etag: updated.etag };
  }

  const inserted = await googleApiRequest(`/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`, {
    accessToken,
    method: 'POST',
    body: { ...desired.event, id: eventId },
    allowStatuses: [409],
  });
  if (inserted.status !== 409) return { action: 'created', eventId, etag: inserted.etag };

  const repaired = await googleApiRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    accessToken,
    method: 'PUT',
    body: desired.event,
  });
  return { action: 'updated', eventId, etag: repaired.etag };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, run));
  return results;
}

async function startSyncRun(supabase, { triggerSource, requestedBy, force }) {
  const staleBefore = new Date(Date.now() - (30 * 60 * 1000)).toISOString();
  await supabase
    .from('sc_google_calendar_sync_runs')
    .update({ status: 'failed', finished_at: new Date().toISOString(), details: { error: 'Stale running sync was closed automatically.' } })
    .eq('status', 'running')
    .lt('started_at', staleBefore);

  const { data, error } = await supabase
    .from('sc_google_calendar_sync_runs')
    .insert({
      trigger_source: triggerSource,
      requested_by: requestedBy || null,
      status: 'running',
      force_rebuild: Boolean(force),
    })
    .select('*')
    .single();
  if (error?.code === '23505') return null;
  if (error) throw error;
  return data;
}

async function finishSyncRun(supabase, runId, summary, status = 'completed') {
  await supabase
    .from('sc_google_calendar_sync_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      desired_events: summary.desired,
      created_events: summary.created,
      updated_events: summary.updated,
      deleted_events: summary.deleted,
      skipped_events: summary.skipped,
      error_count: summary.errors.length,
      details: {
        processed: summary.processed,
        capped: summary.capped,
        errors: summary.errors.slice(0, 25),
      },
    })
    .eq('id', runId);
}

export async function runCalendarSync({ triggerSource = 'manual', requestedBy = null, force = false } = {}) {
  const supabase = createServiceClient();
  const run = await startSyncRun(supabase, { triggerSource, requestedBy, force });
  if (!run) return { status: 'already_running', message: 'Another calendar sync is already running.' };

  const summary = { desired: 0, processed: 0, created: 0, updated: 0, deleted: 0, skipped: 0, capped: false, errors: [] };
  try {
    const connection = await loadConnection(supabase);
    let accessToken;
    try {
      accessToken = await refreshCalendarAccessToken(decryptCalendarToken(connection.refresh_token_encrypted));
    } catch (error) {
      await supabase.from('sc_google_calendar_connections').update({
        status: 'needs_reconnect',
        last_sync_status: 'failed',
        last_sync_error: safeError(error),
        updated_at: new Date().toISOString(),
      }).eq('singleton_key', 'primary');
      throw error;
    }

    const { data: targets, error: targetError } = await supabase
      .from('sc_google_calendar_targets')
      .select('*');
    if (targetError) throw targetError;
    const mappings = await fetchAllRows(supabase, 'sc_google_calendar_event_links');
    const mappingByKey = new Map(mappings.map((item) => [sourceKey(item.event_kind, item.source_id), item]));
    const desiredAll = await buildDesiredEvents({ supabase, connection, targets: targets || [] });
    summary.desired = desiredAll.length;
    summary.capped = desiredAll.length > MAX_EVENTS_PER_RUN;
    const desiredKeys = new Set(desiredAll.map((item) => sourceKey(item.eventKind, item.sourceId)));
    const desired = [...desiredAll]
      .sort((left, right) => {
        const leftMapping = mappingByKey.get(sourceKey(left.eventKind, left.sourceId));
        const rightMapping = mappingByKey.get(sourceKey(right.eventKind, right.sourceId));
        const leftUnchanged = !force && leftMapping?.sync_status === 'synced' && leftMapping?.event_hash === left.hash ? 1 : 0;
        const rightUnchanged = !force && rightMapping?.sync_status === 'synced' && rightMapping?.event_hash === right.hash ? 1 : 0;
        return leftUnchanged - rightUnchanged;
      })
      .slice(0, MAX_EVENTS_PER_RUN);

    const syncResults = await mapWithConcurrency(desired, 4, async (item) => {
      const key = sourceKey(item.eventKind, item.sourceId);
      const mapping = mappingByKey.get(key) || null;
      try {
        const result = await upsertGoogleEvent({ accessToken, desired: item, mapping, force });
        const now = new Date().toISOString();
        const { error } = await supabase.from('sc_google_calendar_event_links').upsert({
          event_kind: item.eventKind,
          source_table: item.sourceTable,
          source_id: item.sourceId,
          google_calendar_id: item.target.google_calendar_id,
          google_event_id: result.eventId,
          event_hash: item.hash,
          google_etag: result.etag,
          source_updated_at: item.sourceUpdatedAt,
          sync_status: 'synced',
          last_synced_at: now,
          last_error: null,
          updated_at: now,
        }, { onConflict: 'event_kind,source_id' });
        if (error) throw error;
        return { action: result.action };
      } catch (error) {
        const message = safeError(error);
        const now = new Date().toISOString();
        await supabase.from('sc_google_calendar_event_links').upsert({
          event_kind: item.eventKind,
          source_table: item.sourceTable,
          source_id: item.sourceId,
          google_calendar_id: item.target.google_calendar_id,
          google_event_id: mapping?.google_event_id || deterministicEventId(item.eventKind, item.sourceId),
          event_hash: item.hash,
          source_updated_at: item.sourceUpdatedAt,
          sync_status: 'error',
          last_error: message,
          updated_at: now,
        }, { onConflict: 'event_kind,source_id' });
        return { action: 'error', error: `${key}: ${message}` };
      }
    });

    for (const result of syncResults) {
      summary.processed += 1;
      if (result.action === 'created') summary.created += 1;
      else if (result.action === 'updated') summary.updated += 1;
      else if (result.action === 'skipped') summary.skipped += 1;
      else if (result.action === 'error') summary.errors.push(result.error);
    }

    const managedKinds = new Set(CALENDAR_DEFINITIONS.map((item) => item.eventKind));
    const staleMappings = mappings.filter((mapping) => (
      managedKinds.has(mapping.event_kind)
      && mapping.sync_status !== 'deleted'
      && !desiredKeys.has(sourceKey(mapping.event_kind, mapping.source_id))
    ));
    const staleResults = await mapWithConcurrency(staleMappings.slice(0, MAX_EVENTS_PER_RUN), 4, async (mapping) => {
      try {
        await googleApiRequest(`/calendars/${encodeURIComponent(mapping.google_calendar_id)}/events/${encodeURIComponent(mapping.google_event_id)}`, {
          accessToken,
          method: 'DELETE',
          allowStatuses: [404, 410],
        });
        const { error } = await supabase.from('sc_google_calendar_event_links').update({
          sync_status: 'deleted',
          last_synced_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        }).eq('id', mapping.id);
        if (error) throw error;
        return { action: 'deleted' };
      } catch (error) {
        return { action: 'error', error: `${sourceKey(mapping.event_kind, mapping.source_id)} delete: ${safeError(error)}` };
      }
    });
    for (const result of staleResults) {
      if (result.action === 'deleted') summary.deleted += 1;
      else summary.errors.push(result.error);
    }
    if (staleMappings.length > MAX_EVENTS_PER_RUN) summary.capped = true;

    const syncStatus = summary.errors.length ? 'completed_with_errors' : 'completed';
    await supabase.from('sc_google_calendar_connections').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: syncStatus,
      last_sync_error: summary.errors.length ? summary.errors[0] : null,
      updated_at: new Date().toISOString(),
    }).eq('singleton_key', 'primary');
    await finishSyncRun(supabase, run.id, summary, syncStatus);
    return { status: syncStatus, ...summary };
  } catch (error) {
    summary.errors.push(safeError(error));
    await finishSyncRun(supabase, run.id, summary, 'failed');
    await supabase.from('sc_google_calendar_connections').update({
      last_sync_status: 'failed',
      last_sync_error: safeError(error),
      updated_at: new Date().toISOString(),
    }).eq('singleton_key', 'primary');
    throw error;
  }
}

export async function disconnectGoogleCalendar() {
  const supabase = createServiceClient();
  const { data: connection, error } = await supabase
    .from('sc_google_calendar_connections')
    .select('*')
    .eq('singleton_key', 'primary')
    .maybeSingle();
  if (error) throw error;
  if (connection?.refresh_token_encrypted) {
    try {
      const token = decryptCalendarToken(connection.refresh_token_encrypted);
      await fetch(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch (revokeError) {
      console.warn('Google token revocation warning:', safeError(revokeError));
    }
  }
  const { error: updateError } = await supabase.from('sc_google_calendar_connections').update({
    status: 'disconnected',
    refresh_token_encrypted: null,
    disconnected_at: new Date().toISOString(),
    last_sync_status: 'disconnected',
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  }).eq('singleton_key', 'primary');
  if (updateError) throw updateError;
  return { success: true };
}

export async function calendarAdminStatus() {
  const supabase = createServiceClient();
  const [connectionResult, targetsResult, runsResult, links, employeesResult] = await Promise.all([
    supabase.from('sc_google_calendar_connections').select('singleton_key, connected_email, status, time_zone, owner_employee_id, owner_task_priority_min, last_sync_at, last_sync_status, last_sync_error, connected_at, disconnected_at, updated_at').eq('singleton_key', 'primary').maybeSingle(),
    supabase.from('sc_google_calendar_targets').select('*').order('calendar_summary'),
    supabase.from('sc_google_calendar_sync_runs').select('*').order('started_at', { ascending: false }).limit(15),
    fetchAllRows(supabase, 'sc_google_calendar_event_links'),
    supabase.from('phase5_employees').select('id, name, role, active').order('name'),
  ]);
  if (connectionResult.error) throw connectionResult.error;
  if (targetsResult.error) throw targetsResult.error;
  if (runsResult.error) throw runsResult.error;
  if (employeesResult.error) throw employeesResult.error;

  const counts = {};
  for (const link of links) {
    const kind = link.event_kind;
    if (!counts[kind]) counts[kind] = { synced: 0, error: 0, deleted: 0, pending: 0 };
    const status = ['synced', 'error', 'deleted', 'pending'].includes(link.sync_status) ? link.sync_status : 'pending';
    counts[kind][status] += 1;
  }
  return {
    installed: true,
    connected: connectionResult.data?.status === 'connected',
    needs_reconnect: connectionResult.data?.status === 'needs_reconnect',
    connection: connectionResult.data || null,
    targets: targetsResult.data || [],
    runs: runsResult.data || [],
    link_counts: counts,
    employees: (employeesResult.data || []).filter((employee) => employee.active !== false),
    automatic_sync_minutes: 15,
  };
}

export async function saveCalendarSettings({ timeZone, ownerEmployeeId, minimumPriority, targetSettings }) {
  const supabase = createServiceClient();
  const normalizedTimeZone = clean(timeZone) || 'America/Los_Angeles';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimeZone }).format(new Date());
  } catch {
    throw new Error(`Invalid business time zone: ${normalizedTimeZone}`);
  }
  const priorityNumber = Number(minimumPriority ?? 5);
  const payload = {
    time_zone: normalizedTimeZone,
    owner_employee_id: clean(ownerEmployeeId) || null,
    owner_task_priority_min: Number.isFinite(priorityNumber) ? Math.max(0, Math.min(100, priorityNumber)) : 5,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('sc_google_calendar_connections')
    .update(payload)
    .eq('singleton_key', 'primary');
  if (error) throw error;

  const settings = targetSettings && typeof targetSettings === 'object' ? targetSettings : {};
  for (const definition of CALENDAR_DEFINITIONS) {
    if (Object.hasOwn(settings, definition.eventKind)) {
      const { error: targetError } = await supabase
        .from('sc_google_calendar_targets')
        .update({ is_active: Boolean(settings[definition.eventKind]), updated_at: new Date().toISOString() })
        .eq('event_kind', definition.eventKind);
      if (targetError) throw targetError;
    }
  }
  return calendarAdminStatus();
}
