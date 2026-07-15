// src/lib/dueDateApi.js

import { supabase } from './supabaseClient';

function normalizeDateInput(value) {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function requireNoSupabaseError(response, fallbackMessage) {
  if (response.error) {
    const details = response.error.message || response.error.details || response.error.hint;
    throw new Error(details || fallbackMessage);
  }
  return response.data;
}

export async function listPullSheetDueDates({ search = '', limit = 100 } = {}) {
  const response = await supabase.rpc('sc_list_pullsheet_due_dates', {
    p_search: search || null,
    p_limit: limit,
  });

  return requireNoSupabaseError(response, 'Unable to load pull sheet due dates') || [];
}

export async function setJobDueDate({
  jobId,
  dueDate,
  source = 'inventory_app',
  reason = '',
  changedBy = 'inventory_app',
}) {
  if (!jobId) {
    throw new Error('Missing job ID');
  }

  const response = await supabase.rpc('sc_set_job_due_date', {
    p_job_id: Number(jobId),
    p_due_date: normalizeDateInput(dueDate),
    p_source: source,
    p_reason: reason || null,
    p_changed_by: changedBy,
  });

  const data = requireNoSupabaseError(response, 'Unable to update due date');
  if (data && data.success === false) {
    throw new Error(data.message || 'Unable to update due date');
  }
  return data;
}

export async function setJobDueDateByWooOrder({
  woocommerceOrderId,
  dueDate,
  source = 'inventory_app',
  reason = '',
  changedBy = 'inventory_app',
}) {
  if (!woocommerceOrderId) {
    throw new Error('Missing WooCommerce order ID');
  }

  const response = await supabase.rpc('sc_set_job_due_date_by_woo_order', {
    p_woocommerce_order_id: Number(woocommerceOrderId),
    p_due_date: normalizeDateInput(dueDate),
    p_source: source,
    p_reason: reason || null,
    p_changed_by: changedBy,
  });

  const data = requireNoSupabaseError(response, 'Unable to update due date');
  if (data && data.success === false) {
    throw new Error(data.message || 'Unable to update due date');
  }
  return data;
}

export async function bulkSetJobDueDates({
  jobIds,
  dueDate,
  source = 'inventory_app_bulk',
  reason = '',
  changedBy = 'inventory_app',
}) {
  const ids = Array.isArray(jobIds) ? jobIds.map(Number).filter(Boolean) : [];
  if (!ids.length) {
    throw new Error('Select at least one pull sheet');
  }

  const response = await supabase.rpc('sc_bulk_set_job_due_dates', {
    p_job_ids: ids,
    p_due_date: normalizeDateInput(dueDate),
    p_source: source,
    p_reason: reason || null,
    p_changed_by: changedBy,
  });

  const data = requireNoSupabaseError(response, 'Unable to bulk update due dates');
  if (data && data.success === false && Number(data.updated || 0) === 0) {
    throw new Error(data.message || 'No due dates were updated');
  }
  return data;
}

export async function bulkSetDueDatesByWooOrders({
  woocommerceOrderIds,
  dueDate,
  source = 'woocommerce_bulk',
  reason = '',
  changedBy = 'inventory_app',
}) {
  const ids = Array.isArray(woocommerceOrderIds)
    ? woocommerceOrderIds.map(Number).filter(Boolean)
    : [];

  if (!ids.length) {
    throw new Error('Select at least one WooCommerce order');
  }

  const response = await supabase.rpc('sc_bulk_set_due_dates_by_woo_orders', {
    p_woocommerce_order_ids: ids,
    p_due_date: normalizeDateInput(dueDate),
    p_source: source,
    p_reason: reason || null,
    p_changed_by: changedBy,
  });

  const data = requireNoSupabaseError(response, 'Unable to bulk update WooCommerce order due dates');
  if (data && data.success === false && Number(data.updated || 0) === 0) {
    throw new Error(data.message || 'No due dates were updated');
  }
  return data;
}
