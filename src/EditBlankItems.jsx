import { useEffect, useMemo, useState } from 'react';
import {
  bulkUpdateBlankProducts,
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  getBlankProductLookups,
  getBlankProducts,
  receiveBlankInventory,
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

const emptyBulkForm = {
  apply_brand_id: false,
  brand_id: '',
  apply_product_type_id: false,
  product_type_id: '',
  apply_color_id: false,
  color_id: '',
  apply_size_id: false,
  size_id: '',
  apply_unit_cost: false,
  unit_cost: '',
  apply_low_stock_threshold: false,
  low_stock_threshold: '',
  apply_image_url: false,
  image_url: '',
};

export default function EditBlankItems() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);
  const [lookups, setLookups] = useState({ brands: [], colors: [], sizes: [], productTypes: [] });
  const [bins, setBins] = useState([]);
  const [receiveDrafts, setReceiveDrafts] = useState({});
  const [receiveDefaults, setReceiveDefaults] = useState({ binId: '', quantity: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkReceiving, setBulkReceiving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedLabel = useMemo(() => selected ? formatBlankProductLabel(selected) : '', [selected]);
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  async function loadLookups() {
    setLookups(await getBlankProductLookups());
  }

  async function loadBins() {
    setBins(await getBins());
  }

  async function loadProducts(term = search) {
    setLoading(true);
    setMessage('');

    try {
      const products = await getBlankProducts(term);
      setRows(products);
      setReceiveDrafts((current) => {
        const next = {};
        products.forEach((product) => {
          next[product.id] = current[product.id] || { quantity: '', binId: '' };
        });
        return next;
      });
      setSelectedIds((current) => current.filter((id) => products.some((product) => product.id === id)));
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
    loadBins().catch((err) => setMessage(err.message || 'Failed to load bins.'));
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

  function updateBulkForm(key, value) {
    setBulkForm((current) => ({ ...current, [key]: value }));
  }

  function updateReceiveDraft(productId, key, value) {
    setReceiveDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] || { quantity: '', binId: '' }),
        [key]: value,
      },
    }));
  }

  function applyReceiveDefaultToVisible(key, value) {
    setReceiveDefaults((current) => ({ ...current, [key]: value }));
    setReceiveDrafts((current) => {
      const next = { ...current };
      rows.forEach((product) => {
        next[product.id] = {
          ...(next[product.id] || { quantity: '', binId: '' }),
          [key === 'binId' ? 'binId' : 'quantity']: value,
        };
      });
      return next;
    });
  }

  function clearReceiveDraftsForVisible() {
    setReceiveDrafts((current) => {
      const next = { ...current };
      rows.forEach((product) => {
        next[product.id] = { quantity: '', binId: '' };
      });
      return next;
    });
    setReceiveDefaults({ binId: '', quantity: '' });
  }

  function toggleSelected(productId) {
    setSelectedIds((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !rows.some((row) => row.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...rows.map((row) => row.id)])));
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

  async function handleBulkSave(event) {
    event.preventDefault();
    setMessage('');

    if (!selectedIds.length) {
      setMessage('Select at least one blank item to bulk edit.');
      return;
    }

    const changes = {};
    if (bulkForm.apply_brand_id) changes.brand_id = bulkForm.brand_id;
    if (bulkForm.apply_product_type_id) changes.product_type_id = bulkForm.product_type_id;
    if (bulkForm.apply_color_id) changes.color_id = bulkForm.color_id;
    if (bulkForm.apply_size_id) changes.size_id = bulkForm.size_id;
    if (bulkForm.apply_unit_cost) changes.unit_cost = bulkForm.unit_cost;
    if (bulkForm.apply_low_stock_threshold) changes.low_stock_threshold = bulkForm.low_stock_threshold;
    if (bulkForm.apply_image_url) changes.image_url = bulkForm.image_url;

    if (!Object.keys(changes).length) {
      setMessage('Choose at least one bulk edit field to apply.');
      return;
    }

    setBulkSaving(true);

    try {
      const updatedRows = await bulkUpdateBlankProducts(selectedIds, changes);
      setMessage(`Bulk updated ${updatedRows.length} blank item${updatedRows.length === 1 ? '' : 's'}.`);
      setBulkForm(emptyBulkForm);
      await loadProducts(search);
    } catch (err) {
      setMessage(err.message || 'Failed to bulk update blank items.');
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleBulkReceiveVisible(event) {
    event.preventDefault();
    setMessage('');

    const entries = rows
      .map((product) => ({ product, draft: receiveDrafts[product.id] || {} }))
      .filter(({ draft }) => String(draft.quantity || '').trim() !== '');

    if (!entries.length) {
      setMessage('Enter a quantity next to at least one displayed blank item.');
      return;
    }

    const invalid = entries.find(({ draft }) => {
      const quantity = Number(draft.quantity);
      return !draft.binId || Number.isNaN(quantity) || quantity <= 0;
    });

    if (invalid) {
      setMessage('Each row with a quantity must also have a bin, and quantity must be greater than zero.');
      return;
    }

    setBulkReceiving(true);

    const successes = [];
    const failures = [];

    for (const { product, draft } of entries) {
      try {
        await receiveBlankInventory({
          binId: draft.binId,
          blankProductId: product.id,
          quantity: Number(draft.quantity),
          notes: `Bulk added from Edit Blank Items search${search?.trim() ? `: ${search.trim()}` : ''}`,
        });
        successes.push(product.id);
      } catch (err) {
        failures.push({ product, error: err.message || 'Unknown error' });
      }
    }

    setBulkReceiving(false);

    if (failures.length) {
      setMessage(`Added ${successes.length} item${successes.length === 1 ? '' : 's'}, but ${failures.length} failed. First error: ${failures[0].product.sku_base || failures[0].product.name}: ${failures[0].error}`);
      return;
    }

    setReceiveDrafts((current) => {
      const next = { ...current };
      successes.forEach((id) => {
        next[id] = { quantity: '', binId: '' };
      });
      return next;
    });

    setMessage(`Added inventory for ${successes.length} displayed blank item${successes.length === 1 ? '' : 's'}.`);
    await loadProducts(search);
  }

  return (
    <main className="page edit-blank-items-page">
      <h1>Edit Blank Items</h1>
      <p className="helper-text">
        Search for existing blank items, edit product details, bulk edit selected rows, or add quantities for displayed search results into bins.
      </p>

      <section className="content-two-column edit-blank-layout">
        <div className="card">
          <h2>Find Blank Items</h2>
          <form onSubmit={handleSearch} className="inline-search-form">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, brand, style, color, size..."
            />
            <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          </form>

          <div className="bulk-selection-toolbar">
            <label>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
              />
              Select all visible
            </label>
            <button type="button" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>Clear selection</button>
            <span>{selectedIds.length} selected</span>
          </div>

          <form onSubmit={handleBulkReceiveVisible} className="bulk-receive-visible-form">
            <h3>Add Displayed Items to Bins</h3>
            <p className="helper-text">Enter quantities and choose bins beside each displayed item below. Rows with blank quantities will be skipped.</p>
            <div className="bulk-receive-defaults">
              <label>
                Apply bin to visible rows
                <select
                  value={receiveDefaults.binId}
                  onChange={(event) => applyReceiveDefaultToVisible('binId', event.target.value)}
                >
                  <option value="">Choose bin...</option>
                  {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
                </select>
              </label>
              <label>
                Apply quantity to visible rows
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={receiveDefaults.quantity}
                  onChange={(event) => applyReceiveDefaultToVisible('quantity', event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="bulk-receive-actions">
              <button type="submit" disabled={!rows.length || bulkReceiving}>
                {bulkReceiving ? 'Adding inventory...' : 'Add Entered Quantities'}
              </button>
              <button type="button" className="secondary-button" onClick={clearReceiveDraftsForVisible} disabled={!rows.length || bulkReceiving}>
                Clear Qty/Bins
              </button>
            </div>
          </form>

          <div className="blank-edit-results">
            {rows.length === 0 ? (
              <p>No blank items found.</p>
            ) : rows.map((product) => (
              <div
                key={product.id}
                className={`result-row editable-result-row ${selected?.id === product.id ? 'selected' : ''}`}
                role="button"
                tabIndex="0"
                onClick={() => selectProduct(product)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') selectProduct(product);
                }}
              >
                <label className="row-select" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => toggleSelected(product.id)}
                  />
                </label>
                <div className="blank-result-main">
                  <div className="blank-result-details">
                    <strong>{product.sku_base}</strong>
                    <span>{formatBlankProductLabel(product)}</span>
                    <small>
                      Cost: {product.unit_cost == null ? '$0.00' : Number(product.unit_cost).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                      {' · '}Low stock: {product.low_stock_threshold ?? 'Not set'}
                    </small>
                  </div>
                  <div className="result-receive-controls" onClick={(event) => event.stopPropagation()}>
                    <label>
                      Qty to add
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={receiveDrafts[product.id]?.quantity || ''}
                        onChange={(event) => updateReceiveDraft(product.id, 'quantity', event.target.value)}
                        placeholder="0"
                      />
                    </label>
                    <label>
                      Bin
                      <select
                        value={receiveDrafts[product.id]?.binId || ''}
                        onChange={(event) => updateReceiveDraft(product.id, 'binId', event.target.value)}
                      >
                        <option value="">Choose bin...</option>
                        {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="edit-blank-side-panel">
          <form onSubmit={handleBulkSave} className="card bulk-edit-form">
            <h2>Bulk Edit Selected</h2>
            <p className="helper-text">Only checked fields below will be applied to the selected blank items.</p>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_brand_id} onChange={(event) => updateBulkForm('apply_brand_id', event.target.checked)} /> Brand</label>
              <select value={bulkForm.brand_id} onChange={(event) => updateBulkForm('brand_id', event.target.value)} disabled={!bulkForm.apply_brand_id}>
                <option value="">Clear brand</option>
                {lookups.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_product_type_id} onChange={(event) => updateBulkForm('apply_product_type_id', event.target.checked)} /> Product Type / Style</label>
              <select value={bulkForm.product_type_id} onChange={(event) => updateBulkForm('product_type_id', event.target.value)} disabled={!bulkForm.apply_product_type_id}>
                <option value="">Clear product type</option>
                {lookups.productTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_color_id} onChange={(event) => updateBulkForm('apply_color_id', event.target.checked)} /> Color</label>
              <select value={bulkForm.color_id} onChange={(event) => updateBulkForm('color_id', event.target.value)} disabled={!bulkForm.apply_color_id}>
                <option value="">Clear color</option>
                {lookups.colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_size_id} onChange={(event) => updateBulkForm('apply_size_id', event.target.checked)} /> Size</label>
              <select value={bulkForm.size_id} onChange={(event) => updateBulkForm('size_id', event.target.value)} disabled={!bulkForm.apply_size_id}>
                <option value="">Clear size</option>
                {lookups.sizes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_unit_cost} onChange={(event) => updateBulkForm('apply_unit_cost', event.target.checked)} /> Unit Cost</label>
              <input type="number" min="0" step="0.01" value={bulkForm.unit_cost} onChange={(event) => updateBulkForm('unit_cost', event.target.value)} disabled={!bulkForm.apply_unit_cost} placeholder="0.00" />
            </div>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_low_stock_threshold} onChange={(event) => updateBulkForm('apply_low_stock_threshold', event.target.checked)} /> Low-Stock Threshold</label>
              <input type="number" min="0" step="1" value={bulkForm.low_stock_threshold} onChange={(event) => updateBulkForm('low_stock_threshold', event.target.value)} disabled={!bulkForm.apply_low_stock_threshold} placeholder="Blank clears value" />
            </div>

            <div className="bulk-field">
              <label><input type="checkbox" checked={bulkForm.apply_image_url} onChange={(event) => updateBulkForm('apply_image_url', event.target.checked)} /> Image URL</label>
              <input value={bulkForm.image_url} onChange={(event) => updateBulkForm('image_url', event.target.value)} disabled={!bulkForm.apply_image_url} placeholder="Blank clears image URL" />
            </div>

            <button type="submit" disabled={!selectedIds.length || bulkSaving}>{bulkSaving ? 'Applying...' : `Apply to ${selectedIds.length} Selected`}</button>
          </form>

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
        </div>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
