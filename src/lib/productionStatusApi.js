import { supabase } from '../supabaseClient';
import { authenticatedFunctionFetch } from './netlifyFunctionClient';

function unwrapRpcRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [data];
}

function rpcErrorMessage(error, fallback) {
  return [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' — ') || fallback;
}

function isMissingFunctionError(error) {
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ');

  return error?.code === 'PGRST202'
    || /function .* does not exist|could not find the function/i.test(message);
}

function unwrapStatusResult(data) {
  const result = Array.isArray(data) ? data[0] : data;
  if (result && result.success === false) {
    throw new Error(result.message || result.error || 'The production status was not changed.');
  }
  return result;
}

const JOB_STATUS_BOARD_COLUMNS = {
  ready_to_produce: 'ready_to_produce',
  in_production: 'in_production',
  qc: 'qc',
  ready_to_ship: 'ready_to_ship',
  production_complete: 'completed',
  completed: 'completed',
  on_hold: 'on_hold',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

export function boardColumnForRow(row) {
  const savedStatus = String(row?.saved_job_status || '').trim().toLowerCase();
  return JOB_STATUS_BOARD_COLUMNS[savedStatus] || row?.board_column || 'new_order';
}

export function productionStatusForRow(row) {
  const savedStatus = String(row?.saved_job_status || '').trim().toLowerCase();
  return JOB_STATUS_BOARD_COLUMNS[savedStatus] ? savedStatus : row?.production_status;
}

async function addSavedJobStatuses(rows) {
  const jobIds = [...new Set(rows.map((row) => Number(row.job_id)).filter(Number.isFinite))];
  if (!jobIds.length) return rows;

  const { data, error } = await supabase
    .from('jobs')
    .select('id,status')
    .in('id', jobIds);

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Could not load saved production statuses.'));
  }

  const statusByJob = new Map((data || []).map((job) => [String(job.id), job.status]));
  return rows.map((row) => ({
    ...row,
    saved_job_status: statusByJob.get(String(row.job_id)) || null,
  }));
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
  let { data, error } = await supabase.rpc('sc_list_order_status_board_v2', {
    p_status: status || null,
    p_search: search || null,
    p_limit: Number(limit || 250),
  });

  // During a rolling deployment, keep the prior board readable until the
  // v0.8.3 active-line SQL has been installed.
  if (error && isMissingFunctionError(error)) {
    const fallback = await supabase.rpc('sc_list_order_status_board', {
      p_status: null,
      p_search: search || null,
      p_limit: Number(limit || 250),
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  const rows = await addSavedJobStatuses(unwrapRpcRows(data));
  return status ? rows.filter((row) => boardColumnForRow(row) === status) : rows;
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
  const numericJobId = Number(jobId);
  if (!Number.isFinite(numericJobId) || numericJobId <= 0) {
    throw new Error('A valid production job is required before its status can be changed.');
  }
  if (!MANUAL_PRODUCTION_STATUSES.some((option) => option.value === status)) {
    throw new Error(`Unsupported production status: ${status || 'blank'}`);
  }

  let { data, error } = await supabase.rpc('sc_set_production_board_status', {
    p_job_id: numericJobId,
    p_status: status,
    p_note: note || null,
  });

  // Some older installs predate the reconciled Production Board RPC. Their
  // Phase 2 status RPC writes the same jobs.status field and is a safe fallback.
  if (error && isMissingFunctionError(error)) {
    const fallback = await supabase.rpc('phase2_update_job_status', {
      p_job_id: numericJobId,
      p_status: status,
      p_notes: note || null,
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(rpcErrorMessage(error, 'Could not update production status.'));
  }

  return unwrapStatusResult(data);
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
