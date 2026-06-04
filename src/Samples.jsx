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
      setMessage('Sample saved to sample_products.');
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
      await load('');
    } catch (err) {
      setMessage(err.message || 'Failed to save sample.');
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
            Manually track sample blanks that are not linked to WooCommerce,
            blank products, finished products, or inventory movement records.
          </p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <form onSubmit={submit} className="card elevated-card">
        <h2>Create New Sample</h2>

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
            placeholder="Fit notes, test print notes, supplier notes, etc."
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Save Sample'}
        </button>
      </form>

      <form onSubmit={runSearch} className="card">
        <h2>Search Sample Products</h2>

        <div className="inline-form-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brand, style, color, vendor, size, product type, customer, notes..."
          />
          <button type="submit">Search</button>
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
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.brand}</td>
                  <td>{row.style}</td>
                  <td>{row.price != null ? money(row.price) : ''}</td>
                  <td>{row.vendor}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td>{row.product_type}</td>
                  <td>{row.customer}</td>
                  <td>{row.notes}</td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan="10">No sample products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
    </main>
  );
}
