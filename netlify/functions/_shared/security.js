import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function clean(value) {
  return String(value ?? '').trim();
}

export function getHeader(event, name) {
  const wanted = String(name || '').toLowerCase();
  const match = Object.entries(event?.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return match ? clean(match[1]) : '';
}

export function getBearerToken(event) {
  const authorization = getHeader(event, 'authorization');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? clean(match[1]) : '';
}

export function timingSafeEqualText(left, right) {
  const a = Buffer.from(clean(left));
  const b = Buffer.from(clean(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function resolveConfiguredSecret(names) {
  for (const name of names || []) {
    const value = clean(process.env[name]);
    if (value) return { name, value };
  }
  return { name: '', value: '' };
}

export function validateSharedSecret(event, {
  envNames = [],
  headerNames = [],
  allowBearer = false,
} = {}) {
  const configured = resolveConfiguredSecret(envNames);
  if (!configured.value) {
    return {
      ok: false,
      statusCode: 500,
      code: 'secret_not_configured',
      message: `Required server secret is not configured (${envNames.join(', ')}).`,
    };
  }

  let provided = '';
  for (const headerName of headerNames) {
    provided = getHeader(event, headerName);
    if (provided) break;
  }
  if (!provided && allowBearer) provided = getBearerToken(event);

  if (!provided || !timingSafeEqualText(provided, configured.value)) {
    return {
      ok: false,
      statusCode: 401,
      code: 'invalid_secret',
      message: 'Unauthorized.',
    };
  }

  return { ok: true, secretName: configured.name };
}

export function rawRequestBody(event) {
  if (event?.isBase64Encoded && event?.body) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event?.rawBody || event?.body || '';
}

export function validateWooCommerceSignature(event, secretNames = ['WC_WEBHOOK_SECRET']) {
  const configured = resolveConfiguredSecret(secretNames);
  if (!configured.value) {
    return {
      ok: false,
      statusCode: 500,
      code: 'webhook_secret_not_configured',
      message: 'WooCommerce webhook secret is not configured.',
    };
  }

  const signature = getHeader(event, 'x-wc-webhook-signature');
  if (!signature) {
    return {
      ok: false,
      statusCode: 401,
      code: 'missing_signature',
      message: 'Missing WooCommerce webhook signature.',
    };
  }

  const rawBody = rawRequestBody(event);
  const expected = crypto
    .createHmac('sha256', configured.value)
    .update(rawBody, 'utf8')
    .digest('base64');

  if (!timingSafeEqualText(signature, expected)) {
    return {
      ok: false,
      statusCode: 401,
      code: 'invalid_signature',
      message: 'Invalid WooCommerce webhook signature.',
    };
  }

  return { ok: true, rawBody, secretName: configured.name };
}

export function createServiceClient() {
  const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function auditFunctionSecurity({
  functionName,
  action,
  outcome,
  userId = null,
  role = null,
  event = null,
  metadata = {},
}) {
  try {
    const supabase = createServiceClient();
    await supabase.from('sc_function_security_audit').insert({
      function_name: clean(functionName) || 'unknown',
      action: clean(action) || 'request',
      outcome: clean(outcome) || 'unknown',
      user_id: userId || null,
      app_role: role || null,
      request_id: getHeader(event, 'x-nf-request-id') || getHeader(event, 'x-request-id') || null,
      request_origin: getHeader(event, 'origin') || null,
      metadata: metadata || {},
    });
  } catch (error) {
    console.warn('Security audit logging unavailable:', error?.message || error);
  }
}

export async function authorizeEmployee(event, {
  functionName = 'unknown',
  allowedRoles = ['admin', 'manager'],
} = {}) {
  const accessToken = getBearerToken(event);
  if (!accessToken) {
    await auditFunctionSecurity({ functionName, action: 'authorize', outcome: 'missing_token', event });
    return { ok: false, statusCode: 401, message: 'Employee authentication is required.' };
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error) {
    return { ok: false, statusCode: 500, message: error.message };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userData?.user || null;
  if (userError || !user) {
    await auditFunctionSecurity({ functionName, action: 'authorize', outcome: 'invalid_token', event });
    return { ok: false, statusCode: 401, message: 'Employee authentication is invalid or expired.' };
  }

  const { data: roleRow, error: roleError } = await supabase
    .from('sc_app_user_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError) {
    console.error('Role lookup failed:', roleError);
    return { ok: false, statusCode: 500, message: 'Employee role verification is unavailable.' };
  }

  const role = clean(roleRow?.role).toLowerCase();
  if (!roleRow?.is_active || !role) {
    await auditFunctionSecurity({ functionName, action: 'authorize', outcome: 'inactive_or_missing_role', userId: user.id, event });
    return { ok: false, statusCode: 403, message: 'This employee account is not authorized for privileged functions.' };
  }

  if (allowedRoles.length && !allowedRoles.includes(role)) {
    await auditFunctionSecurity({ functionName, action: 'authorize', outcome: 'role_denied', userId: user.id, role, event, metadata: { allowed_roles: allowedRoles } });
    return { ok: false, statusCode: 403, message: 'Your employee role does not permit this action.' };
  }

  await auditFunctionSecurity({ functionName, action: 'authorize', outcome: 'allowed', userId: user.id, role, event });
  return { ok: true, user, role, supabase };
}

export function corsHeaders(event, additionalHeaders = '') {
  const origin = getHeader(event, 'origin');
  const configured = clean(process.env.SC_ALLOWED_ORIGINS)
    .split(',')
    .map((item) => clean(item))
    .filter(Boolean);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': `Content-Type, Authorization${additionalHeaders ? `, ${additionalHeaders}` : ''}`,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (origin && configured.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function jsonResponse(statusCode, payload, event = null, additionalHeaders = '') {
  return {
    statusCode,
    headers: corsHeaders(event, additionalHeaders),
    body: JSON.stringify(payload),
  };
}
