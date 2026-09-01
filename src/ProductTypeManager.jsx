import { useEffect, useMemo, useState } from 'react';
import {
  assignProductType,
  createProductType,
  getProductTypeManagerSummary,
  scanProductTypeWooMatches,
} from './lib/productTypeManagerApi';
import './ProductTypeManager.css';

const text = (value) => String(value ?? '').trim();

export default function ProductTypeManager() {
  const [summary, setSummary] = useState({ item_types: [], groups: [] });
  const [wooMatches, setWooMatches] = useState({});
  const [brandFilter, setBrandFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('unclassified');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [targetType, setTargetType] = useState('');
  const [syncWoo, setSyncWoo] = useState(true);
  const [newTypeName, setNewTypeName] = useState('');
  const [sort, setSort] = useState({ field: 'brand_name', direction: 'asc' });
  const [loading, setLoading] = useState(false);
  const [wooLoading, setWooLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await getProductTypeManagerSummary();
      setSummary(data || { item_types: [], groups: [] });
      setSelected((current) => current.filter((key) => (data?.groups || []).some((row) => row.key === key)));
    } catch (error) {
      setMessage(error.message || 'Could not load Product Type Manager. Run SQL 56 first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const brands = useMemo(() => [...new Set((summary.groups || []).map((row) => row.brand_name).filter(Boolean))].sort(), [summary.groups]);
  const visible = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const rows = (summary.groups || []).filter((row) => {
      if (brandFilter && row.brand_name !== brandFilter) return false;
      if (typeFilter === 'unclassified' && row.item_type_id) return false;
      if (typeFilter && typeFilter !== 'all' && typeFilter !== 'unclassified' && String(row.item_type_id || '') !== String(typeFilter)) return false;
      if (needle && !`${row.brand_name} ${row.brand_code} ${row.style_name} ${row.style_code} ${row.item_type_name}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const direction = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const left = sort.field === 'woo_count' ? Number(wooMatches[a.key]?.woo_count || 0) : text(a[sort.field]).toLowerCase();
      const right = sort.field === 'woo_count' ? Number(wooMatches[b.key]?.woo_count || 0) : text(b[sort.field]).toLowerCase();
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * direction;
    });
  }, [summary.groups, brandFilter, typeFilter, search, sort, wooMatches]);

  const visibleKeys = visible.map((row) => row.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selected.includes(key));
  const unclassified = (summary.groups || []).filter((row) => !row.item_type_id).length;

  function toggleSort(field) {
    setSort((current) => current.field === field
      ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'asc' });
  }

  function toggleRow(key) {
    setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  function toggleVisible() {
    setSelected((current) => {
      if (allVisibleSelected) return current.filter((key) => !visibleKeys.includes(key));
      return [...new Set([...current, ...visibleKeys])];
    });
  }

  async function scanWoo() {
    setWooLoading(true);
    setMessage('Scanning WooCommerce products for Brand + Style matches…');
    try {
      const result = await scanProductTypeWooMatches();
      setWooMatches(Object.fromEntries((result?.matches || []).map((row) => [row.key, row])));
      setMessage(`WooCommerce scan complete. ${(result?.matches || []).reduce((sum, row) => sum + Number(row.woo_count || 0), 0)} matching product assignment(s) found.`);
    } catch (error) {
      setMessage(error.message || 'WooCommerce product scan failed.');
    } finally {
      setWooLoading(false);
    }
  }

  async function createType() {
    if (!newTypeName.trim()) { setMessage('Enter a new product type name first.'); return; }
    setSaving(true);
    setMessage('');
    try {
      const result = await createProductType({ name: newTypeName });
      await load();
      setTargetType(String(result.type.id));
      setNewTypeName('');
      setMessage(result.created ? `Created product type “${result.type.name}”. It is ready to apply.` : `“${result.type.name}” already existed and is selected.`);
    } catch (error) {
      setMessage(error.message || 'Could not create product type.');
    } finally {
      setSaving(false);
    }
  }

  async function applyType() {
    if (!selected.length) { setMessage('Select one or more Brand + Style rows.'); return; }
    if (!targetType) { setMessage('Choose the product type to apply.'); return; }
    const pairs = selected.map((key) => {
      const row = (summary.groups || []).find((item) => item.key === key);
      return row ? { brand_id: row.brand_id, product_type_id: row.style_id } : null;
    }).filter(Boolean);
    setSaving(true);
    setMessage(syncWoo ? 'Applying product type and synchronizing matching WooCommerce products…' : 'Applying product type…');
    try {
      const result = await assignProductType({ item_type_id: targetType, pairs, sync_woo: syncWoo });
      await load();
      setSelected([]);
      if (Object.keys(wooMatches).length) await scanWoo();
      const woo = result.woo || {};
      const failureText = woo.failures?.length ? ` ${woo.failures.length} WooCommerce update error(s) need review.` : '';
      setMessage(`Applied “${result.item_type.name}” to ${result.assigned_pairs} Brand + Style row(s). WooCommerce matched ${woo.matched || 0} product(s) and updated ${woo.updated || 0}.${failureText}`);
    } catch (error) {
      setMessage(error.message || 'Product type assignment failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sc-page-stack product-type-manager">
      <div className="sc-page-header-card">
        <div>
          <div className="sc-kicker">Catalog Classification</div>
          <h2>Product Type Manager</h2>
          <p>Classify each Brand + Style as Hoodie, Tee, Drinkware, etc. The assignment drives the On-site Sales Type → Brand → Style picker and can synchronize matching existing WooCommerce products.</p>
        </div>
        <div className="product-type-header-actions">
          <button className="sc-btn secondary" type="button" onClick={scanWoo} disabled={wooLoading || loading}>{wooLoading ? 'Scanning Woo…' : 'Scan Woo Matches'}</button>
          <button className="sc-btn" type="button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>

      {message && <div className="sc-alert">{message}</div>}

      <section className="sc-stat-grid compact">
        <article className="sc-stat-card"><span>Brand + Style Rows</span><strong>{summary.groups.length}</strong><small>Active blank catalog</small></article>
        <article className="sc-stat-card"><span>Unclassified</span><strong>{unclassified}</strong><small>Need an Item Type</small></article>
        <article className="sc-stat-card"><span>Selected</span><strong>{selected.length}</strong><small>Bulk assignment target</small></article>
        <article className="sc-stat-card"><span>Available Types</span><strong>{summary.item_types.length}</strong><small>Includes custom types</small></article>
      </section>

      <section className="sc-panel product-type-create-panel">
        <div className="sc-panel-header"><div><h3>Create a new type</h3><p>Add a reusable On-site Sales product type such as Apron, Blanket, or Tote.</p></div></div>
        <div className="product-type-inline-form">
          <input value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} placeholder="New type name" maxLength={120} />
          <button className="sc-btn" type="button" onClick={createType} disabled={saving || !newTypeName.trim()}>Create Type</button>
        </div>
      </section>

      <section className="sc-panel">
        <div className="sc-panel-header product-type-filter-header">
          <div><h3>Brand + Style assignments</h3><p>Filter or sort the catalog, select rows, then apply one type to all selected styles.</p></div>
          <div className="product-type-filters">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brand or style…" />
            <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}><option value="">All brands</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="unclassified">Unclassified</option>{summary.item_types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
          </div>
        </div>

        <div className="product-type-bulk-bar">
          <label><span>Apply type</span><select value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="">Choose type…</option>{summary.item_types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
          <label className="product-type-check"><input type="checkbox" checked={syncWoo} onChange={(event) => setSyncWoo(event.target.checked)} /> Sync matching existing WooCommerce products</label>
          <button className="sc-btn" type="button" onClick={applyType} disabled={saving || !selected.length || !targetType}>{saving ? 'Applying…' : `Apply to ${selected.length || 0} selected`}</button>
          {selected.length > 0 && <button className="sc-btn secondary" type="button" onClick={() => setSelected([])} disabled={saving}>Clear selection</button>}
        </div>

        <div className="sc-responsive-table-wrap">
          <table className="sc-table product-type-table">
            <thead><tr>
              <th><input type="checkbox" aria-label="Select all visible rows" checked={allVisibleSelected} onChange={toggleVisible} /></th>
              <th><button type="button" onClick={() => toggleSort('brand_name')}>Brand ↕</button></th>
              <th><button type="button" onClick={() => toggleSort('style_name')}>Style ↕</button></th>
              <th><button type="button" onClick={() => toggleSort('item_type_name')}>Current Type ↕</button></th>
              <th>Blank Variants</th>
              <th><button type="button" onClick={() => toggleSort('woo_count')}>Woo Products ↕</button></th>
            </tr></thead>
            <tbody>
              {visible.map((row) => {
                const woo = wooMatches[row.key];
                return <tr key={row.key} className={!row.item_type_id ? 'product-type-unclassified' : ''}>
                  <td><input type="checkbox" checked={selected.includes(row.key)} onChange={() => toggleRow(row.key)} /></td>
                  <td><strong>{row.brand_name}</strong>{row.brand_code && row.brand_code !== row.brand_name ? <small>{row.brand_code}</small> : null}</td>
                  <td><strong>{row.style_name}</strong>{row.style_code && row.style_code !== row.style_name ? <small>{row.style_code}</small> : null}</td>
                  <td>{row.item_type_name ? <span className="sc-badge success">{row.item_type_name}</span> : <span className="sc-badge warning">Unclassified</span>}{row.mapping_source === 'legacy_style' ? <small>Legacy style-level assignment</small> : null}</td>
                  <td>{row.blank_count}</td>
                  <td>{woo ? <><strong>{woo.woo_count}</strong>{woo.woo_products?.length ? <small title={woo.woo_products.map((product) => product.name).join('\n')}>matched</small> : null}</> : <span className="muted-text">Not scanned</span>}</td>
                </tr>;
              })}
              {!visible.length && <tr><td colSpan="6" className="sc-empty-cell">No Brand + Style rows match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sc-panel product-type-note">
        <h3>What this changes</h3>
        <p>Assignments classify the entire Brand + Style combination, so every color and size of that blank inherits the same On-site Sales type. Inventory quantities, costs, SKUs, colors, and sizes are not changed. WooCommerce synchronization writes the same type to the matching parent product as the private <code>_sc_blank_item_type</code> metadata used by Mockup Studio and as a hidden <strong>Item Type</strong> product attribute.</p>
      </section>
    </div>
  );
}
