import { createClient } from '@supabase/supabase-js';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function clean(value) {
  return String(value || '').trim();
}

function getWooSiteUrl() {
  return clean(
    process.env.WOO_SITE_URL ||
    process.env.WOOCOMMERCE_SITE_URL ||
    process.env.WP_SITE_URL ||
    process.env.WORDPRESS_SITE_URL ||
    'https://skilledcrafting.com'
  ).replace(/\/+$/, '');
}

function getWooAuthHeader() {
  const key = clean(process.env.WC_CONSUMER_KEY || process.env.WOOCOMMERCE_CONSUMER_KEY);
  const secret = clean(process.env.WC_CONSUMER_SECRET || process.env.WOOCOMMERCE_CONSUMER_SECRET);

  if (!key || !secret) {
    throw new Error('Missing WC_CONSUMER_KEY / WC_CONSUMER_SECRET Netlify environment variables.');
  }

  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

function normalizeWooStatus(value) {
  const status = clean(value).toLowerCase().replace(/_/g, '-');
  const allowed = new Set(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed']);
  if (!allowed.has(status)) throw new Error(`Unsupported WooCommerce status: ${value}`);
  return status;
}

function customerNameFromOrder(order) {
  return clean(`${order?.billing?.first_name || ''} ${order?.billing?.last_name || ''}`) || clean(order?.billing?.company) || null;
}

async function syncSupabaseOrderStatus({ order, orderId, jobId = null }) {
  try {
    const { error } = await supabase.rpc('sc_sync_woocommerce_order_status', {
      p_woocommerce_order_id: Number(order?.id || orderId),
      p_woo_status: clean(order?.status) || null,
      p_woo_payment_status: order?.date_paid ? 'paid' : null,
      p_woo_order_number: clean(order?.number) || String(order?.id || orderId),
      p_customer_name: customerNameFromOrder(order),
      p_order_total: Number(order?.total || 0) || null,
      p_woo_date_created: order?.date_created_gmt ? `${order.date_created_gmt}Z` : (order?.date_created || null),
      p_woo_date_modified: order?.date_modified_gmt ? `${order.date_modified_gmt}Z` : (order?.date_modified || null),
      p_payload: order || {},
    });

    if (error) throw error;
    if (jobId) await supabase.rpc('sc_recalculate_order_status', { p_job_id: Number(jobId) });
  } catch (err) {
    console.warn('Supabase order status sync failed:', err.message);
  }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
    if (event.httpMethod === 'GET') {
      return jsonResponse(200, { success: true, message: 'update-woocommerce-order-status active; POST requires employee authentication' }, event);
    }
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { success: false, error: 'Method not allowed' }, event);
    }

    const authorization = await authorizeEmployee(event, {
      functionName: 'update-woocommerce-order-status',
      allowedRoles: ['admin', 'manager'],
    });
    if (!authorization.ok) {
      return jsonResponse(authorization.statusCode, { success: false, error: authorization.message }, event);
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(500, { success: false, error: 'Missing Supabase environment variables.' }, event);
    }

    const body = JSON.parse(event.body || '{}');
    const orderId = Number(body.orderId || body.woocommerce_order_id || body.id);
    const jobId = body.jobId || body.job_id || null;
    const status = normalizeWooStatus(body.status || 'completed');

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return jsonResponse(400, { success: false, error: 'A valid orderId is required.' }, event);
    }

    const endpoint = `${getWooSiteUrl()}/wp-json/wc/v3/orders/${orderId}`;
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { Authorization: getWooAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return jsonResponse(response.status, {
        success: false,
        error: 'WooCommerce order status update failed.',
        details: payload?.message || response.statusText,
      }, event);
    }

    await syncSupabaseOrderStatus({ order: payload, orderId, jobId });
    return jsonResponse(200, {
      success: true,
      order_id: orderId,
      job_id: jobId,
      woo_status: payload?.status || status,
      order: payload,
    }, event);
  } catch (err) {
    console.error('update-woocommerce-order-status error:', err);
    return jsonResponse(500, { success: false, error: 'Server error', details: err.message }, event);
  }
};
