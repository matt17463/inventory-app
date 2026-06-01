import { useEffect, useMemo, useState } from 'react';
import {
  formatBlankProductLabel,
  getBlankProductLookups,
  getBlankProducts,
  updateBlankProduct,
} from './lib/inventoryApi';

function moneyInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return '';
  return number.toFixed(2);
}

function numberInput(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function buildSkuFromParts({ brands, productTypes, colors, sizes, form }) {
  const brand = brands.find((item) => String(item.id) === String(form.brand_id));
  const type = productTypes.find((item) => String(item.id) === String(form.product_type_id));
  const color = colors.find((item) => String(item.id) === String(form.color_id));
  const size = sizes.find((item) => String(item.id) === String(form.size_id));

  return [brand, type, color, size]
    .map((item) => item?.code || item?.name)
    .filter(Boolean)
    .map((part) =>
      String(part)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .join('-');
}

const emptyForm = {
  sku_base: '',
  barcode: '',
  name: '',
  brand_id: '',
  product_type_id: '',
  color_id: '',
  size_id: '',
  image_url: '',
  unit_cost: '',
  low_stock_threshold: '',
};

export default function EditBlankItems() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [lookups, setLookups] = useState({ brands: [], colors: [], sizes: [], productTypes: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedLabel = useMemo(() => selected ? formatBlankProductLabel(selected) : '', [selected]);

  async function loadLookups() {
    setLookups(await getBlankProductLookups());
  }

  async function loadProducts(term = search) {
    setLoading(true);
    setMessage('');

    try {
      const products = await getBlankProducts(term);
      setRows(products);
      if (term?.trim()) {
        setMessage(`Found ${products.length} blank item${products.length === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      setMessage(err.message || 'Failed to load blank items.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups().catch((err) => setMessage(err.message || 'Failed to load lookup values.'));
    loadProducts('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectProduct(product) {
    setSelected(product);
    setForm({
      sku_base: product.sku_base || '',
      barcode: product.barcode || '',
      name: product.name || '',
      brand_id: product.brand_id || '',
      product_type_id: product.product_type_id || '',
      color_id: product.color_id || '',
      size_id: product.size_id || '',
      image_url: product.image_url || '',
      unit_cost: moneyInput(product.unit_cost),
      low_stock_threshold: numberInput(product.low_stock_threshold),
    });
    setMessage('');
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function fillSkuBase() {
    const sku = buildSkuFromParts({ ...lookups, form });
    if (!sku) {
      setMessage('Choose brand, product type, color, and size first.');
      return;
    }
    updateForm('sku_base', sku);
  }

  async function handleSearch(event) {
    event.preventDefault();
    await loadProducts(search);
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage('');

    if (!selected?.id) {
      setMessage('Choose a blank item to edit.');
      return;
    }

    if (!form.sku_base.trim()) {
      setMessage('SKU Base is required.');
      return;
    }

    if (!form.name.trim()) {
      setMessage('Item Name is required.');
      return;
    }

    const unitCost = form.unit_cost === '' ? null : Number(form.unit_cost);
    if (unitCost !== null && (Number.isNaN(unitCost) || unitCost < 0)) {
      setMessage('Unit cost must be zero or greater.');
      return;
    }

    const lowStock = form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold);
    if (lowStock !== null && (Number.isNaN(lowStock) || lowStock < 0)) {
      setMessage('Low-stock threshold must be zero or greater.');
      return;
    }

    setSaving(true);

    try {
      const updated = await updateBlankProduct(selected.id, {
        sku_base: form.sku_base,
        barcode: form.barcode,
        name: form.name,
        brand_id: form.brand_id,
        product_type_id: form.product_type_id,
        color_id: form.color_id,
        size_id: form.size_id,
        image_url: form.image_url,
        unit_cost: form.unit_cost,
        low_stock_threshold: form.low_stock_threshold,
      });

      setSelected(updated);
      setForm({
        sku_base: updated.sku_base || '',
        barcode: updated.barcode || '',
        name: updated.name || '',
        brand_id: updated.brand_id || '',
        product_type_id: updated.product_type_id || '',
        color_id: updated.color_id || '',
        size_id: updated.size_id || '',
        image_url: updated.image_url || '',
        unit_cost: moneyInput(updated.unit_cost),
        low_stock_threshold: numberInput(updated.low_stock_threshold),
      });
      setMessage('Blank item updated.');
      await loadProducts(search);
    } catch (err) {
      setMessage(err.message || 'Failed to update blank item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page edit-blank-items-page">
      <h1>Edit Blank Items</h1>
      <p className="helper-text">
        Search for an existing blank item, then update cost, barcode, reorder point, image, and lookup values.
      </p>

      <section className="content-two-column edit-blank-layout">
        <div className="card">
          <h2>Find Blank Item</h2>
          <form onSubmit={handleSearch} className="inline-search-form">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, brand, style, color, size..."
            />
            <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          </form>

          <div className="blank-edit-results">
            {rows.length === 0 ? (
              <p>No blank items found.</p>
            ) : rows.map((product) => (
              <button
                type="button"
                key={product.id}
                className={`result-row ${selected?.id === product.id ? 'selected' : ''}`}
                onClick={() => selectProduct(product)}
              >
                <strong>{product.sku_base}</strong>
                <span>{formatBlankProductLabel(product)}</span>
                <small>
                  Cost: {product.unit_cost == null ? '$0.00' : Number(product.unit_cost).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                  {' · '}Low stock: {product.low_stock_threshold ?? 'Not set'}
                </small>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSave} className="card edit-blank-form">
          <h2>{selected ? `Editing: ${selected.sku_base}` : 'Choose an item to edit'}</h2>
          {selectedLabel && <p className="helper-text">{selectedLabel}</p>}

          <label htmlFor="edit-brand">Brand</label>
          <select id="edit-brand" value={form.brand_id} onChange={(event) => updateForm('brand_id', event.target.value)} disabled={!selected}>
            <option value="">No brand</option>
            {lookups.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label htmlFor="edit-type">Product Type / Style</label>
          <select id="edit-type" value={form.product_type_id} onChange={(event) => updateForm('product_type_id', event.target.value)} disabled={!selected}>
            <option value="">No product type</option>
            {lookups.productTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label htmlFor="edit-color">Color</label>
          <select id="edit-color" value={form.color_id} onChange={(event) => updateForm('color_id', event.target.value)} disabled={!selected}>
            <option value="">No color</option>
            {lookups.colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label htmlFor="edit-size">Size</label>
          <select id="edit-size" value={form.size_id} onChange={(event) => updateForm('size_id', event.target.value)} disabled={!selected}>
            <option value="">No size</option>
            {lookups.sizes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <label htmlFor="edit-sku">SKU Base</label>
          <div className="input-with-button">
            <input id="edit-sku" value={form.sku_base} onChange={(event) => updateForm('sku_base', event.target.value)} disabled={!selected} required />
            <button type="button" onClick={fillSkuBase} disabled={!selected}>Generate</button>
          </div>

          <label htmlFor="edit-name">Item Name</label>
          <input id="edit-name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} disabled={!selected} required />

          <label htmlFor="edit-barcode">Barcode / Vendor SKU</label>
          <input id="edit-barcode" value={form.barcode} onChange={(event) => updateForm('barcode', event.target.value)} disabled={!selected} placeholder="Optional" />

          <label htmlFor="edit-unit-cost">Unit Cost</label>
          <input id="edit-unit-cost" type="number" min="0" step="0.01" value={form.unit_cost} onChange={(event) => updateForm('unit_cost', event.target.value)} disabled={!selected} placeholder="0.00" />
          <p className="helper-text">Used for inventory valuation. Example: 8.25</p>

          <label htmlFor="edit-low-stock">Low-Stock Threshold</label>
          <input id="edit-low-stock" type="number" min="0" step="1" value={form.low_stock_threshold} onChange={(event) => updateForm('low_stock_threshold', event.target.value)} disabled={!selected} placeholder="Example: 5" />

          <label htmlFor="edit-image">Image URL</label>
          <input id="edit-image" value={form.image_url} onChange={(event) => updateForm('image_url', event.target.value)} disabled={!selected} placeholder="https://..." />

          <button type="submit" disabled={!selected || saving}>{saving ? 'Saving...' : 'Save Blank Item'}</button>
        </form>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
