import { createHash } from 'node:crypto';

export function parseJsonBody(event) {
  try { return JSON.parse(event?.body || '{}'); }
  catch { throw new Error('The request body must be valid JSON.'); }
}

export function sha256(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function safePathSegment(value, fallback = 'asset') {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || fallback;
}

function allowedAssetHosts() {
  const hosts = String(process.env.SC_MOCKUP_ALLOWED_ASSET_HOSTS || '')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  for (const envName of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'WOO_SITE_URL']) {
    try { hosts.push(new URL(process.env[envName]).hostname.toLowerCase()); } catch { /* optional */ }
  }
  return new Set(hosts);
}

export function assertSafeExternalAssetUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:') throw new Error('External mockup assets must use HTTPS.');
  if (!allowedAssetHosts().has(url.hostname.toLowerCase())) {
    throw new Error(`External asset host ${url.hostname} is not allowed. Add it to SC_MOCKUP_ALLOWED_ASSET_HOSTS or upload the file directly.`);
  }
  return url.toString();
}

export async function loadMockupAsset(supabase, row) {
  if (row?.storage_bucket && row?.storage_path) {
    const { data, error } = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
    if (error) throw error;
    return { bytes: Buffer.from(await data.arrayBuffer()), mimeType: row.mime_type || data.type || 'image/png', name: row.original_file_name || `${row.id}.png` };
  }
  if (row?.source_url) {
    const url = assertSafeExternalAssetUrl(row.source_url);
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`External asset download failed (HTTP ${response.status}).`);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 52428800) throw new Error('External asset is larger than 50 MB.');
    return { bytes: Buffer.from(await response.arrayBuffer()), mimeType: row.mime_type || response.headers.get('content-type') || 'image/png', name: `${row.id}.png` };
  }
  throw new Error('Mockup asset does not have a stored file or source URL.');
}

export function wooAuthHeader() {
  const key = requiredEnv('WC_CONSUMER_KEY');
  const secret = requiredEnv('WC_CONSUMER_SECRET');
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

export function wooBaseUrl() {
  return requiredEnv('WOO_SITE_URL').replace(/\/$/, '');
}

const WOO_RETRYABLE_CONNECT_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
]);

const WOO_RETRYABLE_GET_STATUSES = new Set([429, 502, 503, 504]);

function connectionCode(error) {
  return String(error?.cause?.code || error?.code || '').trim();
}

function connectionDetail(error) {
  const cause = error?.cause || error;
  const address = cause?.address ? ` ${cause.address}${cause.port ? `:${cause.port}` : ''}` : '';
  return `${connectionCode(error) || 'NETWORK_ERROR'}${address}: ${cause?.message || error?.message || 'Connection failed.'}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function wooRequest(path, { method = 'GET', body } = {}) {
  const requestMethod = String(method || 'GET').toUpperCase();
  const resource = String(path).replace(/^\//, '');
  const url = `${wooBaseUrl()}/wp-json/wc/v3/${resource}`;
  const maximumAttempts = 3;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: requestMethod,
        headers: { Authorization: wooAuthHeader(), 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const code = connectionCode(error);
      const safeConnectionRetry = WOO_RETRYABLE_CONNECT_CODES.has(code);
      const safeReadRetry = requestMethod === 'GET';
      if (attempt < maximumAttempts && (safeConnectionRetry || safeReadRetry)) {
        console.warn(`WooCommerce ${requestMethod} connection attempt ${attempt} failed (${connectionDetail(error)}). Retrying.`);
        await wait(750 * attempt);
        continue;
      }
      throw new Error(`WooCommerce connection failed after ${attempt} attempt${attempt === 1 ? '' : 's'} while requesting ${requestMethod} ${resource} (${connectionDetail(error)}).`, { cause: error });
    }

    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;

    if (requestMethod === 'GET' && attempt < maximumAttempts && WOO_RETRYABLE_GET_STATUSES.has(response.status)) {
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await wait(Math.max(750 * attempt, Math.min(retryAfter * 1000, 5000)));
      continue;
    }
    throw new Error(payload?.message || `WooCommerce request failed (HTTP ${response.status}) while requesting ${requestMethod} ${resource}.`);
  }

  throw new Error(`WooCommerce request did not complete: ${requestMethod} ${resource}.`);
}

export function commaList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function numericIdList(value) {
  return commaList(value).map(Number).filter((id) => Number.isInteger(id) && id > 0);
}
