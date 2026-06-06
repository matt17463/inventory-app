import { useEffect, useMemo, useState } from 'react';
import { downloadCsv, getProductDataHealthReport, getProductDataHealthSummary, markProductHealthIssueStatus } from './lib/phase6Api';

const ISSUE_TYPES = [
  ['all', 'All Active Issues'],
  ['missing_sku', 'Missing SKU'],
  ['missing_brand_id', 'Missing Brand'],
  ['missing_product_type_id', 'Missing Style / Product Type'],
  ['missing_color_id', 'Missing Color'],
  ['missing_size_id', 'Missing Size'],
  ['missing_blank_product_link', 'Missing Blank Product Link'],
  ['duplicate_blank_product_link', 'Duplicate Blank Product Link'],
];

function prettyIssue(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayName(name, id) {
  if (name) return name;
  if (id) return `ID ${id}`;
  return '—';
}

function blankLinkLabel(row) {
  if (row.blank_product_id) return 'Linked';
  if (row.mapping_status === 'excluded_from_blank_mapping') return 'Excluded';
  return '—';
}

export default function ProductDataHealth() {
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [issueType, setIssueType] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(type = issueType) {
    setLoading(true);
    setError('');
    try {
      const [s, r] = await Promise.all([
        getProductDataHealthSummary(),
        getProductDataHealthReport(type),
      ]);
      setSummary(Array.isArray(s) ? s : []);
      setRows(Array.isArray(r) ? r : []);
    } catch (err) {
      setError(err.message || 'Failed to load product data health.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIssues = useMemo(
    () => summary.reduce((sum, row) => sum + Number(row.issue_count || 0), 0),
    [summary]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => `${r.issue_type} ${r.sku} ${r.name} ${r.details} ${r.brand_name} ${r.product_type_name} ${r.color_name} ${r.size_name} ${r.mapping_status}`.toLowerCase().includes(q));
  }, [rows, search]);

  async function ignore(row) {
    await markProductHealthIssueStatus(row, 'ignored', 'Ignored from Product Data Health page.');
    await load(issueType);
  }

  return (
    <main className="page phase6-page">
      <div className="page-header-row">
        <div>
          <p className="eyebrow">Tools & Admin</p>
          <h1>Product Data Health</h1>
          <p className="muted">
            Run reports for products with missing attributes, missing mapping links, or incomplete source data. Excluded non-blank, parent, sublimation, mug, and aggregate rows are no longer counted as active issues.
          </p>
        </div>
        <button className="button" onClick={() => load(issueType)}>Refresh</button>
      </div>

      {!loading && !summary.length && (
        <section className="phase6-empty-success">
          <h2>No active product data health issues found</h2>
          <p>
            Product mapping repair and exclusions are currently clean. If you expected issues, confirm the Mapping Repair V6/V7 SQL has been run and then refresh this page.
          </p>
        </section>
      )}

      {!!summary.length && (
        <section className="phase6-kpi-grid">
          <button className="phase6-kpi-card clickable" onClick={() => { setIssueType('all'); load('all'); }}>
            <span>Total Active Issues</span>
            <strong>{totalIssues}</strong>
          </button>
          {summary.map((s) => (
            <button key={s.issue_type} className="phase6-kpi-card clickable" onClick={() => { setIssueType(s.issue_type); load(s.issue_type); }}>
              <span>{prettyIssue(s.issue_type)}</span>
              <strong>{s.issue_count}</strong>
            </button>
          ))}
        </section>
      )}

      <section className="phase6-toolbar">
        <select value={issueType} onChange={(e) => { setIssueType(e.target.value); load(e.target.value); }}>
          {ISSUE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU, name, brand, color, size, issue…" />
        <button className="button" onClick={() => downloadCsv(`product-data-health-${issueType}.csv`, filtered)}>Export CSV</button>
      </section>

      {loading && <p>Loading…</p>}
      {error && <div className="error-card">{error}</div>}

      <div className="table-wrap">
        <table className="data-table compact-table product-health-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>SKU</th>
              <th>Name</th>
              <th>Brand</th>
              <th>Style</th>
              <th>Color</th>
              <th>Size</th>
              <th>Blank Link</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.issue_type}-${r.product_id}`}>
                <td>
                  <span className="phase6-pill warning">{prettyIssue(r.issue_type)}</span>
                  <br />
                  <small>{r.details}</small>
                </td>
                <td><code>{r.sku || '—'}</code></td>
                <td>{r.name || '—'}</td>
                <td>{displayName(r.brand_name, r.brand_id)}</td>
                <td>{displayName(r.product_type_name, r.product_type_id)}</td>
                <td>{displayName(r.color_name, r.color_id)}</td>
                <td>{displayName(r.size_name, r.size_id)}</td>
                <td>{blankLinkLabel(r)}</td>
                <td><small>{r.mapping_status || '—'}</small></td>
                <td><button className="button small" onClick={() => ignore(r)}>Ignore</button></td>
              </tr>
            ))}
            {!filtered.length && !loading && <tr><td colSpan="10">No matching product data issues found.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
