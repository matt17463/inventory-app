import { useEffect, useMemo, useState } from 'react';
import { downloadCsv, getProductDataHealthReport, getProductDataHealthSummary, markProductHealthIssueStatus } from './lib/phase6Api';

const ISSUE_TYPES = [
  ['all', 'All Issues'],
  ['missing_sku', 'Missing SKU'],
  ['missing_brand_id', 'Missing Brand'],
  ['missing_product_type_id', 'Missing Style / Product Type'],
  ['missing_color_id', 'Missing Color'],
  ['missing_size_id', 'Missing Size'],
  ['missing_blank_product_link', 'Missing Blank Product Link'],
];

export default function ProductDataHealth() {
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [issueType, setIssueType] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(type = issueType) {
    setLoading(true); setError('');
    try {
      const [s, r] = await Promise.all([getProductDataHealthSummary(), getProductDataHealthReport(type)]);
      setSummary(s); setRows(r);
    } catch (err) { setError(err.message || 'Failed to load product data health.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load('all'); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => `${r.issue_type} ${r.sku} ${r.name} ${r.details}`.toLowerCase().includes(q));
  }, [rows, search]);

  async function ignore(row) {
    await markProductHealthIssueStatus(row, 'ignored', 'Ignored from Product Data Health page.');
    await load(issueType);
  }

  return (
    <main className="page phase6-page">
      <div className="page-header-row">
        <div>
          <h1>Product Data Health</h1>
          <p className="muted">Run reports for products with missing attributes, missing mapping links, or incomplete source data.</p>
        </div>
        <button className="button" onClick={() => load(issueType)}>Refresh</button>
      </div>

      <section className="phase6-kpi-grid">
        {summary.map((s) => (
          <button key={s.issue_type} className="phase6-kpi-card clickable" onClick={() => { setIssueType(s.issue_type); load(s.issue_type); }}>
            <span>{s.issue_type.replaceAll('_', ' ')}</span><strong>{s.issue_count}</strong>
          </button>
        ))}
      </section>

      <section className="phase6-toolbar">
        <select value={issueType} onChange={(e) => { setIssueType(e.target.value); load(e.target.value); }}>
          {ISSUE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU, name, issue…" />
        <button className="button" onClick={() => downloadCsv(`product-data-health-${issueType}.csv`, filtered)}>Export CSV</button>
      </section>

      {loading && <p>Loading…</p>}
      {error && <div className="error-card">{error}</div>}

      <div className="table-wrap">
        <table className="data-table compact-table">
          <thead><tr><th>Issue</th><th>SKU</th><th>Name</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Blank Link</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.issue_type}-${r.product_id}`}>
                <td><span className="phase6-pill warning">{r.issue_type}</span><br /><small>{r.details}</small></td>
                <td><code>{r.sku}</code></td>
                <td>{r.name}</td>
                <td>{r.brand_id || '—'}</td>
                <td>{r.product_type_id || '—'}</td>
                <td>{r.color_id || '—'}</td>
                <td>{r.size_id || '—'}</td>
                <td>{r.blank_product_id || '—'}</td>
                <td><button className="button small" onClick={() => ignore(r)}>Ignore</button></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan="9">No matching product data issues found.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
