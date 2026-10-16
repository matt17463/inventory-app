import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const labels = {
  missing_sku: 'Missing SKU',
  missing_barcode: 'Optional Barcode / UPC',
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
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const requestId = useRef(0);
  const pageSize = 100;

  async function load(nextFilter = filter, nextOffset = 0) {
    const request = ++requestId.current;
    setLoading(true); setMessage('');
    const result = await supabase.rpc('sc_product_data_health_page_v2', {
      p_issue:nextFilter,p_offset:nextOffset,p_limit:pageSize,
    });
    if (request !== requestId.current) return;
    if (result.error) { setMessage(result.error.message); setRows([]); }
    else {
      setSummary(result.data?.summary || []); setRows(result.data?.rows || []);
      setTotal(Number(result.data?.total || 0)); setOffset(nextOffset);
    }
    setLoading(false);
  }
  useEffect(() => { load('all'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(value) { setFilter(value); load(value); }

  return <div className="sc-page-stack">
    <div className="sc-page-header-card"><div><div className="sc-kicker">Data Quality</div><h2>Product Data Health</h2><p>Review physical blank information and inventory-requiring WooCommerce mappings. Barcode and cost checks use the blank record; archived items, parent products, and approved services are excluded.</p></div><button className="sc-btn" onClick={() => load(filter)}>{loading ? 'Loading...' : 'Refresh'}</button></div>
    {message && <div className="sc-alert">{message}</div>}
    <section className="sc-stat-grid compact">{summary.map((s) => <button key={s.issue_type} className={`sc-stat-card sc-stat-button ${filter === s.issue_type ? 'active' : ''}`} onClick={() => changeFilter(s.issue_type)}><span>{labels[s.issue_type] || s.issue_type}</span><strong>{s.issue_count}</strong><small>Click to filter</small></button>)}{!summary.length && <article className="sc-stat-card"><span>Issues</span><strong>0</strong><small>No issue summary returned.</small></article>}</section>
    <section className="sc-panel">
      <div className="sc-panel-header"><div><h3>Missing Attribute Report</h3><p>Counts include every matching record. Optional barcode information does not block receiving or production.</p></div><select value={filter} onChange={(e) => changeFilter(e.target.value)}><option value="all">All issues</option>{summary.map((s) => <option key={s.issue_type} value={s.issue_type}>{labels[s.issue_type] || s.issue_type}</option>)}</select></div>
      <p role="status">Showing {rows.length ? offset + 1 : 0}–{Math.min(offset + rows.length,total)} of {total.toLocaleString()} matching records.</p>
      <div className="sc-responsive-table-wrap"><table className="sc-table"><thead><tr><th>Issue</th><th>SKU</th><th>Product</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Detail</th></tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.product_table}-${r.issue_type}-${r.product_id}-${i}`}><td><span className={`sc-badge ${r.severity === 'info' ? '' : 'warning'}`}>{labels[r.issue_type] || r.issue_type}</span></td><td>{r.sku || '—'}</td><td>{r.product_name || '—'}</td><td>{r.brand_name || '—'}</td><td>{r.style_name || '—'}</td><td>{r.color_name || '—'}</td><td>{r.size_name || '—'}</td><td>{r.detail || '—'}</td></tr>)}{!rows.length && <tr><td colSpan="8" className="sc-empty-cell">No rows for this filter.</td></tr>}</tbody></table></div>
      <div className="phase1-actions"><button type="button" disabled={loading || offset === 0} onClick={()=>load(filter,Math.max(0,offset-pageSize))}>Previous</button><button type="button" disabled={loading || offset+pageSize >= total} onClick={()=>load(filter,offset+pageSize)}>Next</button></div>
    </section>
  </div>;
}
