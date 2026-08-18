import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const labels = {
  missing_sku: 'Missing SKU',
  missing_barcode: 'Missing Barcode',
  missing_unit_cost: 'Missing Unit Cost',
  missing_brand: 'Missing Brand',
  missing_style: 'Missing Style',
  missing_color: 'Missing Color',
  missing_size: 'Missing Size',
  missing_blank_link: 'Missing Blank Link',
};

export default function ProductDataHealth() {
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(nextFilter = filter) {
    setLoading(true);
    setMessage('');
    const s = await supabase.rpc('phase6_product_data_health_summary');
    const r = await supabase.rpc('phase6_product_data_health_report', { p_issue: nextFilter });
    if (s.error) setMessage(s.error.message);
    else setSummary(s.data || []);
    if (r.error) setMessage(r.error.message);
    else setRows(r.data || []);
    setLoading(false);
  }
  useEffect(() => { load('all'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(value) { setFilter(value); load(value); }

  return <div className="sc-page-stack">
    <div className="sc-page-header-card"><div><div className="sc-kicker">Data Quality</div><h2>Product Data Health</h2><p>Find missing attributes that can affect receiving, pull sheets, purchasing, job costing, and reports.</p></div><button className="sc-btn" onClick={() => load(filter)}>{loading ? 'Loading...' : 'Refresh'}</button></div>
    {message && <div className="sc-alert">{message}</div>}
    <section className="sc-stat-grid compact">{summary.map((s) => <button key={s.issue_type} className={`sc-stat-card sc-stat-button ${filter === s.issue_type ? 'active' : ''}`} onClick={() => changeFilter(s.issue_type)}><span>{labels[s.issue_type] || s.issue_type}</span><strong>{s.issue_count}</strong><small>Click to filter</small></button>)}{!summary.length && <article className="sc-stat-card"><span>Issues</span><strong>0</strong><small>No issue summary returned.</small></article>}</section>
    <section className="sc-panel">
      <div className="sc-panel-header"><div><h3>Missing Attribute Report</h3><p>Filter by issue type, then fix products in Edit Blank Items or WooCommerce/Supabase sync tools.</p></div><select value={filter} onChange={(e) => changeFilter(e.target.value)}><option value="all">All issues</option>{summary.map((s) => <option key={s.issue_type} value={s.issue_type}>{labels[s.issue_type] || s.issue_type}</option>)}</select></div>
      <div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Issue</th><th>SKU</th><th>Product</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Detail</th></tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.issue_type}-${r.product_id}-${i}`}><td><span className="sc-badge warning">{labels[r.issue_type] || r.issue_type}</span></td><td>{r.sku || '—'}</td><td>{r.product_name || '—'}</td><td>{r.brand_name || '—'}</td><td>{r.style_name || '—'}</td><td>{r.color_name || '—'}</td><td>{r.size_name || '—'}</td><td>{r.detail || '—'}</td></tr>)}{!rows.length && <tr><td colSpan="8" className="sc-empty-cell">No rows for this filter.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
