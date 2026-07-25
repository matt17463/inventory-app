import { createClient } from '@supabase/supabase-js';
import {
  auditFunctionSecurity,
  authorizeEmployee,
  getHeader,
  jsonResponse,
} from './_shared/security.js';

const DEFAULT_ALLOWED_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
];

function clean(value) {
  return String(value ?? '').trim();
}

function getServiceClient() {
  const url = clean(process.env.SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function getWooSiteUrl() {
  return clean(
    process.env.WOO_SITE_URL
      || process.env.WOOCOMMERCE_SITE_URL
      || process.env.WP_SITE_URL
      || process.env.WORDPRESS_SITE_URL
      || 'https://skilledcrafting.com'
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

function allowedWooStatuses() {
  const configured = clean(process.env.WC_STATUS_ALLOWED_STATUSES)
    .split(',')
    .map((value) => clean(value).toLowerCase().replace(/_/g, '-'))
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_STATUSES);
}

function normalizeWooStatus(value) {
  const status = clean(value).toLowerCase().replace(/_/g, '-');
  if (!allowedWooStatuses().has(status)) {
    const error = new Error(`Unsupported WooCommerce status: ${value}`);
    error.statusCode = 400;
    throw error;
  }
  return status;
}

function customerNameFromOrder(order) {
  return clean(`${order?.billing?.first_name || ''} ${order?.billing?.last_name || ''}`)
    || clean(order?.billing?.company)
    || null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`WooCommerce request timed out after ${timeoutMs} ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function auditStatusChange(supabase, values) {
  try {
    const { error } = await supabase.from('sc_woocommerce_status_change_audit').insert(values);
    if (error) console.warn('Woo status audit insert failed:', error.message);
  } catch (error) {
    console.warn('Woo status audit unavailable:', error?.message || error);
  }
}

async function syncSupabaseOrderStatus(supabase, { order, orderId, jobId = null }) {
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
  } catch (error) {
    console.warn('Supabase order status sync failed:', error.message);
  }
}

export const handler = async (event) => {
  let authorization = null;
  let auditBase = null;
  let supabase = null;

  try {
    if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
    if (event.httpMethod === 'GET') {
      return jsonResponse(200, {
        success: true,
        message: 'update-woocommerce-order-status active; POST requires admin or manager authentication',
        allowed_statuses: [...allowedWooStatuses()],
      }, event);
    }
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { success: false, error: 'Method not allowed' }, event);
    }

    authorization = await authorizeEmployee(event, {
      functionName: 'update-woocommerce-order-status',
      allowedRoles: ['admin', 'manager'],
    });
    if (!authorization.ok) {
      return jsonResponse(authorization.statusCode, { success: false, error: authorization.message }, event);
    }

    supabase = getServiceClient();
    const body = JSON.parse(event.body || '{}');
    const orderId = Number(body.orderId || body.woocommerce_order_id || body.id);
    const jobId = body.jobId || body.job_id || null;
    const status = normalizeWooStatus(body.status || 'completed');
    const note = clean(body.note).slice(0, 2000) || null;
    const requestId = getHeader(event, 'x-nf-request-id') || getHeader(event, 'x-request-id') || null;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return jsonResponse(400, { success: false, error: 'A valid orderId is required.' }, event);
    }

    auditBase = {
      employee_user_id: authorization.user.id,
      employee_role: authorization.role,
      woocommerce_order_id: orderId,
      job_id: jobId ? Number(jobId) : null,
      requested_status: status,
      note,
      request_id: requestId,
      metadata: { source: 'inventory_app' },
    };

    const endpoint = `${getWooSiteUrl()}/wp-json/wc/v3/orders/${orderId}`;
    const authHeader = getWooAuthHeader();
    const currentResponse = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    const currentOrder = await readJson(currentResponse);

    if (!currentResponse.ok) {
      await auditStatusChange(supabase, {
        ...auditBase,
        previous_status: null,
        outcome: 'failed',
        woo_http_status: currentResponse.status,
        error_message: clean(currentOrder?.message || currentResponse.statusText),
      });
      return jsonResponse(currentResponse.status, {
        success: false,
        error: 'Unable to read the current WooCommerce order status.',
        details: currentOrder?.message || currentResponse.statusText,
      }, event);
    }

    const previousStatus = clean(currentOrder?.status).toLowerCase();
    if (previousStatus === status) {
      await syncSupabaseOrderStatus(supabase, { order: currentOrder, orderId, jobId });
      await auditStatusChange(supabase, {
        ...auditBase,
        previous_status: previousStatus,
        resulting_status: previousStatus,
        outcome: 'no_change',
        woo_http_status: 200,
      });
      return jsonResponse(200, {
        success: true,
        changed: false,
        order_id: orderId,
        job_id: jobId,
        previous_status: previousStatus,
        woo_status: previousStatus,
        message: 'WooCommerce order already has the requested status.',
      }, event);
    }

    await auditStatusChange(supabase, {
      ...auditBase,
      previous_status: previousStatus,
      outcome: 'attempted',
    });

    const updateResponse = await fetchWithTimeout(endpoint, {
      method: 'PUT',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const updatedOrder = await readJson(updateResponse);

    if (!updateResponse.ok) {
      await auditStatusChange(supabase, {
        ...auditBase,
        previous_status: previousStatus,
        resulting_status: clean(updatedOrder?.status) || null,
        outcome: 'failed',
        woo_http_status: updateResponse.status,
        error_message: clean(updatedOrder?.message || updateResponse.statusText),
      });
      return jsonResponse(updateResponse.status, {
        success: false,
        error: 'WooCommerce order status update failed.',
        details: updatedOrder?.message || updateResponse.statusText,
      }, event);
    }

    await syncSupabaseOrderStatus(supabase, { order: updatedOrder, orderId, jobId });
    await auditStatusChange(supabase, {
      ...auditBase,
      previous_status: previousStatus,
      resulting_status: clean(updatedOrder?.status) || status,
      outcome: 'succeeded',
      woo_http_status: updateResponse.status,
    });
    await auditFunctionSecurity({
      functionName: 'update-woocommerce-order-status',
      action: 'status_change',
      outcome: 'succeeded',
      userId: authorization.user.id,
      role: authorization.role,
      event,
      metadata: { order_id: orderId, previous_status: previousStatus, new_status: status },
    });

    return jsonResponse(200, {
      success: true,
      changed: true,
      order_id: orderId,
      job_id: jobId,
      previous_status: previousStatus,
      woo_status: updatedOrder?.status || status,
      order: updatedOrder,
    }, event);
  } catch (error) {
    console.error('update-woocommerce-order-status error:', error);
    if (supabase && auditBase) {
      await auditStatusChange(supabase, {
        ...auditBase,
        outcome: 'failed',
        error_message: clean(error?.message || error),
      });
    }
    return jsonResponse(error?.statusCode || 500, {
      success: false,
      error: error?.statusCode === 400 ? error.message : 'Server error',
      details: error?.statusCode === 400 ? undefined : error.message,
    }, event);
  }
};
