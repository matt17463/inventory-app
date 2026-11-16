/* global Netlify */
const LEGACY_HOST = 'inventory.skilledcrafting.com';
const PRIMARY_HOST = 'app.skilledcrafting.com';
const PROTECTED_PATH = /^\/(?:\.|api(?:\/|$)|auth(?:\/|$)|oauth(?:\/|$)|callback(?:\/|$)|reset-password(?:\/|$)|webhooks?(?:\/|$))/i;
const PROTECTED_QUERY = new Set(['access_token','auth_callback','code','error','error_code','error_description','refresh_token','state','token','token_hash','type']);

export const config = { path: '/*' };

export function canonicalNavigation(request, enabled) {
  if (!enabled || request.method !== 'GET' || request.headers.get('sec-fetch-mode') !== 'navigate') return;
  const accept = request.headers.get('accept') || '';
  if (!accept.toLowerCase().includes('text/html')) return;

  const url = new URL(request.url);
  if (url.protocol !== 'https:' || url.hostname !== LEGACY_HOST || url.port) return;
  // The legacy root can receive fragment-based credentials invisible to the edge.
  if (url.pathname === '/' || PROTECTED_PATH.test(url.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) return;
  if (/\.[a-z\d]{1,12}\/?$/i.test(url.pathname)) return;
  if ([...url.searchParams.keys()].some(name => PROTECTED_QUERY.has(name.toLowerCase()))) return;

  url.hostname = PRIMARY_HOST;
  return new Response(null, { status: 308, headers: { location: url.href, 'cache-control': 'no-store' } });
}

export default function handler(request) {
  return canonicalNavigation(request, Netlify.env.get('SC_CANONICAL_APP_NAVIGATION') === 'true');
}
