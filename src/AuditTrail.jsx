import { useEffect, useState } from 'react';
import { downloadCsv, getAuditTrail } from './lib/phase6Api';

export default function AuditTrail() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try { setRows(await getAuditTrail({ search, actionType })); }
    catch (err) { setError(err.message || 'Failed to load audit trail.'); }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="page phase6-page">
      <div className="page-header-row">
        <div><h1>Audit Trail</h1><p className="muted">Track inventory, production, mapping, quote, artwork, photo, and portal actions.</p></div>
        <button className="button" onClick={load}>Refresh</button>
      </div>
      <section className="phase6-toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, order, summary…" />
        <input value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="Filter action type…" />
        <button className="button" onClick={load}>Search</button>
        <button className="button" onClick={() => downloadCsv('audit-trail.csv', rows)}>Export CSV</button>
      </section>
      {error && <div className="error-card">{error}</div>}
      <div className="table-wrap">
        <table className="data-table compact-table"><thead><tr><th>Date</th><th>Severity</th><th>Action</th><th>Entity</th><th>Summary</th><th>Actor</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.severity}</td><td>{r.action_type}</td><td>{r.entity_type}<br/><code>{r.entity_id}</code></td><td>{r.summary}</td><td>{r.actor_name || r.actor_email || '—'}</td></tr>)}
          {!rows.length && <tr><td colSpan="6">No audit entries found.</td></tr>}
        </tbody></table>
      </div>
    </main>
  );
}
