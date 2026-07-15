const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const EXPECTED_SECRET =
  process.env.SC_PULLSHEET_SECRET ||
  process.env.MANUAL_PULLSHEET_SECRET ||
  process.env.WC_WEBHOOK_SECRET ||
  process.env.PULLSHEET_SECRET;

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type, x-manual-pullsheet-secret, x-webhook-secret, authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    },
    body: JSON.stringify(payload),
  };
}

function getHeader(headers, name) {
  const lower = name.toLowerCase();
  const found = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === lower);
  return found ? found[1] : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 10);
}

function normalizeOrders(payload) {
  if (Array.isArray(payload?.orders)) {
    return payload.orders
      .map((item) => ({
        order_id: Number(item.order_id || item.woocommerce_order_id || item.id),
        due_date: normalizeDate(item.due_date || item.production_due_date),
      }))
      .filter((item) => item.order_id);
  }

  if (Array.isArray(payload?.order_ids)) {
    return payload.order_ids
      .map((orderId) => ({
        order_id: Number(orderId),
        due_date: normalizeDate(payload.due_date || payload.production_due_date),
      }))
      .filter((item) => item.order_id);
  }

  if (payload?.order_id || payload?.woocommerce_order_id) {
    return [
      {
        order_id: Number(payload.order_id || payload.woocommerce_order_id),
        due_date: normalizeDate(payload.due_date || payload.production_due_date),
      },
    ].filter((item) => item.order_id);
  }

  return [];
}

async function callSupabaseRpc(functionName, body) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === 'string'
        ? data
        : data?.message || data?.details || `Supabase RPC failed with HTTP ${response.status}`
    );
  }

  return data;
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod === 'GET') {
    return json(200, { success: true, message: 'set-pullsheet-due-dates active' });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, {
      success: false,
      message: 'Use POST.',
    });
  }

  const providedSecret =
    getHeader(event.headers, 'x-manual-pullsheet-secret') ||
    getHeader(event.headers, 'x-webhook-secret') ||
    getHeader(event.headers, 'authorization')?.replace(/^Bearer\s+/i, '');

  if (EXPECTED_SECRET && providedSecret !== EXPECTED_SECRET) {
    return json(401, {
      success: false,
      message: 'Invalid pull sheet secret.',
    });
  }

  let payload = {};

  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, {
      success: false,
      message: 'Invalid JSON body.',
    });
  }

  const orders = normalizeOrders(payload);

  if (!orders.length) {
    return json(400, {
      success: false,
      message: 'No orders supplied.',
    });
  }

  const results = [];

  for (const order of orders) {
    try {
      const result = await callSupabaseRpc('sc_set_job_due_date_by_woo_order', {
        p_woocommerce_order_id: order.order_id,
        p_due_date: order.due_date,
        p_source: payload.source || 'woocommerce_due_date_endpoint',
        p_reason: payload.reason || 'Due date set from WooCommerce pull sheet workflow',
        p_changed_by: payload.changed_by || 'woocommerce_admin',
      });

      results.push({
        order_id: order.order_id,
        due_date: order.due_date,
        success: result?.success !== false,
        result,
      });
    } catch (error) {
      results.push({
        order_id: order.order_id,
        due_date: order.due_date,
        success: false,
        message: error.message,
      });
    }
  }

  const updated = results.filter((item) => item.success).length;
  const failed = results.length - updated;

  return json(failed ? 207 : 200, {
    success: failed === 0,
    updated,
    failed,
    results,
  });
};
