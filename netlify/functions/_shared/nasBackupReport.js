export function backupReportPatch(input, now = new Date()) {
  if (!input || !['business', 'home'].includes(input.site) || !['configured', 'running', 'success', 'failed'].includes(input.status)) {
    throw new Error('Invalid site or status.');
  }
  if (Object.hasOwn(input, 'last_restore_test_at')) {
    throw new Error('Backup agents cannot certify independent restore tests.');
  }
  const stamp = now.toISOString();
  const report = { site: input.site, status: input.status,
    error_summary: String(input.error_summary || '').slice(0, 400),
    agent_version: String(input.agent_version || '').slice(0, 80),
    reported_at: stamp, updated_at: stamp };
  if (input.status === 'success') {
    for (const key of ['object_count', 'bytes_stored']) {
      if (!Number.isSafeInteger(input[key]) || input[key] < 0) throw new Error('Invalid totals.');
      report[key] = input[key];
    }
    const completed = Date.parse(input.last_backup_at);
    if (!Number.isFinite(completed) || completed > now.getTime() + 60000) throw new Error('Invalid backup completion time.');
    report.last_backup_at = new Date(completed).toISOString();
  }
  // Omitted columns remain unchanged on conflict. Running/failure reports must
  // not erase the last successful totals or the administrator's restore record.
  return report;
}
