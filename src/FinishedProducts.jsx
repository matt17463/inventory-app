import { useEffect, useMemo, useState } from 'react';
import {
  createOrReceiveFinishedProduct,
  formatBinLabel,
  getBins,
  searchFinishedProductsForReceiving,
} from './lib/inventoryApi';

function formatFinishedLabel(row) {
  return [
    row.finished_sku || row.sku,
    row.name,
    row.customer_name,
    row.logo_name,
    row.brand,
    row.style,
    row.color,
    row.size,
    row.finished_on_hand != null ? `On hand: ${row.finished_on_hand}` : null,
  ].filter(Boolean).join(' / ');
}

export default function ReturnFinishedInventory() {
  const [mode, setMode] = useState('existing');
  const [search, setSearch] = useState('');
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [existingFinishedProductId, setExistingFinishedProductId] = useState('');
  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    finishedSku: '',
    name: '',
    customer: '',
    logo: '',
    brand: '',
    style: '',
    color: '',
    size: '',
    productType: '',
  });

  const selectedFinished = useMemo(
    () => finishedProducts.find((row) => String(row.finished_product_id || row.id) === String(existingFinishedProductId)),
    [finishedProducts, existingFinishedProductId]
  );

  useEffect(() => {
    getBins()
      .then(setBins)
      .catch((err) => setMessage(err.message || 'Failed to load bins.'));
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function runSearch(event) {
    event.preventDefault();
    setMessage('');
    setExistingFinishedProductId('');

    try {
      const rows = await searchFinishedProductsForReceiving(search);
      setFinishedProducts(rows);

      if (rows.length === 1) {
        setExistingFinishedProductId(rows[0].finished_product_id || rows[0].id);
      }

      setMessage(`Found ${rows.length} finished product(s).`);
    } catch (err) {
      setMessage(err.message || 'Finished product search failed.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      if (!binId) throw new Error('Choose a finished inventory bin.');
      if (!Number(quantity) || Number(quantity) <= 0) throw new Error('Quantity must be greater than zero.');

      if (mode === 'existing' && !existingFinishedProductId) {
        throw new Error('Choose an existing finished product or switch to Create New Finished Product.');
      }

      const result = await createOrReceiveFinishedProduct({
        existingFinishedProductId: mode === 'existing' ? existingFinishedProductId : null,
        finishedSku: form.finishedSku,
        name: form.name,
        customer: form.customer,
        logo: form.logo,
        brand: form.brand,
        style: form.style,
        color: form.color,
        size: form.size,
        productType: form.productType,
        binId,
        quantity,
        notes,
      });

      setMessage(`Finished inventory received. Method: ${result?.method || 'saved'}.`);
      setQuantity(1);
      setNotes('');

      if (mode === 'new') {
        setForm({
          finishedSku: '',
          name: '',
          customer: '',
          logo: '',
          brand: '',
          style: '',
          color: '',
          size: '',
          productType: '',
        });
      }
    } catch (err) {
      setMessage(err.message || 'Failed to add finished inventory.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Finished Inventory</p>
          <h1>Return / Add Finished Item to Inventory</h1>
          <p>
            Add existing finished products to a bin, or create a new finished product record
            and immediately assign it to a finished inventory bin.
          </p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card">
        <h2>Finished Product Source</h2>
        <div className="segmented-control">
          <button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>
            Use Existing Finished Product
          </button>
          <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>
            Create New Finished Product
          </button>
        </div>

        {mode === 'existing' && (
          <>
            <form onSubmit={runSearch}>
              <label>Search existing finished products</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search SKU, customer, logo, brand, color, size..."
              />
              <button type="submit">Search</button>
            </form>

            <label>Finished product</label>
            <select value={existingFinishedProductId} onChange={(event) => setExistingFinishedProductId(event.target.value)}>
              <option value="">Choose finished product...</option>
              {finishedProducts.map((row) => (
                <option key={row.finished_product_id || row.id} value={row.finished_product_id || row.id}>
                  {formatFinishedLabel(row)}
                </option>
              ))}
            </select>

            {selectedFinished && (
              <p className="helper-text">
                Selected: <strong>{formatFinishedLabel(selectedFinished)}</strong>
              </p>
            )}
          </>
        )}

        {mode === 'new' && (
          <div className="form-grid">
            <label>
              Finished SKU
              <input value={form.finishedSku} onChange={(event) => updateField('finishedSku', event.target.value)} placeholder="Optional; auto-generated if blank" />
            </label>

            <label>
              Product Name
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Example: Sidney Glen Black Hoodie YL" />
            </label>

            <label>
              Customer
              <input value={form.customer} onChange={(event) => updateField('customer', event.target.value)} />
            </label>

            <label>
              Logo / Design
              <input value={form.logo} onChange={(event) => updateField('logo', event.target.value)} />
            </label>

            <label>
              Brand
              <input value={form.brand} onChange={(event) => updateField('brand', event.target.value)} required />
            </label>

            <label>
              Style
              <input value={form.style} onChange={(event) => updateField('style', event.target.value)} required />
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
              Product Type
              <input value={form.productType} onChange={(event) => updateField('productType', event.target.value)} />
            </label>
          </div>
        )}
      </section>

      <form onSubmit={submit} className="card elevated-card">
        <h2>Receive to Finished Inventory Bin</h2>

        <label>Finished inventory bin</label>
        <select value={binId} onChange={(event) => setBinId(event.target.value)} required>
          <option value="">Choose bin...</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {formatBinLabel(bin)}
            </option>
          ))}
        </select>

        <div className="form-grid">
          <label>
            Quantity
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </label>

          <label>
            Notes
            <input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>

        <button type="submit" disabled={busy}>
          {busy ? 'Saving...' : 'Add Finished Inventory'}
        </button>
      </form>
    </main>
  );
}
