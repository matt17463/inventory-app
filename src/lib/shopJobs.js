const terminal = new Set(['completed', 'complete', 'production_complete', 'closed', 'cancelled', 'canceled', 'refunded', 'failed', 'archived', 'done', 'voided']);
export function isOpenShopJob(job) {
  return !['saved_job_status', 'production_status', 'board_column', 'pullsheet_status', 'job_status', 'woo_status', 'woocommerce_status'].some((key) => terminal.has(String(job[key] || '').trim().toLowerCase().replace(/^wc-/, '')));
}
export function shopMetrics(jobs) {
  const count = (predicate) => jobs.filter(predicate).length;
  return {
    total_open: jobs.length,
    overdue: count((j) => j.due_date_bucket === 'overdue'),
    due_today: count((j) => j.due_date_bucket === 'due_today'),
    no_due_date: count((j) => !j.due_date),
    needs_attention: count((j) => j.status_bucket === 'needs_attention'),
    ready_to_produce: count((j) => j.status_bucket === 'ready_to_produce'),
    in_production: count((j) => j.status_bucket === 'in_production'),
    unpaired_required_lines: jobs.reduce((n, j) => n + Number(j.unpaired_required_lines || 0), 0),
    woo_completed_not_production: 0,
  };
}
