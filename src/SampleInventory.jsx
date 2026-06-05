import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import './standalone_samples_manual.css';

const DEFAULT_PRODUCT_TYPES = [
  'Sublimation',
  'Tee',
  'Hoodie',
  'Crew Neck Sweatshirt',
  'Athletic Tee',
  '¼ Zip',
  'Full Zip Sweatshirt',
  'Hat',
  'Beanie',
  'Pant',
  'Short',
  'Polo',
  'Tank',
  'Jacket',
  'Vest',
  'Sock',
  'Jersey',
];

const EMPTY_FORM = {
  brand: '',
  style: '',
  price: '',
  vendor: '',
  color: '',
  size: '',
  productType: 'Tee',
  newProductType: '',
  customer: '',
  quantity: '1',
  binId: '',
  notes: '',
  imageFile: null,
};

const EMPTY_FILTERS = {
  brand: '',
  style: '',
  vendor: '',
  color: '',
  size: '',
  productType: '',
  customer: '',
  binId: '',
};

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return '';
  return number.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  });
}

function binLabel(bin) {
  if (!bin) return '';
  return [bin.bin_code, bin.label, bin.location].filter(Boolean).join(' - ') || `Bin ${bin.id}`;
}

function searchableText(row) {
  return [
    row.brand,
    row.style,
    row.price,
    row.vendor,
    row.color,
    row.size,
    row.product_type,
    row.customer,
    row.notes,
    row.bin_code,
    row.bin_label,
    row.bin_location,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();
}

function tokensMatch(row, search) {
  const tokens = search
    .toLowerCase()
    .split(/[^a-z0-9¼]+/i)
    .filter(Boolean);

  if (!tokens.length) return true;

  const text = searchableText(row);
  const normalized = text.replace(/[^a-z0-9]+/g, '');

  return tokens.every((token) => {
    const normalizedToken = token.replace(/[^a-z0-9]+/g, '');
    return text.includes(token) || normalized.includes(normalizedToken);
  });
}

function filtersMatch(row, filters) {
  const checks = [
    ['brand', row.brand],
    ['style', row.style],
    ['vendor', row.vendor],
    ['color', row.color],
    ['size', row.size],
    ['productType', row.product_type],
    ['customer', row.customer],
  ];

  const textMatch = checks.every(([key, value]) => {
    const filter = String(filters[key] || '').trim().toLowerCase();
    if (!filter) return true;
    return String(value || '').toLowerCase().includes(filter);
  });

  const binMatch = !filters.binId || String(row.bin_id || '') === String(filters.binId);

  return textMatch && binMatch;
}

export default function SampleInventory() {
  const [rows, setRows] = useState([]);
  const [bins, setBins] = useState([]);
  const [productTypes, setProductTypes] = useState(DEFAULT_PRODUCT_TYPES);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => tokensMatch(row, search) && filtersMatch(row, filters));
  }, [rows, search, filters]);

  async function loadProductTypes() {
    const { data, error } = await supabase
      .from('sample_product_types')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      // If SQL has not been run yet, keep default dropdown values.
      setProductTypes(DEFAULT_PRODUCT_TYPES);
      return;
    }

    const merged = Array.from(new Set([...DEFAULT_PRODUCT_TYPES, ...(data || []).map((row) => row.name).filter(Boolean)]));
    setProductTypes(merged.sort((a, b) => a.localeCompare(b)));
  }

  async function loadBins() {
    const { data, error } = await supabase
      .from('bins')
      .select('id, bin_code, label, location')
      .order('bin_code', { ascending: true });

    if (error) throw error;
    setBins(data || []);
  }

  async function loadSamples() {
    const { data, error } = await supabase
      .from('sample_products_with_bins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      const fallback = await supabase
        .from('sample_products')
        .select('id, brand, style, price, vendor, color, size, product_type, customer, quantity, bin_id, image_url, image_path, notes, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (fallback.error) throw fallback.error;
      setRows(fallback.data || []);
      return;
    }

    setRows(data || []);
  }

  async function loadAll() {
    await Promise.all([
      loadProductTypes(),
      loadBins(),
      loadSamples(),
    ]);
  }

  useEffect(() => {
    loadAll().catch((err) => {
      setMessage(err.message || 'Failed to load samples.');
    });
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateEditField(field, value) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function ensureProductType(name) {
    const cleaned = String(name || '').trim();
    if (!cleaned) return null;

    const { error } = await supabase
      .from('sample_product_types')
      .upsert({ name: cleaned }, { onConflict: 'name' });

    if (error) throw error;
    await loadProductTypes();
    return cleaned;
  }

  async function uploadImage(file) {
    if (!file) return { image_url: null, image_path: null };

    const safeName = file.name.replace(/[^a-z0-9.\-_]+/gi, '-').toLowerCase();
    const imagePath = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('sample-product-images')
      .upload(imagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('sample-product-images')
      .getPublicUrl(imagePath);

    return {
      image_url: data?.publicUrl || null,
      image_path: imagePath,
    };
  }

  function buildPayload(source, imageInfo = {}) {
    const selectedType = source.productType === '__new__'
      ? source.newProductType
      : source.productType;

    const payload = {
      brand: source.brand.trim(),
      style: source.style.trim(),
      price: source.price === '' ? null : Number(source.price),
      vendor: source.vendor.trim() || null,
      color: source.color.trim(),
      size: source.size.trim(),
      product_type: String(selectedType || '').trim() || null,
      customer: source.customer.trim() || null,
      quantity: source.quantity === '' ? 1 : Number(source.quantity),
      bin_id: source.binId ? Number(source.binId) : null,
      notes: source.notes.trim() || null,
    };

    if (imageInfo.image_url !== undefined) payload.image_url = imageInfo.image_url;
    if (imageInfo.image_path !== undefined) payload.image_path = imageInfo.image_path;

    if (!payload.brand) throw new Error('Brand is required.');
    if (!payload.style) throw new Error('Style is required.');
    if (!payload.color) throw new Error('Color is required.');
    if (!payload.size) throw new Error('Size is required.');
    if (!payload.product_type) throw new Error('Product type is required.');
    if (payload.price !== null && Number.isNaN(payload.price)) throw new Error('Price must be a number.');
    if (Number.isNaN(payload.quantity) || payload.quantity < 0) throw new Error('Quantity must be zero or greater.');

    return payload;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const imageInfo = await uploadImage(form.imageFile);
      const payload = buildPayload(form, imageInfo);

      await ensureProductType(payload.product_type);

      const { error } = await supabase
        .from('sample_products')
        .insert(payload);

      if (error) throw error;

      setForm(EMPTY_FORM);
      setMessage('Sample saved.');
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to save sample.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditForm({
      brand: row.brand || '',
      style: row.style || '',
      price: row.price ?? '',
      vendor: row.vendor || '',
      color: row.color || '',
      size: row.size || '',
      productType: row.product_type || 'Tee',
      newProductType: '',
      customer: row.customer || '',
      quantity: row.quantity ?? 1,
      binId: row.bin_id || '',
      notes: row.notes || '',
      imageFile: null,
    });
  }

  async function saveEdit(row) {
    setBusy(true);
    setMessage('');

    try {
      const imageInfo = editForm.imageFile
        ? await uploadImage(editForm.imageFile)
        : {};

      const payload = buildPayload(editForm, imageInfo);
      await ensureProductType(payload.product_type);

      const { error } = await supabase
        .from('sample_products')
        .update(payload)
        .eq('id', row.id);

      if (error) throw error;

      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setMessage('Sample updated.');
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to update sample.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSample(row) {
    const confirmed = window.confirm(`Delete sample product ${row.brand || ''} ${row.style || ''}? This cannot be undone.`);
    if (!confirmed) return;

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('sample_products')
        .delete()
        .eq('id', row.id);

      if (error) throw error;

      if (row.image_path) {
        await supabase.storage.from('sample-product-images').remove([row.image_path]);
      }

      setMessage('Sample deleted.');
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to delete sample.');
    } finally {
      setBusy(false);
    }
  }

  function printReport() {
    const htmlRows = filteredRows.map((row) => `
      <tr>
        <td>${row.brand || ''}</td>
        <td>${row.style || ''}</td>
        <td>${row.product_type || ''}</td>
        <td>${row.color || ''}</td>
        <td>${row.size || ''}</td>
        <td>${row.vendor || ''}</td>
        <td>${row.customer || ''}</td>
        <td>${row.quantity ?? ''}</td>
        <td>${row.bin_code || row.bin_label || ''}</td>
        <td>${row.price ?? ''}</td>
        <td>${row.notes || ''}</td>
      </tr>
    `).join('');

    const filterSummary = Object.entries(filters)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ') || 'All sample products';

    const report = window.open('', '_blank');
    report.document.write(`
      <html>
        <head>
          <title>Sample Products Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 4px; }
            .filters { margin-bottom: 18px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
            th { background: #ede7f6; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Print</button>
          <h1>Sample Products Report</h1>
          <p class="filters">${filterSummary}</p>
          <table>
            <thead>
              <tr>
                <th>Brand</th><th>Style</th><th>Product Type</th><th>Color</th><th>Size</th>
                <th>Vendor</th><th>Customer</th><th>Qty</th><th>Bin</th><th>Price</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>${htmlRows || '<tr><td colspan="11">No matching sample products.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    report.document.close();
  }

  function renderProductTypeControl(value, onChange, newValue, onNewChange) {
    return (
      <>
        <select value={value} onChange={(event) => onChange(event.target.value)} required>
          <option value="">Choose type...</option>
          {productTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
          <option value="__new__">+ Create new type</option>
        </select>
        {value === '__new__' && (
          <input
            value={newValue}
            onChange={(event) => onNewChange(event.target.value)}
            placeholder="Enter new product type"
            required
          />
        )}
      </>
    );
  }

  return (
    <main className="page sample-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Samples</p>
          <h1>Standalone Sample Products</h1>
          <p>
            Manually track sample products that are not linked to WooCommerce blanks or finished products.
            Samples can now be assigned to bins, include photos, edited, deleted, and reported.
          </p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card">
        <h2>Create New Sample</h2>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Brand
              <input value={form.brand} onChange={(event) => updateField('brand', event.target.value)} required />
            </label>

            <label>
              Style
              <input value={form.style} onChange={(event) => updateField('style', event.target.value)} required />
            </label>

            <label>
              Product Type
              {renderProductTypeControl(
                form.productType,
                (value) => updateField('productType', value),
                form.newProductType,
                (value) => updateField('newProductType', value)
              )}
            </label>

            <label>
              Price
              <input type="number" step="0.01" min="0" value={form.price} onChange={(event) => updateField('price', event.target.value)} />
            </label>

            <label>
              Vendor
              <input value={form.vendor} onChange={(event) => updateField('vendor', event.target.value)} />
            </label>

            <label>
              Color
              <input value={form.color} onChange={(event) => updateField('color', event.target.value)} required />
            </label>

            <label>
              Size
              <input value={form.size} onChange={(event) => updateField('size', event.target.value)} required />
            </label>

            <label>
              Quantity
              <input type="number" min="0" step="1" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} />
            </label>

            <label>
              Bin
              <select value={form.binId} onChange={(event) => updateField('binId', event.target.value)}>
                <option value="">No bin selected</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>{binLabel(bin)}</option>
                ))}
              </select>
            </label>

            <label>
              Customer
              <input value={form.customer} onChange={(event) => updateField('customer', event.target.value)} />
            </label>

            <label>
              Product Image
              <input type="file" accept="image/*" onChange={(event) => updateField('imageFile', event.target.files?.[0] || null)} />
            </label>
          </div>

          <label>
            Notes
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save Sample'}
          </button>
        </form>
      </section>

      <section className="card elevated-card">
        <h2>Custom Sample Report Filters</h2>
        <p className="helper-text">Enter any combination of attributes, then print the filtered sample product report.</p>
        <div className="form-grid">
          <label>Brand<input value={filters.brand} onChange={(event) => updateFilter('brand', event.target.value)} /></label>
          <label>Style<input value={filters.style} onChange={(event) => updateFilter('style', event.target.value)} /></label>
          <label>Vendor<input value={filters.vendor} onChange={(event) => updateFilter('vendor', event.target.value)} /></label>
          <label>Color<input value={filters.color} onChange={(event) => updateFilter('color', event.target.value)} /></label>
          <label>Size<input value={filters.size} onChange={(event) => updateFilter('size', event.target.value)} /></label>
          <label>Product Type<input value={filters.productType} onChange={(event) => updateFilter('productType', event.target.value)} /></label>
          <label>Customer<input value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} /></label>
          <label>
            Bin
            <select value={filters.binId} onChange={(event) => updateFilter('binId', event.target.value)}>
              <option value="">Any bin</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>{binLabel(bin)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-form-row">
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>Clear Filters</button>
          <button type="button" onClick={printReport}>Print Report ({filteredRows.length})</button>
        </div>
      </section>

      <section className="card">
        <h2>Search Sample Products</h2>

        <div className="inline-form-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand, style, price, vendor, color, size, product type, customer, notes, bin..."
          />
          <button type="button" onClick={() => setSearch('')}>Clear</button>
        </div>

        <div className="table-wrap sample-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Brand</th>
                <th>Style</th>
                <th>Price</th>
                <th>Vendor</th>
                <th>Color</th>
                <th>Size</th>
                <th>Product Type</th>
                <th>Customer</th>
                <th>Qty</th>
                <th>Bin</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const editing = editingId === row.id;

                return (
                  <tr key={row.id}>
                    <td>
                      {row.image_url ? <img src={row.image_url} alt="" className="sample-thumb" /> : <span className="muted">No image</span>}
                      {editing && <input type="file" accept="image/*" onChange={(event) => updateEditField('imageFile', event.target.files?.[0] || null)} />}
                    </td>
                    <td>{editing ? <input value={editForm.brand} onChange={(event) => updateEditField('brand', event.target.value)} /> : row.brand}</td>
                    <td>{editing ? <input value={editForm.style} onChange={(event) => updateEditField('style', event.target.value)} /> : row.style}</td>
                    <td>{editing ? <input type="number" step="0.01" min="0" value={editForm.price} onChange={(event) => updateEditField('price', event.target.value)} /> : formatMoney(row.price)}</td>
                    <td>{editing ? <input value={editForm.vendor} onChange={(event) => updateEditField('vendor', event.target.value)} /> : row.vendor}</td>
                    <td>{editing ? <input value={editForm.color} onChange={(event) => updateEditField('color', event.target.value)} /> : row.color}</td>
                    <td>{editing ? <input value={editForm.size} onChange={(event) => updateEditField('size', event.target.value)} /> : row.size}</td>
                    <td>
                      {editing ? renderProductTypeControl(
                        editForm.productType,
                        (value) => updateEditField('productType', value),
                        editForm.newProductType,
                        (value) => updateEditField('newProductType', value)
                      ) : row.product_type}
                    </td>
                    <td>{editing ? <input value={editForm.customer} onChange={(event) => updateEditField('customer', event.target.value)} /> : row.customer}</td>
                    <td>{editing ? <input type="number" min="0" step="1" value={editForm.quantity} onChange={(event) => updateEditField('quantity', event.target.value)} /> : row.quantity}</td>
                    <td>
                      {editing ? (
                        <select value={editForm.binId} onChange={(event) => updateEditField('binId', event.target.value)}>
                          <option value="">No bin selected</option>
                          {bins.map((bin) => (
                            <option key={bin.id} value={bin.id}>{binLabel(bin)}</option>
                          ))}
                        </select>
                      ) : (row.bin_code || row.bin_label || row.bin_location || '')}
                    </td>
                    <td>{editing ? <textarea value={editForm.notes} onChange={(event) => updateEditField('notes', event.target.value)} /> : row.notes}</td>
                    <td>
                      {editing ? (
                        <div className="sample-action-stack">
                          <button type="button" disabled={busy} onClick={() => saveEdit(row)}>Save</button>
                          <button type="button" disabled={busy} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="sample-action-stack">
                          <button type="button" onClick={() => startEdit(row)}>Edit</button>
                          <button type="button" className="danger-button" onClick={() => deleteSample(row)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!filteredRows.length && (
                <tr>
                  <td colSpan="13">No sample products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
