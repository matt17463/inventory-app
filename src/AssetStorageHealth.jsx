import { useEffect, useState } from 'react';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';
import { nasBackupStatus } from './lib/nasBackupStatus';

function size(bytes) {
  const amount = Number(bytes || 0);
  if (amount < 1024) return `${amount} bytes`;
  if (amount >= 1073741824) return `${(amount / 1073741824).toFixed(2)} GB`;
  if (amount < 1048576) return `${(amount / 1024).toFixed(1)} KB`;
  return `${(amount / 1048576).toFixed(1)} MB`;
}

export default function AssetStorageHealth() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [nas, setNas] = useState([]);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try {
      const response = await authenticatedFunctionFetch('/.netlify/functions/asset-storage-health');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) throw new Error(payload.error || 'Storage health check failed.');
      setData(payload);
      const res=await authenticatedFunctionFetch('/.netlify/functions/nas-backup-health');
      const report=await res.json().catch(()=>({}));
      if(!res.ok||!report.success)throw new Error(report.error||'NAS monitoring unavailable');
      setNas(report.sites||[]);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <main className="page"><header className="page-header"><div><p className="eyebrow">Storage & Egress</p><h1>Storage Administration</h1><p>Monitor active Cloudflare R2 assets and both NAS backup locations. R2 remains the primary file store.</p></div><button className="sc-btn sc-btn-primary" onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Refresh'}</button></header>
    {error ? <div className="error-card">{error}</div> : null}
    {data ? <>
      <section className="card elevated-card"><h2>{data.summary.migration_complete ? 'R2 migration complete' : 'Migration still required'}</h2><p><strong>R2:</strong> {data.r2.reachable ? 'Connected' : 'Unavailable'} &nbsp; <strong>Supabase objects:</strong> {data.summary.supabase_objects} &nbsp; <strong>Supabase references:</strong> {data.summary.supabase_database_references}</p><p className="muted">This page does not display credentials. A completed migration means the tracked Supabase asset buckets are empty and no operational database records point to Supabase files.</p></section>
      <section className="card elevated-card"><h2>NAS backup locations</h2><p>Agent-reported statuses are not proof that an archive can be restored. A restore test must be completed independently.</p><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Location</th><th>State</th><th>Last report</th><th>Last backup</th><th>Stored files</th><th>Stored size</th><th>Restore tested</th><th>Problem</th></tr></thead><tbody>{nas.map(site=><tr key={site.site}><td>{site.site==='business'?'Business NAS':'Home NAS'}</td><td>{nasBackupStatus(site)}</td><td>{site.agent_version&&site.reported_at?new Date(site.reported_at).toLocaleString():'Never'}</td><td>{site.last_backup_at?new Date(site.last_backup_at).toLocaleString():'Not verified'}</td><td>{site.object_count}</td><td>{size(site.bytes_stored)}</td><td>{site.last_restore_test_at?new Date(site.last_restore_test_at).toLocaleDateString():'Not tested'}</td><td>{site.error_summary||'—'}</td></tr>)}</tbody></table></div><p><small>To activate backup reporting, install and configure a least-privilege NAS backup agent. No R2 deletion or archival offload is enabled.</small></p></section>
      <section className="card elevated-card"><h2>Supabase storage buckets</h2><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Bucket</th><th>Objects</th><th>Size</th><th>Status</th></tr></thead><tbody>{data.supabase_buckets.map((row)=><tr key={row.bucket_name}><td>{row.bucket_name}</td><td>{row.object_count}</td><td>{size(row.total_bytes)}</td><td>{Number(row.object_count) ? 'Migrate/review' : 'Empty'}</td></tr>)}</tbody></table></div></section>
      <section className="card elevated-card"><h2>Database asset references</h2><div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Asset type</th><th>Provider</th><th>Records</th><th>Stored files</th><th>Known size</th></tr></thead><tbody>{data.inventory.map((row)=><tr key={`${row.asset_type}-${row.provider}`}><td>{row.asset_type}</td><td>{row.provider}</td><td>{row.record_count}</td><td>{row.stored_file_count}</td><td>{size(row.known_bytes)}</td></tr>)}</tbody></table></div></section>
      {!data.summary.migration_complete ? <section className="card elevated-card"><h2>Next step</h2><p>Run the supplied migration utility from Terminal in dry-run mode, review the report, and then rerun it with <code>--execute</code>. Refresh this page afterward.</p></section> : null}
    </> : null}
  </main>;
}
