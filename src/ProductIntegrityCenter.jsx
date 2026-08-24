import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getProductIntegrityIssues,
  getProductIntegritySummary,
  productIntegrityLabel,
} from './lib/productIntegrityApi';

function count(value) {
  return Number(value || 0).toLocaleString();
}

function detailText(row) {
  const details = row?.details || {};
  if (typeof details === 'string') return details;
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' · ');
}

export default function ProductIntegrityCenter() {
  const [summary, setSummary] = useState([]);
  const [issues, setIssues] = useState([]);
  const [issueType, setIssueType] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (nextType = 'all', nextSearch = '') => {
    setLoading(true);
    setMessage('');
    try {
      const [summaryRows, issueRows] = await Promise.all([
        getProductIntegritySummary(),
        getProductIntegrityIssues({ issueType: nextType, search: nextSearch }),
      ]);
      setSummary(summaryRows);
      setIssues(issueRows);
    } catch (error) {
      const missingSql = /sc_product_integrity_(summary|issues)_v1|schema cache|does not exist/i.test(error.message || '');
      setMessage(missingSql
        ? 'Product Integrity SQL is not installed. Run deployment/sql/27_PRODUCT_INTEGRITY_DIAGNOSTICS.sql in Supabase, then refresh this page.'
        : (error.message || 'Product integrity diagnostics could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('all', '');
  }, [load]);

  const totals = useMemo(() => summary.reduce((result, row) => {
    result.issueGroups += 1;
    result.records += Number(row.issue_count || 0);
    if (row.severity === 'high') result.high += Number(row.issue_count || 0);
    return result;
  }, { issueGroups: 0, records: 0, high: 0 }), [summary]);

  function applyFilter(nextType) {
    setIssueType(nextType);
    load(nextType, search);
  }

  return (
    <main className="page sc-page-stack">
      <section className="sc-page-header-card">
        <div>
          <div className="sc-kicker">Read-only data quality</div>
          <h1>Product Integrity Center</h1>
          <p>Find duplicate and incomplete blank-product records before they create inventory, purchasing, pull-sheet, or WooCommerce conflicts. This page never merges, deletes, or changes data.</p>
        </div>
        <button className="sc-btn sc-btn-primary" type="button" onClick={() => load(issueType, search)} disabled={loading}>
          {loading ? 'Checking…' : 'Run Diagnostics'}
        </button>
      </section>

      {message && <section className="sc-alert" role="alert">{message}</section>}

      <section className="sc-stat-grid compact">
        <article className="sc-stat-card"><span>Issue records</span><strong>{count(totals.records)}</strong><small>Rows requiring review</small></article>
        <article className="sc-stat-card"><span>High priority</span><strong>{count(totals.high)}</strong><small>Deterministic conflicts</small></article>
        <article className="sc-stat-card"><span>Issue types</span><strong>{count(totals.issueGroups)}</strong><small>Categories detected</small></article>
        <article className="sc-stat-card"><span>Changes made</span><strong>0</strong><small>Diagnostics are read-only</small></article>
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header">
          <div><h2>Diagnostic categories</h2><p>Start with duplicate identity, SKU, and barcode groups before reviewing incomplete records.</p></div>
        </div>
        <div className="sc-button-row">
          <button type="button" className={issueType === 'all' ? 'sc-btn sc-btn-primary' : 'sc-btn'} onClick={() => applyFilter('all')}>All issues</button>
          {summary.map((row) => (
            <button type="button" key={row.issue_type} className={issueType === row.issue_type ? 'sc-btn sc-btn-primary' : 'sc-btn'} onClick={() => applyFilter(row.issue_type)}>
              {productIntegrityLabel(row.issue_type)} ({count(row.issue_count)})
            </button>
          ))}
        </div>
      </section>

      <section className="sc-panel">
        <form className="sc-toolbar" onSubmit={(event) => { event.preventDefault(); load(issueType, search); }}>
          <input className="sc-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, product, group, or diagnostic details…" />
          <button className="sc-btn sc-btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
          <button type="button" className="sc-btn" onClick={() => { setSearch(''); load(issueType, ''); }}>Clear</button>
        </form>

        <div className="sc-responsive-table-wrap">
          <table className="sc-table">
            <thead><tr><th>Severity</th><th>Issue</th><th>SKU / Entity</th><th>Product</th><th>Conflict group</th><th>Evidence</th></tr></thead>
            <tbody>
              {issues.map((row) => (
                <tr key={row.issue_id}>
                  <td><span className={`sc-badge ${row.severity === 'high' ? 'danger' : 'warning'}`}>{row.severity}</span></td>
                  <td>{productIntegrityLabel(row.issue_type)}</td>
                  <td><strong>{row.sku || row.entity_id || '—'}</strong><br /><small>{row.entity_type}</small></td>
                  <td>{row.product_name || '—'}</td>
                  <td><code>{row.candidate_group || '—'}</code></td>
                  <td>{detailText(row) || '—'}</td>
                </tr>
              ))}
              {!issues.length && !loading && <tr><td colSpan="6" className="sc-empty-cell">No issues match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="helper-text">Showing up to 500 issue records. No records are modified from this screen.</p>
      </section>
    </main>
  );
}
