import { authorizeEmployee, createServiceClient, jsonResponse } from './_shared/security.js';

function clean(value) {
  return String(value ?? '').trim();
}

function envCheck(name, aliases = []) {
  const candidates = [name, ...aliases];
  const configuredAs = candidates.find((key) => clean(process.env[key]));
  return {
    category: 'environment',
    check_name: name,
    status: configuredAs ? 'PASS' : 'FAIL',
    detail: configuredAs ? `Configured as ${configuredAs}` : `Missing (${candidates.join(' or ')})`,
  };
}

function wooSiteUrl() {
  return clean(
    process.env.WOO_SITE_URL
      || process.env.WOOCOMMERCE_SITE_URL
      || process.env.WP_SITE_URL
      || process.env.WORDPRESS_SITE_URL
      || 'https://skilledcrafting.com'
  ).replace(/\/+$/, '');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function wooCommerceCheck() {
  const key = clean(process.env.WC_CONSUMER_KEY || process.env.WOOCOMMERCE_CONSUMER_KEY);
  const secret = clean(process.env.WC_CONSUMER_SECRET || process.env.WOOCOMMERCE_CONSUMER_SECRET);
  if (!key || !secret) {
    return { category: 'external_service', check_name: 'woocommerce_api', status: 'FAIL', detail: 'WooCommerce credentials are missing.' };
  }

  try {
    const response = await fetchWithTimeout(`${wooSiteUrl()}/wp-json/wc/v3/orders?per_page=1&_fields=id,status`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
        Accept: 'application/json',
      },
    });
    return {
      category: 'external_service',
      check_name: 'woocommerce_api',
      status: response.ok ? 'PASS' : 'FAIL',
      detail: response.ok ? `Connected (HTTP ${response.status})` : `Connection failed (HTTP ${response.status})`,
    };
  } catch (error) {
    return { category: 'external_service', check_name: 'woocommerce_api', status: 'FAIL', detail: error.message };
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return jsonResponse(405, { success: false, error: 'Use GET or POST.' }, event);
  }

  const authorization = await authorizeEmployee(event, {
    functionName: 'deployment-health',
    allowedRoles: ['admin', 'manager'],
  });
  if (!authorization.ok) {
    return jsonResponse(authorization.statusCode, { success: false, error: authorization.message }, event);
  }

  try {
    const supabase = createServiceClient();
    const checks = [
      envCheck('SUPABASE_URL', ['VITE_SUPABASE_URL']),
      envCheck('SUPABASE_SERVICE_ROLE_KEY', ['SUPABASE_SERVICE_KEY']),
      envCheck('WC_CONSUMER_KEY', ['WOOCOMMERCE_CONSUMER_KEY']),
      envCheck('WC_CONSUMER_SECRET', ['WOOCOMMERCE_CONSUMER_SECRET']),
      envCheck('WC_WEBHOOK_SECRET'),
      envCheck('MANUAL_PULLSHEET_SECRET', ['SC_PULLSHEET_SECRET']),
      envCheck('SC_ARTWORK_WEBHOOK_SECRET'),
      envCheck('SC_ALLOWED_ORIGINS'),
    ];

    const { data: databaseChecks, error: databaseError } = await supabase.rpc('sc_deployment_health_v1');
    if (databaseError) {
      checks.push({ category: 'database', check_name: 'sc_deployment_health_v1', status: 'FAIL', detail: databaseError.message });
    } else {
      checks.push(...(databaseChecks || []));
    }

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      checks.push({ category: 'storage', check_name: 'storage_buckets', status: 'FAIL', detail: bucketError.message });
    } else {
      const names = new Set((buckets || []).map((bucket) => bucket.name));
      for (const name of ['supplier-sync-cache']) {
        checks.push({
          category: 'storage',
          check_name: name,
          status: names.has(name) ? 'PASS' : 'FAIL',
          detail: names.has(name) ? 'Private bucket is available.' : 'Bucket is missing.',
        });
      }
    }

    const deep = String(event.queryStringParameters?.deep || '').toLowerCase() === 'true';
    if (deep) checks.push(await wooCommerceCheck());

    checks.push({
      category: 'deployment',
      check_name: 'build',
      status: 'PASS',
      detail: process.env.COMMIT_REF || process.env.DEPLOY_ID || process.env.CONTEXT || 'Local/unknown build identifier',
    });

    const failed = checks.filter((check) => String(check.status).toUpperCase() === 'FAIL').length;
    const warnings = checks.filter((check) => ['WARN', 'WARNING', 'REVIEW'].includes(String(check.status).toUpperCase())).length;

    return jsonResponse(failed ? 503 : 200, {
      success: failed === 0,
      checked_at: new Date().toISOString(),
      checked_by: authorization.user.email || authorization.user.id,
      deep,
      summary: { total: checks.length, passed: checks.length - failed - warnings, warnings, failed },
      checks,
    }, event);
  } catch (error) {
    console.error('deployment-health error:', error);
    return jsonResponse(500, { success: false, error: 'Deployment health check failed.', details: error.message }, event);
  }
};
