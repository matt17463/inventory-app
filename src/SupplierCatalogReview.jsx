import { useCallback, useEffect, useState } from 'react';
import {
  clearSupplierCatalogImportedData,
  getSupplierCatalogDistinctOptions,
  getSupplierCatalogReviewPaged,
  getSupplierCatalogReviewStats,
  updateSupplierCatalogReviewItem,
} from './lib/supplierCatalogApi';

const STATUS_OPTIONS = [
  ['unreviewed', 'New / Unreviewed'],
  ['preferred', 'Preferred'],
  ['approved_special_order', 'Approved Special Order'],
  ['hidden', 'Hidden / Not Used'],
  ['rejected', 'Rejected / Do Not Use'],
];
function fmt(value) { return Number(value || 0).toLocaleString(); }
function money(value) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : ''; }
function labelStatus(value) { return STATUS_OPTIONS.find(([key]) => key === value)?.[1] || value || 'New / Unreviewed'; }
function nextState(row, updates) {
  const status = updates.review_status ?? row.review_status ?? 'unreviewed';
  const hidden = status === 'hidden' || status === 'rejected';
  return {
    review_status: status,
    use_in_quote_builder: hidden ? false : Boolean(updates.use_in_quote_builder ?? row.use_in_quote_builder),
    use_in_substitution_suggestions: hidden ? false : Boolean(updates.use_in_substitution_suggestions ?? row.use_in_substitution_suggestions),
    create_blank_candidate: hidden ? false : Boolean(updates.create_blank_candidate ?? row.create_blank_candidate),
    review_notes: updates.review_notes ?? row.review_notes ?? '',
  };
}
export default function SupplierCatalogReview() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState([]);
  const [options, setOptions] = useState({ suppliers: [], brands: [], styles: [] });
  const [filters, setFilters] = useState({ search: '', status: '', supplierName: '', brand: '', style: '', quoteOnly: false, substitutionOnly: false, candidatesOnly: false, unmatchedOnly: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [count, setCount] = useState(0);
  const [editing, setEditing] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [paged, statRows, opts] = await Promise.all([
        getSupplierCatalogReviewPaged({ ...filters, page, pageSize }),
        getSupplierCatalogReviewStats(),
        getSupplierCatalogDistinctOptions(),
      ]);
      setRows(paged.rows || []); setCount(paged.count || 0); setStats(statRows || []); setOptions(opts || {});
      setMessage(`Showing ${fmt(paged.rows?.length || 0)} of ${fmt(paged.count || 0)} matching row(s).`);
    } catch (err) { setMessage(err.message || 'Failed to load supplier catalog.'); }
    finally { setBusy(false); }
  }, [filters, page, pageSize]);
  useEffect(() => { load(); }, [load]);
  function setFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
  function applyFilters(event) { event.preventDefault(); setPage(1); setTimeout(load, 0); }
  function beginEdit(row) { setEditing((current) => ({ ...current, [row.id]: nextState(row, {}) })); }
  function cancelEdit(id) { setEditing((current) => { const next = { ...current }; delete next[id]; return next; }); }
  function updateEdit(id, key, value) { setEditing((current) => ({ ...current, [id]: nextState(current[id] || {}, { [key]: value }) })); }
  async function saveRow(row) {
    setBusy(true);
    try { await updateSupplierCatalogReviewItem({ itemId: row.id, ...(editing[row.id] || nextState(row, {})) }); cancelEdit(row.id); await load(); setMessage('Supplier catalog review saved.'); }
    catch (err) { setMessage(err.message || 'Failed to save review.'); }
    finally { setBusy(false); }
  }
  async function quickSet(row, status) {
    const values = nextState(row, { review_status: status, use_in_quote_builder: status === 'preferred' || status === 'approved_special_order', use_in_substitution_suggestions: status === 'preferred', create_blank_candidate: status === 'preferred' && !row.blank_product_id });
    setBusy(true);
    try { await updateSupplierCatalogReviewItem({ itemId: row.id, ...values }); await load(); }
    catch (err) { setMessage(err.message || 'Failed to update item.'); }
    finally { setBusy(false); }
  }
  async function clearData() {
    const supplierText = filters.supplierName ? ` for ${filters.supplierName}` : '';
    if (!window.confirm(`Clear supplier catalog imported data${supplierText}? This does not delete blank inventory, WooCommerce products, bins, jobs, or orders.`)) return;
    if (window.prompt('Type CLEAR SUPPLIER CATALOG to confirm.') !== 'CLEAR SUPPLIER CATALOG') { setMessage('Clear cancelled.'); return; }
    setBusy(true);
    try { const result = await clearSupplierCatalogImportedData({ supplierName: filters.supplierName || null, clearMode: 'all_imported' }); setMessage(result?.message || 'Supplier catalog data cleared.'); await load(); }
    catch (err) { setMessage(err.message || 'Failed to clear supplier catalog.'); }
    finally { setBusy(false); }
  }
  const statTotal = stats.reduce((s, r) => s + Number(r.item_count || 0), 0);
  const quoteCount = stats.reduce((s, r) => s + Number(r.quote_enabled || 0), 0);
  const subCount = stats.reduce((s, r) => s + Number(r.substitution_enabled || 0), 0);
  const candidateCount = stats.reduce((s, r) => s + Number(r.blank_candidates || 0), 0);
  return <main className="page supplier-review-page-only"><SupplierReviewStyles />
    <section className="page-header"><div><p className="eyebrow">Supplier Catalog</p><h1>Supplier Catalog Review</h1><p>Search and review imported supplier reference rows with pagination. This page never loads the entire supplier catalog into the browser.</p></div></section>
    {message && <p className="message">{message}</p>}
    <section className="kpi-grid"><div className="kpi-card"><span>{fmt(statTotal)}</span><strong>Total Rows</strong><small>Reference catalog</small></div><div className="kpi-card"><span>{fmt(quoteCount)}</span><strong>Quote Enabled</strong><small>Future quote use</small></div><div className="kpi-card"><span>{fmt(subCount)}</span><strong>Substitutions</strong><small>Replacement ideas</small></div><div className="kpi-card"><span>{fmt(candidateCount)}</span><strong>Blank Candidates</strong><small>Potential promotion</small></div></section>
    <section className="card danger-panel"><h2>Clear Supplier Catalog Imported Data</h2><p className="helper-text">Select a supplier filter first to clear one supplier, or leave supplier blank to clear all supplier catalog rows.</p><button className="danger-button" onClick={clearData} disabled={busy}>Clear Matching Supplier Catalog Data</button></section>
    <section className="card"><h2>Search and Filters</h2><form onSubmit={applyFilters} className="filter-grid"><label>Search<input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="SKU, UPC, brand, style, color..." /></label><label>Status<select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">All statuses</option>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Supplier<select value={filters.supplierName} onChange={(e) => setFilter('supplierName', e.target.value)}><option value="">All suppliers</option>{(options.suppliers || []).map((x) => <option key={x} value={x}>{x}</option>)}</select></label><label>Brand<input value={filters.brand} onChange={(e) => setFilter('brand', e.target.value)} list="supplier-brands" /><datalist id="supplier-brands">{(options.brands || []).map((x) => <option key={x} value={x} />)}</datalist></label><label>Style<input value={filters.style} onChange={(e) => setFilter('style', e.target.value)} list="supplier-styles" /><datalist id="supplier-styles">{(options.styles || []).map((x) => <option key={x} value={x} />)}</datalist></label><label>Page Size<select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}><option value="50">50</option><option value="100">100</option><option value="250">250</option></select></label><label className="check"><input type="checkbox" checked={filters.quoteOnly} onChange={(e) => setFilter('quoteOnly', e.target.checked)} /> Quote enabled</label><label className="check"><input type="checkbox" checked={filters.substitutionOnly} onChange={(e) => setFilter('substitutionOnly', e.target.checked)} /> Substitution enabled</label><label className="check"><input type="checkbox" checked={filters.candidatesOnly} onChange={(e) => setFilter('candidatesOnly', e.target.checked)} /> Blank candidates</label><label className="check"><input type="checkbox" checked={filters.unmatchedOnly} onChange={(e) => setFilter('unmatchedOnly', e.target.checked)} /> Unmatched only</label><div className="button-row"><button disabled={busy}>Apply Filters</button><button type="button" onClick={() => { setFilters({ search: '', status: '', supplierName: '', brand: '', style: '', quoteOnly: false, substitutionOnly: false, candidatesOnly: false, unmatchedOnly: false }); setPage(1); setTimeout(load, 0); }}>Clear</button><button type="button" onClick={load}>Refresh</button></div></form></section>
    <section className="card table-card"><div className="table-heading"><div><h2>Catalog Rows</h2><p className="helper-text">Page {fmt(page)} of {fmt(pageCount)} · Showing {fmt(rows.length)} of {fmt(count)} matching rows.</p></div><div className="button-row"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button><button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>Next</button></div></div><div className="responsive-table"><table className="data-table supplier-table"><thead><tr><th>Status</th><th>Supplier</th><th>Product</th><th>Vendor Data</th><th>Matched Blank</th><th>Use</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => { const edit = editing[row.id]; return <tr key={row.id}><td>{edit ? <select value={edit.review_status} onChange={(e) => updateEdit(row.id, 'review_status', e.target.value)}>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> : <span className="pill">{labelStatus(row.review_status)}</span>}</td><td><strong>{row.supplier_name}</strong><br /><small>{row.source_file_name}</small></td><td><strong>{[row.brand, row.style].filter(Boolean).join(' ') || 'Unnamed'}</strong><br /><small>{[row.color, row.size].filter(Boolean).join(' · ')}</small></td><td><strong>SKU:</strong> {row.supplier_sku || '—'}<br /><strong>UPC:</strong> {row.upc || '—'}<br /><strong>Cost:</strong> {money(row.unit_cost) || '—'}</td><td>{row.blank_product_id ? <><strong>{row.blank_sku_base}</strong><br /><small>{row.blank_product_name}</small></> : <span className="warn">Unmatched</span>}</td><td>{edit ? <div className="checks"><label><input type="checkbox" checked={edit.use_in_quote_builder} onChange={(e) => updateEdit(row.id, 'use_in_quote_builder', e.target.checked)} /> Quote</label><label><input type="checkbox" checked={edit.use_in_substitution_suggestions} onChange={(e) => updateEdit(row.id, 'use_in_substitution_suggestions', e.target.checked)} /> Substitute</label><label><input type="checkbox" checked={edit.create_blank_candidate} onChange={(e) => updateEdit(row.id, 'create_blank_candidate', e.target.checked)} /> Candidate</label></div> : <small>{row.use_in_quote_builder ? 'Quote ' : ''}{row.use_in_substitution_suggestions ? 'Substitute ' : ''}{row.create_blank_candidate ? 'Candidate' : ''}{!row.use_in_quote_builder && !row.use_in_substitution_suggestions && !row.create_blank_candidate ? 'Reference only' : ''}</small>}</td><td>{edit ? <textarea value={edit.review_notes} onChange={(e) => updateEdit(row.id, 'review_notes', e.target.value)} /> : row.review_notes || row.notes || ''}</td><td>{edit ? <div className="button-row"><button onClick={() => saveRow(row)} disabled={busy}>Save</button><button onClick={() => cancelEdit(row.id)}>Cancel</button></div> : <div className="button-row"><button onClick={() => beginEdit(row)}>Edit</button><button onClick={() => quickSet(row, 'preferred')}>Preferred</button><button onClick={() => quickSet(row, 'approved_special_order')}>Special Order</button></div>}</td></tr>; })}{!rows.length && <tr><td colSpan="8">No matching supplier catalog rows.</td></tr>}</tbody></table></div></section>
  </main>;
}
function SupplierReviewStyles(){return <style>{`.supplier-review-page-only{display:grid;gap:18px}.danger-panel{border-color:rgba(225,29,72,.22)!important;background:radial-gradient(circle at top left,rgba(225,29,72,.08),transparent 26rem),#fff}.filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.check{display:flex;align-items:center;gap:8px;font-weight:800}.button-row{display:flex;gap:8px;flex-wrap:wrap}.table-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.supplier-table{min-width:1250px}.pill,.warn{display:inline-flex;border-radius:999px;padding:6px 10px;font-weight:900;font-size:.76rem;background:rgba(37,99,235,.1);color:#1d4ed8}.warn{background:rgba(249,115,22,.12);color:#c2410c}.checks{display:grid;gap:6px}.supplier-review-page-only textarea{min-height:70px}@media(max-width:760px){.button-row,.table-heading{display:grid}}`}</style>}
