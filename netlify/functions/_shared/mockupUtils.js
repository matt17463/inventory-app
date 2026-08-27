import { createHash } from 'node:crypto';
import { loadStoredAsset } from './mockupStorage.js';

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

export async function fetchSafeExternalAsset(value, { timeoutMs = 30000, maxBytes = 52428800 } = {}) {
  let currentUrl = assertSafeExternalAssetUrl(value);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf;q=0.9,*/*;q=0.1' },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('External asset redirect did not include a destination.');
      if (redirectCount === 3) throw new Error('External asset exceeded the redirect limit.');
      currentUrl = assertSafeExternalAssetUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) throw new Error(`External asset download failed (HTTP ${response.status}).`);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxBytes) throw new Error('External asset is larger than 50 MB.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('External asset was empty.');
    if (bytes.length > maxBytes) throw new Error('External asset is larger than 50 MB.');
    let name = 'external-artwork';
    try { name = decodeURIComponent(new URL(currentUrl).pathname.split('/').filter(Boolean).pop() || name); } catch { /* already validated */ }
    return {
      bytes,
      mimeType: String(response.headers.get('content-type') || 'application/octet-stream').split(';')[0].toLowerCase(),
      name,
      finalUrl: currentUrl,
    };
  }
  throw new Error('External asset could not be downloaded.');
}

export async function loadMockupAsset(supabase, row) {
  if (row?.storage_bucket && row?.storage_path) {
    return loadStoredAsset(supabase, row);
  }
  if (row?.source_url) {
    const downloaded = await fetchSafeExternalAsset(row.source_url);
    return {
      bytes: downloaded.bytes,
      mimeType: row.mime_type || downloaded.mimeType || 'image/png',
      name: downloaded.name || `${row.id}.png`,
    };
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

function safeResponseSample(value) {
  return [...String(value || '')]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export async function wooRequest(path, { method = 'GET', body } = {}) {
  const requestMethod = String(method || 'GET').toUpperCase();
  const resource = String(path).replace(/^\//, '');
  const url = `${wooBaseUrl()}/wp-json/wc/v3/${resource}`;
  const maximumAttempts = 3;
  const timeoutMilliseconds = requestMethod === 'GET' ? 60000 : 180000;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: requestMethod,
        headers: {
          Authorization: wooAuthHeader(),
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache',
          'User-Agent': 'SkilledCrafting-MockupStudio/1.0.9',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMilliseconds),
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

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const responseText = await response.text();
    let payload = null;
    try { payload = responseText ? JSON.parse(responseText) : null; } catch { /* handled below with diagnostics */ }

    if (response.ok && payload !== null) return payload;

    if (response.ok) {
      const requestId = response.headers.get('x-request-id') || response.headers.get('x-wp-request-id') || response.headers.get('x-nf-request-id') || '';
      const sample = safeResponseSample(responseText);
      const diagnostic = [
        `HTTP ${response.status}`,
        `content-type ${contentType || 'missing'}`,
        requestId ? `request ${requestId}` : '',
        sample ? `body ${JSON.stringify(sample)}` : 'empty body',
      ].filter(Boolean).join('; ');
      if (requestMethod === 'GET' && attempt < maximumAttempts) {
        console.warn(`WooCommerce ${requestMethod} returned invalid JSON on attempt ${attempt} (${diagnostic}). Retrying sequentially.`);
        await wait(750 * attempt);
        continue;
      }
      throw new Error(`WooCommerce returned HTTP success with an invalid JSON response while requesting ${requestMethod} ${resource} (${diagnostic}). Check WordPress security/WAF logs and exclude /wp-json/wc/v3/ from response transformations.`);
    }

    if (requestMethod === 'GET' && attempt < maximumAttempts && WOO_RETRYABLE_GET_STATUSES.has(response.status)) {
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await wait(Math.max(750 * attempt, Math.min(retryAfter * 1000, 5000)));
      continue;
    }
    const fallback = safeResponseSample(responseText);
    throw new Error(payload?.message || `WooCommerce request failed (HTTP ${response.status}) while requesting ${requestMethod} ${resource}${fallback ? `: ${fallback}` : '.'}`);
  }

  throw new Error(`WooCommerce request did not complete: ${requestMethod} ${resource}.`);
}

export function wooCollection(payload, label = 'collection') {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['data', 'items', 'results']) {
      if (payload[key] !== undefined) return wooCollection(payload[key], label);
    }
    const entries = Object.entries(payload);
    if (entries.length && entries.every(([key]) => /^\d+$/.test(key))) {
      return entries.sort(([left], [right]) => Number(left) - Number(right)).map(([, value]) => value);
    }
    const keys = Object.keys(payload).slice(0, 5).join(', ');
    throw new Error(`WooCommerce returned an unexpected response while loading ${label}${keys ? ` (fields: ${keys})` : ''}. Exclude /wp-json/wc/v3/ from WordPress caching and security response transformations.`);
  }
  throw new Error(`WooCommerce returned an empty or invalid response while loading ${label}.`);
}

export function commaList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function numericIdList(value) {
  return commaList(value).map(Number).filter((id) => Number.isInteger(id) && id > 0);
}
