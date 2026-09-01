
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { deleteOperationalAsset, operationalAssetUrls, uploadOperationalImage } from './lib/assetStorageApi';
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

const EMPTY_BULK_FORM = {
  binId: '',
  productType: '',
  newProductType: '',
  customer: '',
  vendor: '',
  notes: '',
  notesMode: 'none',
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

function sampleBinLabel(row) {
  return [row.bin_code, row.bin_label, row.bin_location].filter(Boolean).join(' - ');
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

function imageAlt(row) {
  return [row.brand, row.style, row.color, row.size].filter(Boolean).join(' ') || 'Sample product image';
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
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM);
  const [selectedIds, setSelectedIds] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => tokensMatch(row, search) && filtersMatch(row, filters));
  }, [rows, search, filters]);

  const visibleIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);

  const selectedRows = useMemo(() => {
    const selectedSet = new Set(selectedIds.map(String));
    return rows.filter((row) => selectedSet.has(String(row.id)));
  }, [rows, selectedIds]);

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.map(String).includes(String(id)));

  const loadProductTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('sample_product_types')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      setProductTypes(DEFAULT_PRODUCT_TYPES);
      return;
    }

    const merged = Array.from(new Set([...DEFAULT_PRODUCT_TYPES, ...(data || []).map((row) => row.name).filter(Boolean)]));
    setProductTypes(merged.sort((a, b) => a.localeCompare(b)));
  }, []);

  const loadBins = useCallback(async () => {
    const { data, error } = await supabase
      .from('bins')
      .select('id, bin_code, label, location')
      .order('bin_code', { ascending: true });

    if (error) throw error;
    setBins(data || []);
  }, []);

  const loadSamples = useCallback(async () => {
    const { data, error } = await supabase
      .from('sample_products_with_bins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      const fallback = await supabase
        .from('sample_products')
        .select('id, brand, style, price, vendor, color, size, product_type, customer, quantity, bin_id, image_url, image_path, image_storage_provider, image_storage_bucket, image_file_size_bytes, image_mime_type, preview_storage_provider, preview_storage_bucket, preview_storage_path, preview_size_bytes, notes, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (fallback.error) throw fallback.error;
      const fallbackRows = fallback.data || [];
      const urls = await operationalAssetUrls(fallbackRows, {
        urlField: 'image_url', providerField: 'image_storage_provider', bucketField: 'image_storage_bucket', pathField: 'image_path',
      });
      setRows(fallbackRows.map((row) => ({ ...row, _display_image_url: urls[String(row.id)] || row.image_url || '' })));
      return;
    }

    const loadedRows = data || [];
    const urls = await operationalAssetUrls(loadedRows, {
      urlField: 'image_url', providerField: 'image_storage_provider', bucketField: 'image_storage_bucket', pathField: 'image_path',
    });
    setRows(loadedRows.map((row) => ({ ...row, _display_image_url: urls[String(row.id)] || row.image_url || '' })));
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadProductTypes(),
      loadBins(),
      loadSamples(),
    ]);
  }, [loadProductTypes, loadBins, loadSamples]);

  useEffect(() => {
    loadAll().catch((err) => {
      setMessage(err.message || 'Failed to load samples.');
    });
  }, [loadAll]);

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

  function updateBulkField(field, value) {
    setBulkForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSelected(rowId) {
    setSelectedIds((current) => {
      const exists = current.map(String).includes(String(rowId));
      if (exists) return current.filter((id) => String(id) !== String(rowId));
      return [...current, rowId];
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const currentSet = new Set(current.map(String));
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => currentSet.has(String(id)));

      if (allSelected) {
        return current.filter((id) => !visibleIds.map(String).includes(String(id)));
      }

      const merged = [...current];
      visibleIds.forEach((id) => {
        if (!merged.map(String).includes(String(id))) merged.push(id);
      });
      return merged;
    });
  }

  function clearSelection() {
    setSelectedIds([]);
    setBulkForm(EMPTY_BULK_FORM);
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
    const stored = await uploadOperationalImage(file, 'samples');
    return {
      image_url: null,
      image_storage_provider: stored.storage_provider,
      image_storage_bucket: stored.storage_bucket,
      image_path: stored.storage_path,
      image_file_size_bytes: stored.file_size_bytes,
      image_mime_type: stored.mime_type,
      preview_storage_provider: stored.preview_storage_provider,
      preview_storage_bucket: stored.preview_storage_bucket,
      preview_storage_path: stored.preview_storage_path,
      preview_size_bytes: stored.preview_size_bytes,
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

    for (const field of [
      'image_url', 'image_storage_provider', 'image_storage_bucket', 'image_path', 'image_file_size_bytes', 'image_mime_type',
      'preview_storage_provider', 'preview_storage_bucket', 'preview_storage_path', 'preview_size_bytes',
    ]) if (imageInfo[field] !== undefined) payload[field] = imageInfo[field];

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
    let imageInfo = null;

    try {
      imageInfo = await uploadImage(form.imageFile);
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
      if (imageInfo?.image_path) {
        await deleteOperationalAsset(imageInfo, {
          providerField: 'image_storage_provider', bucketField: 'image_storage_bucket', pathField: 'image_path',
        }).catch(() => {});
      }
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
    let imageInfo = null;

    try {
      imageInfo = editForm.imageFile
        ? await uploadImage(editForm.imageFile)
        : {};

      const payload = buildPayload(editForm, imageInfo);
      await ensureProductType(payload.product_type);

      const { error } = await supabase
        .from('sample_products')
        .update(payload)
        .eq('id', row.id);

      if (error) throw error;

      if (editForm.imageFile && row.image_path) {
        await deleteOperationalAsset(row, {
          providerField: 'image_storage_provider', bucketField: 'image_storage_bucket', pathField: 'image_path',
          legacyBucket: 'sample-product-images',
        }).catch((cleanupError) => console.warn('Old sample image cleanup failed:', cleanupError));
      }

      setEditingId(null);
      setEditForm(EMPTY_FORM);
      setMessage('Sample updated.');
      await loadAll();
    } catch (err) {
      if (imageInfo?.image_path) {
        await deleteOperationalAsset(imageInfo, {
          providerField: 'image_storage_provider', bucketField: 'image_storage_bucket', pathField: 'image_path',
        }).catch(() => {});
      }
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

      await deleteOperationalAsset(row, {
        providerField: 'image_storage_provider', bucketField: 'image_storage_bucket', pathField: 'image_path',
        legacyBucket: 'sample-product-images',
      }).catch((cleanupError) => console.warn('Deleted sample image cleanup failed:', cleanupError));

      setMessage('Sample deleted.');
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to delete sample.');
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkEdit(event) {
    event.preventDefault();

    if (!selectedIds.length) {
      setMessage('Select at least one sample before using bulk edit.');
      return;
    }

    const updatePayload = {};

    if (bulkForm.binId !== '') {
      updatePayload.bin_id = bulkForm.binId === '__none__' ? null : Number(bulkForm.binId);
    }

    const selectedProductType = bulkForm.productType === '__new__'
      ? bulkForm.newProductType
      : bulkForm.productType;

    if (String(selectedProductType || '').trim()) {
      const cleanedType = await ensureProductType(selectedProductType);
      updatePayload.product_type = cleanedType;
    }

    if (bulkForm.customer.trim()) {
      updatePayload.customer = bulkForm.customer.trim();
    }

    if (bulkForm.vendor.trim()) {
      updatePayload.vendor = bulkForm.vendor.trim();
    }

    if (bulkForm.notesMode !== 'none') {
      const noteText = bulkForm.notes.trim();

      if (bulkForm.notesMode === 'replace') {
        updatePayload.notes = noteText || null;
      } else if (bulkForm.notesMode === 'append' && noteText) {
        updatePayload.notes = null;
      }
    }

    const hasStandardUpdates = Object.keys(updatePayload).some((key) => !(key === 'notes' && bulkForm.notesMode === 'append'));

    if (!hasStandardUpdates && !(bulkForm.notesMode === 'append' && bulkForm.notes.trim())) {
      setMessage('Choose at least one bulk edit value before applying changes.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (hasStandardUpdates) {
        const payloadWithoutAppendPlaceholder = { ...updatePayload };
        if (bulkForm.notesMode === 'append') delete payloadWithoutAppendPlaceholder.notes;

        if (Object.keys(payloadWithoutAppendPlaceholder).length) {
          const { error } = await supabase
            .from('sample_products')
            .update(payloadWithoutAppendPlaceholder)
            .in('id', selectedIds);

          if (error) throw error;
        }
      }

      if (bulkForm.notesMode === 'append' && bulkForm.notes.trim()) {
        await Promise.all(selectedRows.map(async (row) => {
          const existingNotes = String(row.notes || '').trim();
          const nextNotes = existingNotes
            ? `${existingNotes}\n${bulkForm.notes.trim()}`
            : bulkForm.notes.trim();

          const { error } = await supabase
            .from('sample_products')
            .update({ notes: nextNotes })
            .eq('id', row.id);

          if (error) throw error;
        }));
      }

      setMessage(`Bulk edit applied to ${selectedIds.length} sample item(s).`);
      clearSelection();
      await loadAll();
    } catch (err) {
      setMessage(err.message || 'Failed to apply bulk edit.');
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
        <td>${sampleBinLabel(row) || ''}</td>
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

  function renderThumbnail(row) {
    if (!row._display_image_url) return <span className="muted">No image</span>;

    return (
      <button
        type="button"
        className="sample-thumb-button"
        onClick={() => setImagePreview(row)}
        title="Click to enlarge image"
      >
        <img src={row._display_image_url} alt={imageAlt(row)} className="sample-thumb sample-thumb-small" loading="lazy" decoding="async" />
      </button>
    );
  }

  return (
    <main className="page sample-page sample-page-only">
      <SamplePageScopedStyles />

      <section className="page-header">
        <div>
          <p className="eyebrow">Samples</p>
          <h1>Standalone Sample Products</h1>
          <p>
            Manually track sample products that are not linked to WooCommerce blanks or finished products.
            Samples can be assigned to bins, include photos, edited, deleted, bulk edited, and reported.
          </p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      {imagePreview && (
        <div className="sample-image-modal" role="dialog" aria-modal="true" aria-label="Sample image preview">
          <div className="sample-image-modal-backdrop" onClick={() => setImagePreview(null)} />
          <div className="sample-image-modal-card">
            <div className="sample-image-modal-header">
              <div>
                <h2>{imageAlt(imagePreview)}</h2>
                <p>{[imagePreview.product_type, sampleBinLabel(imagePreview)].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => setImagePreview(null)}>Close</button>
            </div>
            <img src={imagePreview._display_image_url} alt={imageAlt(imagePreview)} />
          </div>
        </div>
      )}

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

      <section className="card elevated-card sample-bulk-card">
        <div className="sample-bulk-header">
          <div>
            <h2>Bulk Edit Selected Samples</h2>
            <p className="helper-text">
              Select sample rows below, then use this panel to assign a bin or update common details.
            </p>
          </div>
          <strong>{selectedIds.length} selected</strong>
        </div>

        <form onSubmit={applyBulkEdit}>
          <div className="form-grid">
            <label>
              Assign Bin
              <select value={bulkForm.binId} onChange={(event) => updateBulkField('binId', event.target.value)}>
                <option value="">Leave bin unchanged</option>
                <option value="__none__">Remove bin assignment</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>{binLabel(bin)}</option>
                ))}
              </select>
            </label>

            <label>
              Product Type
              <select value={bulkForm.productType} onChange={(event) => updateBulkField('productType', event.target.value)}>
                <option value="">Leave type unchanged</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="__new__">+ Create new type</option>
              </select>
              {bulkForm.productType === '__new__' && (
                <input
                  value={bulkForm.newProductType}
                  onChange={(event) => updateBulkField('newProductType', event.target.value)}
                  placeholder="Enter new product type"
                />
              )}
            </label>

            <label>
              Customer
              <input
                value={bulkForm.customer}
                onChange={(event) => updateBulkField('customer', event.target.value)}
                placeholder="Leave blank to keep current"
              />
            </label>

            <label>
              Vendor
              <input
                value={bulkForm.vendor}
                onChange={(event) => updateBulkField('vendor', event.target.value)}
                placeholder="Leave blank to keep current"
              />
            </label>

            <label>
              Notes Action
              <select value={bulkForm.notesMode} onChange={(event) => updateBulkField('notesMode', event.target.value)}>
                <option value="none">Leave notes unchanged</option>
                <option value="append">Append note</option>
                <option value="replace">Replace notes</option>
              </select>
            </label>
          </div>

          <label>
            Bulk Notes
            <textarea
              value={bulkForm.notes}
              onChange={(event) => updateBulkField('notes', event.target.value)}
              placeholder="Used only when Notes Action is Append or Replace"
            />
          </label>

          <div className="inline-form-row">
            <button type="submit" disabled={busy || !selectedIds.length}>
              {busy ? 'Applying...' : `Apply to ${selectedIds.length} Selected`}
            </button>
            <button type="button" onClick={clearSelection} disabled={!selectedIds.length || busy}>
              Clear Selection
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Search Sample Products</h2>

        <div className="inline-form-row sample-search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand, style, price, vendor, color, size, product type, customer, notes, bin..."
          />
          <button type="button" onClick={() => setSearch('')}>Clear</button>
          <button type="button" onClick={toggleAllVisible}>
            {allVisibleSelected ? 'Unselect Visible' : `Select Visible (${filteredRows.length})`}
          </button>
        </div>

        <div className="table-wrap sample-table-wrap">
          <table className="sample-inventory-table">
            <thead>
              <tr>
                <th className="sample-select-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all visible sample products"
                  />
                </th>
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
                const selected = selectedIds.map(String).includes(String(row.id));

                return (
                  <tr key={row.id} className={selected ? 'sample-row-selected' : ''}>
                    <td className="sample-select-cell">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`Select ${imageAlt(row)}`}
                      />
                    </td>
                    <td>
                      {renderThumbnail(row)}
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
                      ) : (sampleBinLabel(row) || '')}
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
                  <td colSpan="14">No sample products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SamplePageScopedStyles() {
  return (
    <style>{`
      .sample-page-only .sample-table-wrap {
        overflow-x: auto;
      }

      .sample-page-only .sample-inventory-table {
        min-width: 1180px;
      }

      .sample-page-only .sample-select-cell {
        width: 42px;
        text-align: center;
      }

      .sample-page-only .sample-row-selected {
        background: rgba(37, 99, 235, 0.06);
      }

      .sample-page-only .sample-thumb-button {
        border: 0;
        padding: 0;
        background: transparent;
        cursor: zoom-in;
        display: inline-flex;
        border-radius: 12px;
      }

      .sample-page-only .sample-thumb-small,
      .sample-page-only img.sample-thumb.sample-thumb-small {
        width: 56px !important;
        height: 56px !important;
        max-width: 56px !important;
        max-height: 56px !important;
        object-fit: cover;
        border-radius: 12px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
        display: block;
      }

      .sample-page-only .sample-thumb-button:hover .sample-thumb-small {
        transform: scale(1.04);
      }

      .sample-page-only .sample-bulk-card {
        border: 1px solid rgba(37, 99, 235, 0.14);
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 24rem),
          #ffffff;
      }

      .sample-page-only .sample-bulk-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }

      .sample-page-only .sample-bulk-header strong {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 110px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.10);
        color: #1d4ed8;
        font-weight: 900;
      }

      .sample-page-only .sample-search-row {
        align-items: stretch;
      }

      .sample-page-only .sample-search-row input {
        min-width: min(100%, 460px);
      }

      .sample-image-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .sample-image-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(4px);
      }

      .sample-image-modal-card {
        position: relative;
        z-index: 1;
        width: min(980px, 96vw);
        max-height: 92vh;
        overflow: auto;
        border-radius: 24px;
        background: #ffffff;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.32);
        padding: 18px;
      }

      .sample-image-modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }

      .sample-image-modal-header h2 {
        margin: 0;
      }

      .sample-image-modal-header p {
        margin: 4px 0 0;
        color: #64748b;
      }

      .sample-image-modal-card > img {
        width: 100%;
        max-height: 72vh;
        object-fit: contain;
        border-radius: 18px;
        background: #f8fafc;
      }

      html[data-theme="dark"] .sample-page-only .sample-bulk-card,
      body[data-theme="dark"] .sample-page-only .sample-bulk-card,
      html[data-theme="dark"] .sample-image-modal-card,
      body[data-theme="dark"] .sample-image-modal-card {
        background: #111827;
        color: #f8fafc;
      }

      html[data-theme="dark"] .sample-image-modal-header p,
      body[data-theme="dark"] .sample-image-modal-header p {
        color: #a8b3c7;
      }

      @media (max-width: 760px) {
        .sample-page-only .sample-bulk-header {
          display: grid;
        }

        .sample-page-only .sample-bulk-header strong {
          width: fit-content;
        }

        .sample-image-modal {
          padding: 12px;
        }
      }
    `}</style>
  );
}
