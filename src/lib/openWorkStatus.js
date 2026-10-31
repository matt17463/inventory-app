// Shared active-work definitions for the calendar, Home and Client Orders.
// A job may be complete even when an older general status has not caught up.
export const TERMINAL_WORK_STATUSES = new Set([
  'completed', 'complete', 'production_complete', 'production_completed',
  'closed', 'done', 'delivered', 'fulfilled', 'shipped', 'received',
  'cancelled', 'canceled', 'voided', 'void', 'refunded', 'failed', 'archived',
]);
export function isTerminalWorkStatus(status) {
  return TERMINAL_WORK_STATUSES.has(String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
}
export function isOpenJob(row = {}) {
  return !row.production_completed_at &&
    ![row.status, row.production_status, row.woo_status].some(isTerminalWorkStatus);
}
export function isOpenClientOrder(row = {}) {
  return ![row.status, row.linked_job_status, row.linked_job_production_status, row.linked_job_woo_status].some(isTerminalWorkStatus) &&
    !row.linked_job_production_completed_at &&
    !Boolean(row.closed_at || row.voided_at || row.cancelled_at);
}
export function isOpenCalendarItem(row = {}, type) {
  if (type === 'job') return isOpenJob(row);
  if (type === 'client') return isOpenClientOrder(row);
  const status = type === 'artwork' ? (row.app_status || row.status) : row.status;
  return !isTerminalWorkStatus(status);
}
