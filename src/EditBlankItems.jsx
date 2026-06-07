import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const empty = { sku_base: '', name: '', barcode: '', brand_id: '', product_type_id: '', color_id: '', size_id: '', unit_cost: '', low_stock_threshold: '', image_url: '' };

export default function EditBlankItems() {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ brands: [], product_types: [], colors: [], sizes: [] });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadLookups() {
    const [brands, productTypes, colors, sizes] = await Promise.all([
      supabase.from('brands').select('id,name,code').order('name'),
      supabase.from('product_types').select('id,name,code').order('name'),
      supabase.from('colors').select('id,name,code').order('name'),
      supabase.from('sizes').select('id,name,code').order('name'),
    ]);
    setLookups({
      brands: brands.data || [],
      product_types: productTypes.data || [],
      colors: colors.data || [],
      sizes: sizes.data || [],
    });
  }

  async function loadRows() {
    setLoading(true);
    setMessage('');
    let data = [];
    let error = null;
    const rpc = await supabase.rpc('search_blank_products_for_edit', { p_search: search.trim() });
    if (!rpc.error) {
      data = rpc.data || [];
    } else {
      const res = await supabase
        .from('blank_products')
        .select('id,sku_base,name,barcode,brand_id,product_type_id,color_id,size_id,unit_cost,low_stock_threshold,image_url')
        .or(`sku_base.ilike.%${search}%,name.ilike.%${search}%,barcode.ilike.%${search}%`)
        .limit(250);
      data = res.data || [];
      error = res.error;
    }
    if (error) setMessage(error.message);
    setRows(data);
    setLoading(false);
  }

  useEffect(() => { loadLookups(); }, []);
  useEffect(() => { loadRows(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(row) {
    setSelected(row);
    setForm({ ...empty, ...row });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save() {
    if (!selected?.id) return;
    setLoading(true);
    setMessage('');
    const payload = {
      sku_base: form.sku_base || null,
      name: form.name || null,
      barcode: form.barcode || null,
      brand_id: form.brand_id || null,
      product_type_id: form.product_type_id || null,
      color_id: form.color_id || null,
      size_id: form.size_id || null,
      unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
      low_stock_threshold: form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold),
      image_url: form.image_url || null,
    };
    const { error } = await supabase.from('blank_products').update(payload).eq('id', selected.id);
    if (error) setMessage(error.message);
    else {
      setMessage('Blank item saved.');
      setSelected(null);
      setForm(empty);
      await loadRows();
    }
    setLoading(false);
  }

  const visibleRows = useMemo(() => rows || [], [rows]);
  const select = (key, label) => (
    <label className="sc-field">
      <span>{label}</span>
      <select value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
        <option value="">Select {label}</option>
        {(lookups[key === 'product_type_id' ? 'product_types' : key.replace('_id', 's')] || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="sc-page-stack">
      <div className="sc-page-header-card">
        <div><div className="sc-kicker">Inventory Admin</div><h2>Edit Blank Items</h2><p>Search, clean up, and maintain blank product records used by receiving, pull sheets, purchasing, and reports.</p></div>
      </div>

      {message && <div className="sc-alert">{message}</div>}

      <section className="sc-panel">
        <div className="sc-panel-header"><div><h3>{selected ? 'Edit Selected Blank Product' : 'Select a Blank Product'}</h3><p>Required matching fields are Brand, Style, Color, and Size.</p></div></div>
        {selected ? (
          <div className="sc-form-grid">
            <label className="sc-field"><span>SKU Base</span><input value={form.sku_base || ''} onChange={(e) => setForm({ ...form, sku_base: e.target.value })} /></label>
            <label className="sc-field"><span>Name</span><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="sc-field"><span>Barcode / UPC</span><input value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></label>
            {select('brand_id', 'Brand')}
            {select('product_type_id', 'Style / Product Type')}
            {select('color_id', 'Color')}
            {select('size_id', 'Size')}
            <label className="sc-field"><span>Unit Cost</span><input type="number" step="0.01" value={form.unit_cost || ''} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></label>
            <label className="sc-field"><span>Low Stock Threshold</span><input type="number" value={form.low_stock_threshold || ''} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></label>
            <label className="sc-field sc-field-wide"><span>Image URL</span><input value={form.image_url || ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></label>
            <div className="sc-form-actions"><button className="sc-btn sc-btn-primary" onClick={save} disabled={loading}>Save Blank Item</button><button className="sc-btn" onClick={() => { setSelected(null); setForm(empty); }}>Cancel</button></div>
          </div>
        ) : <p className="sc-muted">Search below and choose an item to edit.</p>}
      </section>

      <section className="sc-panel">
        <div className="sc-toolbar">
          <input className="sc-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU, name, barcode, brand, style, color, or size..." onKeyDown={(e) => { if (e.key === 'Enter') loadRows(); }} />
          <button className="sc-btn sc-btn-primary" onClick={loadRows} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
        </div>
        <div className="sc-responsive-table-wrap">
          <table className="sc-table">
            <thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Cost</th><th></th></tr></thead>
            <tbody>
              {visibleRows.map((row) => <tr key={row.id}><td>{row.sku_base || '—'}</td><td>{row.name || '—'}</td><td>{row.brand || row.brands?.name || '—'}</td><td>{row.product_type || row.product_types?.name || '—'}</td><td>{row.color || row.colors?.name || '—'}</td><td>{row.size || row.sizes?.name || '—'}</td><td>{row.unit_cost ?? '—'}</td><td><button className="sc-btn sc-btn-small" onClick={() => startEdit(row)}>Edit</button></td></tr>)}
              {!visibleRows.length && <tr><td colSpan="8" className="sc-empty-cell">No blank products found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
