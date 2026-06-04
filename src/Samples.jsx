import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return '';
  return number.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  });
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
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase();
}

export default function Samples() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    brand: '',
    style: '',
    price: '',
    vendor: '',
    color: '',
    size: '',
    productType: '',
    customer: '',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredRows = useMemo(() => {
    const tokens = search
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);

    if (!tokens.length) return rows;

    return rows.filter((row) => {
      const text = searchableText(row);
      const normalized = text.replace(/[^a-z0-9]+/g, '');

      return tokens.every((token) => {
        const normalizedToken = token.replace(/[^a-z0-9]+/g, '');
        return text.includes(token) || normalized.includes(normalizedToken);
      });
    });
  }, [rows, search]);

  async function loadSamples() {
    const { data, error } = await supabase
      .from('sample_products')
      .select('id, brand, style, price, vendor, color, size, product_type, customer, notes, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) throw error;
    setRows(data || []);
  }

  useEffect(() => {
    loadSamples().catch((err) => {
      setMessage(err.message || 'Failed to load samples.');
    });
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const payload = {
        brand: form.brand.trim(),
        style: form.style.trim(),
        price: form.price === '' ? null : Number(form.price),
        vendor: form.vendor.trim() || null,
        color: form.color.trim(),
        size: form.size.trim(),
        product_type: form.productType.trim() || null,
        customer: form.customer.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (!payload.brand) throw new Error('Brand is required.');
      if (!payload.style) throw new Error('Style is required.');
      if (!payload.color) throw new Error('Color is required.');
      if (!payload.size) throw new Error('Size is required.');
      if (payload.price !== null && Number.isNaN(payload.price)) throw new Error('Price must be a number.');

      const { error } = await supabase
        .from('sample_products')
        .insert(payload);

      if (error) throw error;

      setForm({
        brand: '',
        style: '',
        price: '',
        vendor: '',
        color: '',
        size: '',
        productType: '',
        customer: '',
        notes: '',
      });

      setMessage('Sample saved.');
      await loadSamples();
    } catch (err) {
      setMessage(err.message || 'Failed to save sample.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Samples</p>
          <h1>Standalone Sample Products</h1>
          <p>
            Manually track sample items that are not linked to WooCommerce,
            blank products, finished products, bins, or inventory movements.
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
              <input
                value={form.brand}
                onChange={(event) => updateField('brand', event.target.value)}
                placeholder="Example: Bella Canvas"
                required
              />
            </label>

            <label>
              Style
              <input
                value={form.style}
                onChange={(event) => updateField('style', event.target.value)}
                placeholder="Example: 3001"
                required
              />
            </label>

            <label>
              Price
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                placeholder="0.00"
              />
            </label>

            <label>
              Vendor
              <input
                value={form.vendor}
                onChange={(event) => updateField('vendor', event.target.value)}
                placeholder="Example: SanMar"
              />
            </label>

            <label>
              Color
              <input
                value={form.color}
                onChange={(event) => updateField('color', event.target.value)}
                placeholder="Example: Black"
                required
              />
            </label>

            <label>
              Size
              <input
                value={form.size}
                onChange={(event) => updateField('size', event.target.value)}
                placeholder="Example: L"
                required
              />
            </label>

            <label>
              Product Type
              <input
                value={form.productType}
                onChange={(event) => updateField('productType', event.target.value)}
                placeholder="Example: Tee, Hoodie, Hat"
              />
            </label>

            <label>
              Customer
              <input
                value={form.customer}
                onChange={(event) => updateField('customer', event.target.value)}
                placeholder="Optional customer or intended use"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Fit notes, supplier notes, test print notes, etc."
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save Sample'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Search Sample Products</h2>

        <div className="inline-form-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand, style, price, vendor, color, size, product type, customer, notes..."
          />
          <button type="button" onClick={() => setSearch('')}>Clear</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Style</th>
                <th>Price</th>
                <th>Vendor</th>
                <th>Color</th>
                <th>Size</th>
                <th>Product Type</th>
                <th>Customer</th>
                <th>Notes</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.brand}</td>
                  <td>{row.style}</td>
                  <td>{formatMoney(row.price)}</td>
                  <td>{row.vendor}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td>{row.product_type}</td>
                  <td>{row.customer}</td>
                  <td>{row.notes}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}

              {!filteredRows.length && (
                <tr>
                  <td colSpan="10">No sample products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
