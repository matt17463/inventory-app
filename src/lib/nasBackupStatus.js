export function nasBackupStatus(site, now = Date.now()) {
  if (!site.agent_version) return 'Unconfigured';
  const report = Date.parse(site.reported_at);
  const backup = Date.parse(site.last_backup_at);
  if (!Number.isFinite(report) || now - report > 8 * 24 * 3600000) return `Stale report (${site.status})`;
  if (site.status === 'failed') return 'Failed';
  if (Number.isFinite(backup) && now - backup > 8 * 24 * 3600000) return `Backup overdue (${site.status})`;
  if (!Number.isFinite(backup)) return `${site.status} · no successful backup yet`;
  return site.status;
}
