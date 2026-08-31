import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionButton, FieldGrid, FormField, HelpPanel, MetricCard,
  PageHeader, ResponsiveTable, SectionCard, StatusBadge,
} from './components/UIPrimitives';
import {
  applyNewProductLine, getNewProductLineHistory, getNewProductLineLookups, previewNewProductLine,
} from './lib/newProductLineApi';
import './NewProductLineSetup.css';

const emptyForm = {
  line_name: '', brand_id: '', product_type_id: '', color_ids: [], size_ids: [],
  unit_cost: '0.00', low_stock_threshold: '0', cost_review_required: true,
};

function itemLabel(item) {
  return item?.code ? `${item.name} (${item.code})` : item?.name || 'Unnamed';
}

function MultiChooser({ label, items, selected, onChange, filter, setFilter }) {
  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? items.filter((item) => `${item.name} ${item.code || ''}`.toLowerCase().includes(term)) : items;
  }, [filter, items]);
  const selectedSet = new Set(selected.map(String));
  function toggle(id) {
    const key = String(id);
    onChange(selectedSet.has(key) ? selected.filter((value) => String(value) !== key) : [...selected, id]);
  }
  return (
    <fieldset className="npl-chooser">
      <legend>{label} <span>{selected.length} selected</span></legend>
      <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Filter ${label.toLowerCase()}`} />
      <div className="npl-chooser__actions">
        <button type="button" onClick={() => onChange([...new Set([...selected, ...visible.map((item) => item.id)])])}>Select visible</button>
        <button type="button" onClick={() => onChange([])}>Clear</button>
      </div>
      <div className="npl-chooser__options">
        {visible.map((item) => (
          <label key={item.id}>
            <input type="checkbox" checked={selectedSet.has(String(item.id))} onChange={() => toggle(item.id)} />
            <span>{itemLabel(item)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function NewProductLineSetup() {
  const [form, setForm] = useState(emptyForm);
  const [lookups, setLookups] = useState({ brands: [], styles: [], colors: [], sizes: [] });
  const [history, setHistory] = useState([]);
  const [colorFilter, setColorFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getNewProductLineLookups(), getNewProductLineHistory(25)])
      .then(([lookupData, historyData]) => {
        if (!active) return;
        setLookups(lookupData || { brands: [], styles: [], colors: [], sizes: [] });
        setHistory(historyData || []);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setPreview(null); setConfirmed(false); setResult(null); setError('');
  }

  async function runPreview(event) {
    event.preventDefault(); setWorking(true); setError(''); setResult(null); setConfirmed(false);
    try { setPreview(await previewNewProductLine(form)); }
    catch (err) { setPreview(null); setError(err.message); }
    finally { setWorking(false); }
  }

  async function apply() {
    if (!preview?.safe_to_apply || !confirmed) return;
    setWorking(true); setError('');
    try {
      const applied = await applyNewProductLine({ ...form, preview_token: preview.preview_token });
      setResult(applied); setPreview(null); setConfirmed(false);
      setHistory(await getNewProductLineHistory(25));
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  const summary = preview?.summary || {};
  return (
    <main className="page npl-page">
      <PageHeader eyebrow="Catalog setup" title="New Product Line Setup" description="Create the complete blank color-and-size matrix before adding or syncing the finished WooCommerce product." />
      <HelpPanel title="Safe setup workflow">
        <p>This creates catalog definitions at <strong>zero on hand</strong>. It never records receiving, changes bin counts, or invents stock. Exact existing blanks are reused; duplicate, archived, and SKU conflicts stop the setup for review.</p>
      </HelpPanel>
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {result ? (
        <div className="notice success" role="status">
          <strong>{result.message}</strong> No inventory movement was created. Next, run <Link to="/woo-sync">WooCommerce Sync</Link>, then review <Link to="/product-blank-mappings">Product-to-Blank Mappings</Link>.
        </div>
      ) : null}

      <form onSubmit={runPreview}>
        <SectionCard title="1. Define the blank product line" description="Choose one brand and style, then every color and size you plan to sell or stock.">
          <FieldGrid>
            <FormField label="Product-line name" required help="Example: Gildan 6400 Softstyle Tee">
              <input value={form.line_name} onChange={(event) => update('line_name', event.target.value)} required />
            </FormField>
            <FormField label="Brand" required>
              <select value={form.brand_id} onChange={(event) => update('brand_id', event.target.value)} required>
                <option value="">Choose brand</option>
                {lookups.brands.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}
              </select>
            </FormField>
            <FormField label="Style" required>
              <select value={form.product_type_id} onChange={(event) => update('product_type_id', event.target.value)} required>
                <option value="">Choose style</option>
                {lookups.styles.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}
              </select>
            </FormField>
            <FormField label="Unit cost" required help="Use 0.00 only when the cost is unknown, and keep cost review checked.">
              <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(event) => update('unit_cost', event.target.value)} required />
            </FormField>
            <FormField label="Low-stock threshold">
              <input type="number" min="0" step="1" value={form.low_stock_threshold} onChange={(event) => update('low_stock_threshold', event.target.value)} />
            </FormField>
            <FormField label="Cost review">
              <label className="npl-inline-check"><input type="checkbox" checked={form.cost_review_required} onChange={(event) => update('cost_review_required', event.target.checked)} /> Mark these blanks for cost review</label>
            </FormField>
          </FieldGrid>
          <div className="npl-chooser-grid">
            <MultiChooser label="Colors" items={lookups.colors} selected={form.color_ids} onChange={(value) => update('color_ids', value)} filter={colorFilter} setFilter={setColorFilter} />
            <MultiChooser label="Sizes" items={lookups.sizes} selected={form.size_ids} onChange={(value) => update('size_ids', value)} filter={sizeFilter} setFilter={setSizeFilter} />
          </div>
          <div className="npl-form-actions"><ActionButton tone="primary" disabled={loading || working}>{working ? 'Checking…' : 'Preview product line'}</ActionButton></div>
        </SectionCard>
      </form>

      {preview ? (
        <SectionCard title="2. Review before creating" description="Nothing has been changed yet. Every combination must be safe before Apply becomes available.">
          <div className="npl-metrics">
            <MetricCard label="Combinations" value={summary.total || 0} />
            <MetricCard label="Will create" value={summary.create_count || 0} tone="success" />
            <MetricCard label="Will reuse" value={summary.existing_count || 0} tone="info" />
            <MetricCard label="Blocked" value={summary.blocked_count || 0} tone={summary.blocked_count ? 'danger' : 'success'} />
            <MetricCard label="Woo rows found" value={summary.woo_match_count || 0} />
          </div>
          <ResponsiveTable>
            <thead><tr><th>Status</th><th>Color</th><th>Size</th><th>Generated blank SKU</th><th>Woo rows</th><th>Meaning</th></tr></thead>
            <tbody>{(preview.rows || []).map((row) => (
              <tr key={`${row.color_id}-${row.size_id}`}>
                <td><StatusBadge status={row.status} /></td><td>{row.color_name}</td><td>{row.size_name}</td><td>{row.sku_base}</td><td>{row.woo_match_count || 0}</td>
                <td>{row.status === 'create' ? 'Create zero-on-hand blank' : row.status === 'existing' ? 'Reuse exact active blank' : row.status === 'archived_match' ? 'Restore or replace the archived blank first' : row.status === 'ambiguous_active' ? 'Multiple active blanks have this identity' : 'Generated SKU belongs to another blank'}</td>
              </tr>
            ))}</tbody>
          </ResponsiveTable>
          {!preview.safe_to_apply ? <p className="npl-blocked">Apply is blocked. Resolve the listed rows in <Link to="/product-integrity">Product Integrity Center</Link> or <Link to="/inventory/edit-blanks">Edit Blank Items</Link>, then preview again.</p> : (
            <div className="npl-confirm">
              <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I reviewed the matrix and understand all new blanks start with zero inventory.</label>
              <ActionButton tone="primary" onClick={apply} disabled={!confirmed || working}>{working ? 'Creating…' : 'Create and link product line'}</ActionButton>
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="Recent product-line setups" description="An audit summary of the most recent completed setup operations.">
        <ResponsiveTable>
          <thead><tr><th>Date</th><th>Name</th><th>Brand / Style</th><th>Created</th><th>Reused</th><th>Woo linked</th></tr></thead>
          <tbody>{history.length ? history.map((row) => (
            <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.line_name}</td><td>{row.brands?.name || '—'} / {row.product_types?.name || '—'}</td><td>{row.created_count}</td><td>{row.reused_count}</td><td>{row.woo_products_linked}</td></tr>
          )) : <tr><td colSpan="6">No product lines have been created with this setup yet.</td></tr>}</tbody>
        </ResponsiveTable>
      </SectionCard>
    </main>
  );
}
