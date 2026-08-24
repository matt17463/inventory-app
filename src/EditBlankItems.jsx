import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { bulkUpdateBlankProducts, updateBlankProduct } from './inventoryApi';
import { TableInlineEditorRow } from './components/UIPrimitives';

const empty = { sku_base: '', name: '', barcode: '', brand_id: '', product_type_id: '', color_id: '', size_id: '', unit_cost: '', low_stock_threshold: '', image_url: '' };

const emptyBulkForm = {
  updateLowStockThreshold: false,
  lowStockThreshold: '',
  updateImageUrl: false,
  imageUrl: '',
  clearImageUrl: false,
};

function normalizeRowId(id) {
  return id == null ? '' : String(id);
}

function formatCost(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function EditBlankItems() {
  const [rows, setRows] = useState([]);
  const [lookups, setLookups] = useState({ brands: [], product_types: [], colors: [], sizes: [] });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState(empty);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  async function loadLookups() {
    const [brands, productTypes, colors, sizes] = await Promise.all([
      supabase.from('brands').select('id,name,code').order('name'),
      supabase.from('product_types').select('id,name,code').order('name'),
      supabase.from('sc_active_colors').select('id,name,code').order('name'),
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
    const trimmedSearch = search.trim();
    const query = supabase
      .from('blank_products')
      .select('id,sku_base,name,barcode,brand_id,product_type_id,color_id,size_id,unit_cost,low_stock_threshold,image_url,brands:brand_id(name,code),product_types:product_type_id(name,code),colors:color_id(name,code),sizes:size_id(name,code)')
      .eq('sc_is_archived', false)
      .limit(500);

    if (trimmedSearch) {
      const safeSearch = trimmedSearch.replace(/[%_,]/g, '');
      query.or(`sku_base.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%,barcode.ilike.%${safeSearch}%`);
    }

    const res = await query;
    data = res.data || [];
    error = res.error;
    if (error) setMessage(error.message);
    setRows(data);
    setSelectedIds((current) => current.filter((id) => data.some((row) => normalizeRowId(row.id) === id)));
    setLoading(false);
  }

  useEffect(() => { loadLookups(); }, []);
  useEffect(() => { loadRows(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(row) {
    setSelected(row);
    setForm({ ...empty, ...row });
    setMessage('');
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
    try {
      await updateBlankProduct(selected.id, payload);
      setMessage('Blank item saved.');
      setSelected(null);
      setForm(empty);
      await loadRows();
    } catch (error) {
      setMessage(error.message || 'Blank item could not be saved.');
    }
    setLoading(false);
  }

  const visibleRows = useMemo(() => rows || [], [rows]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => visibleRows.filter((row) => selectedSet.has(normalizeRowId(row.id))),
    [visibleRows, selectedSet]
  );
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedSet.has(normalizeRowId(row.id)));

  function toggleRow(row) {
    const id = normalizeRowId(row.id);
    if (!id) return;
    setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function selectVisible() {
    setSelectedIds(Array.from(new Set(visibleRows.map((row) => normalizeRowId(row.id)).filter(Boolean))));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function toggleAllVisible() {
    if (allVisibleSelected) clearSelection();
    else selectVisible();
  }

  async function applyBulkEdit() {
    if (!selectedIds.length) {
      setMessage('Select at least one blank item to bulk edit.');
      return;
    }

    const input = {};

    if (bulkForm.updateLowStockThreshold) {
      input.low_stock_threshold = bulkForm.lowStockThreshold === '' ? null : bulkForm.lowStockThreshold;
    }

    if (bulkForm.updateImageUrl) {
      input.image_url = bulkForm.clearImageUrl ? '' : bulkForm.imageUrl;
    }

    if (!Object.keys(input).length) {
      setMessage('Choose at least one bulk edit field: low stock threshold and/or image URL.');
      return;
    }

    const summary = [];
    if (Object.prototype.hasOwnProperty.call(input, 'low_stock_threshold')) {
      summary.push(input.low_stock_threshold === null ? 'clear low-stock threshold' : `set low-stock threshold to ${input.low_stock_threshold}`);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'image_url')) {
      summary.push(input.image_url ? 'update image URL' : 'clear image URL');
    }

    const confirmed = window.confirm(`Apply bulk edit to ${selectedIds.length} blank item(s)?\n\nThis will ${summary.join(' and ')}.`);
    if (!confirmed) return;

    setBulkLoading(true);
    setMessage('');
    try {
      const updated = await bulkUpdateBlankProducts(selectedIds, input);
      setMessage(`Bulk edit complete. Updated ${updated.length || selectedIds.length} blank item(s).`);
      setBulkForm(emptyBulkForm);
      setSelectedIds([]);
      await loadRows();
    } catch (err) {
      setMessage(err.message || 'Bulk edit failed.');
    } finally {
      setBulkLoading(false);
    }
  }

  const select = (key, label) => (
    <label className="sc-field">
      <span>{label}</span>
      <select value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
        <option value="">Select {label}</option>
        {(lookups[key === 'product_type_id' ? 'product_types' : key.replace('_id', 's')] || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </label>
  );

  const singleItemEditor = selected ? (
    <div className="sc-form-grid sc-form-grid--compact">
      <label className="sc-field"><span>SKU Base</span><input autoFocus value={form.sku_base || ''} onChange={(e) => setForm({ ...form, sku_base: e.target.value })} /></label>
      <label className="sc-field"><span>Name</span><input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="sc-field"><span>Barcode / UPC</span><input value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></label>
      {select('brand_id', 'Brand')}
      {select('product_type_id', 'Style / Product Type')}
      {select('color_id', 'Color')}
      {select('size_id', 'Size')}
      <label className="sc-field"><span>Unit Cost</span><input type="number" step="0.01" value={form.unit_cost || ''} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></label>
      <label className="sc-field"><span>Low Stock Threshold</span><input type="number" value={form.low_stock_threshold || ''} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></label>
      <label className="sc-field sc-field-wide"><span>Image URL</span><input value={form.image_url || ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></label>
      {form.image_url && <div className="sc-field"><span>Image Preview</span><img className="sc-thumb" src={form.image_url} alt="Blank product preview" /></div>}
      <div className="sc-form-actions sc-form-wide sc-inline-editor__actions">
        <button className="sc-btn sc-btn-primary" onClick={save} disabled={loading}>Save Blank Item</button>
        <button className="sc-btn" onClick={() => { setSelected(null); setForm(empty); }}>Cancel</button>
      </div>
    </div>
  ) : null;

  return (
    <div className="sc-page-stack">
      <div className="sc-page-header-card">
        <div><div className="sc-kicker">Inventory Admin</div><h2>Edit Blank Items</h2><p>Search, clean up, and maintain blank product records used by receiving, pull sheets, purchasing, and reports.</p></div>
      </div>

      {message && <div className="sc-alert">{message}</div>}

      <section className="sc-panel">
        <div className="sc-toolbar">
          <input className="sc-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU, name, barcode, brand, style, color, or size..." onKeyDown={(e) => { if (e.key === 'Enter') loadRows(); }} />
          <button className="sc-btn sc-btn-primary" onClick={loadRows} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          <span className="sc-toolbar__hint">Choose Edit for one item. Check multiple rows for bulk changes below the list.</span>
        </div>
        <div className="sc-responsive-table-wrap">
          <table className="sc-table">
            <thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible blank products" /></th><th>Image</th><th>SKU</th><th>Name</th><th>Brand</th><th>Style</th><th>Color</th><th>Size</th><th>Cost</th><th>Low Stock</th><th></th></tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const id = normalizeRowId(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr className={selected?.id === row.id ? 'sc-row-being-edited' : ''}>
                      <td><input type="checkbox" checked={selectedSet.has(id)} onChange={() => toggleRow(row)} aria-label={`Select ${row.sku_base || row.name || 'blank product'}`} /></td>
                      <td>{row.image_url ? <img className="sc-thumb sc-thumb-small" src={row.image_url} alt="" /> : <span className="sc-muted">No image</span>}</td>
                      <td>{row.sku_base || '—'}</td>
                      <td>{row.name || '—'}</td>
                      <td>{row.brand || row.brands?.name || '—'}</td>
                      <td>{row.product_type || row.product_types?.name || '—'}</td>
                      <td>{row.color || row.colors?.name || '—'}</td>
                      <td>{row.size || row.sizes?.name || '—'}</td>
                      <td>{formatCost(row.unit_cost)}</td>
                      <td>{row.low_stock_threshold ?? '—'}</td>
                      <td><button className="sc-btn sc-btn-small" onClick={() => startEdit(row)}>{selected?.id === row.id ? 'Editing' : 'Edit'}</button></td>
                    </tr>
                    {selected?.id === row.id ? (
                      <TableInlineEditorRow
                        colSpan={11}
                        title={`Edit ${row.sku_base || row.name || 'blank product'}`}
                        description="This editor belongs only to the selected row. Required matching fields are Brand, Style, Color, and Size."
                      >
                        {singleItemEditor}
                      </TableInlineEditorRow>
                    ) : null}
                  </Fragment>
                );
              })}
              {!visibleRows.length && <tr><td colSpan="11" className="sc-empty-cell">No blank products found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sc-panel sc-bulk-editor-section">
        <div className="sc-panel-header">
          <div>
            <h3>Bulk Edit Selected Blank Items</h3>
            <p>This bottom section applies only to the rows checked in the list above.</p>
          </div>
          <div className="sc-kpi-pill">{selectedIds.length} selected</div>
        </div>

        <div className="sc-form-grid sc-form-grid--compact">
          <label className="sc-field sc-checkbox-field">
            <span><input type="checkbox" checked={bulkForm.updateLowStockThreshold} onChange={(e) => setBulkForm({ ...bulkForm, updateLowStockThreshold: e.target.checked })} />Update low-stock threshold</span>
            <input type="number" min="0" value={bulkForm.lowStockThreshold} disabled={!bulkForm.updateLowStockThreshold} placeholder="Leave blank to clear threshold" onChange={(e) => setBulkForm({ ...bulkForm, lowStockThreshold: e.target.value })} />
          </label>
          <label className="sc-field sc-field-wide sc-checkbox-field">
            <span><input type="checkbox" checked={bulkForm.updateImageUrl} onChange={(e) => setBulkForm({ ...bulkForm, updateImageUrl: e.target.checked })} />Update product image URL</span>
            <input value={bulkForm.imageUrl} disabled={!bulkForm.updateImageUrl || bulkForm.clearImageUrl} placeholder="https://..." onChange={(e) => setBulkForm({ ...bulkForm, imageUrl: e.target.value })} />
          </label>
          <label className="sc-field sc-checkbox-field">
            <span><input type="checkbox" checked={bulkForm.clearImageUrl} disabled={!bulkForm.updateImageUrl} onChange={(e) => setBulkForm({ ...bulkForm, clearImageUrl: e.target.checked })} />Clear existing image URL</span>
            {bulkForm.updateImageUrl && bulkForm.imageUrl && !bulkForm.clearImageUrl ? <img className="sc-thumb" src={bulkForm.imageUrl} alt="Bulk image preview" /> : <div className="sc-muted">Optional image preview appears here.</div>}
          </label>
        </div>

        <div className="sc-form-actions">
          <button className="sc-btn" onClick={selectVisible} disabled={!visibleRows.length || bulkLoading}>Select Visible</button>
          <button className="sc-btn" onClick={clearSelection} disabled={!selectedIds.length || bulkLoading}>Clear Selection</button>
          <button className="sc-btn sc-btn-primary" onClick={applyBulkEdit} disabled={!selectedIds.length || bulkLoading}>{bulkLoading ? 'Applying...' : 'Apply Bulk Edit'}</button>
        </div>
        {selectedRows.length > 0 ? <p className="sc-muted">Selected: {selectedRows.slice(0, 4).map((row) => row.sku_base || row.name).join(', ')}{selectedRows.length > 4 ? `, +${selectedRows.length - 4} more` : ''}</p> : null}
      </section>
    </div>
  );
}
