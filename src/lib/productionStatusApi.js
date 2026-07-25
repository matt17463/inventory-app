import { supabase } from '../supabaseClient';
import { authenticatedFunctionFetch } from './netlifyFunctionClient';

function unwrapRpcRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

export const PRODUCTION_BOARD_COLUMNS = [
  { key: 'new_order', label: 'New Orders', tone: 'neutral' },
  { key: 'needs_attention', label: 'Needs Attention', tone: 'danger' },
  { key: 'on_hold', label: 'On Hold', tone: 'warning' },
  { key: 'ready_to_produce', label: 'Ready to Produce', tone: 'info' },
  { key: 'in_production', label: 'In Production', tone: 'primary' },
  { key: 'qc', label: 'QC', tone: 'warning' },
  { key: 'ready_to_ship', label: 'Ready to Ship', tone: 'success' },
  { key: 'completed', label: 'Completed', tone: 'success' },
  { key: 'cancelled', label: 'Cancelled', tone: 'danger' },
];

export const MANUAL_PRODUCTION_STATUSES = [
  { value: 'ready_to_produce', label: 'Ready to Produce' },
  { value: 'in_production', label: 'In Production' },
  { value: 'qc', label: 'QC' },
  { value: 'ready_to_ship', label: 'Ready to Ship / Pickup' },
  { value: 'production_complete', label: 'Production Complete' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled / Do Not Produce' },
];

export async function listProductionStatusBoard({ status = '', search = '', limit = 250 } = {}) {
  const { data, error } = await supabase.rpc('sc_list_order_status_board', {
    p_status: status || null,
    p_search: search || null,
    p_limit: Number(limit || 250),
  });

  if (error) throw error;
  return unwrapRpcRows(data);
}

export async function refreshProductionStatusBoard(limit = 500) {
  const { data, error } = await supabase.rpc('sc_refresh_order_status_board', {
    p_limit: Number(limit || 500),
  });

  if (error) throw error;
  return data;
}

export async function recalculateProductionStatus(jobId) {
  const { data, error } = await supabase.rpc('sc_recalculate_order_status', {
    p_job_id: Number(jobId),
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updateProductionBoardStatus({ jobId, status, note = '' }) {
  const { data, error } = await supabase.rpc('sc_set_production_board_status', {
    p_job_id: Number(jobId),
    p_status: status,
    p_note: note || null,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function updateWooCommerceOrderStatus({ orderId, status, jobId = null, note = '' }) {
  const response = await authenticatedFunctionFetch('/.netlify/functions/update-woocommerce-order-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, status, jobId, note }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    const message = payload?.details || payload?.error || `WooCommerce update failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}
