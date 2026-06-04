import { useEffect, useState } from 'react';
import {
  createStandaloneSampleProduct,
  getStandaloneSampleProducts,
  money,
} from './lib/inventoryApi';

export default function Samples() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    brand: '',
    style: '',
    color: '',
    vendor: '',
    price: '',
    size: '',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(term = search) {
    try {
      const data = await getStandaloneSampleProducts(term);
      setRows(data);
    } catch (err) {
      setMessage(err.message || 'Failed to load sample products.');
    }
  }

  useEffect(() => {
    load('');
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      await createStandaloneSampleProduct(form);
      setMessage('Standalone sample product saved.');
      setForm({
        brand: '',
        style: '',
        color: '',
        vendor: '',
        price: '',
        size: '',
        notes: '',
      });
      await load('');
    } catch (err) {
      setMessage(err.message || 'Failed to save standalone sample product.');
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(event) {
    event.preventDefault();
    await load(search);
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Samples</p>
          <h1>Standalone Sample Products</h1>
          <p>
            Track sample blanks that are not tied to WooCommerce products, blank inventory,
            pull sheets, or any existing blank product record.
          </p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <form onSubmit={submit} className="card elevated-card">
        <h2>Create Standalone Sample</h2>

        <div className="form-grid">
          <label>
            Brand
            <input
              value={form.brand}
              onChange={(event) => updateField('brand', event.target.value)}
              placeholder="Example: Next Level"
              required
            />
          </label>

          <label>
            Style
            <input
              value={form.style}
              onChange={(event) => updateField('style', event.target.value)}
              placeholder="Example: 6210"
              required
            />
          </label>

          <label>
            Color
            <input
              value={form.color}
              onChange={(event) => updateField('color', event.target.value)}
              placeholder="Example: Heather Gray"
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
            Vendor
            <input
              value={form.vendor}
              onChange={(event) => updateField('vendor', event.target.value)}
              placeholder="Example: SanMar"
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
        </div>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder="Optional notes about fit, supplier, test print, customer feedback, etc."
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Save Standalone Sample'}
        </button>
      </form>

      <form onSubmit={runSearch} className="card">
        <h2>Sample Product List</h2>

        <div className="inline-form-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search samples by brand, style, color, vendor, size, notes..."
          />
          <button type="submit">Search</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Style</th>
                <th>Color</th>
                <th>Size</th>
                <th>Vendor</th>
                <th>Price</th>
                <th>Notes</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.brand}</td>
                  <td>{row.style}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td>{row.vendor}</td>
                  <td>{row.price != null ? money(row.price) : ''}</td>
                  <td>{row.notes}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan="8">No standalone samples found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
    </main>
  );
}
