import { useEffect, useMemo, useState } from 'react';
import {
  createFinishedProductFromBlank,
  formatBinLabel,
  getBins,
  getFinishedProducts,
  searchBlankProductsForFinishedCreation,
} from './lib/inventoryApi';

function formatBlankLabel(blank) {
  return [
    blank.sku_base,
    blank.brand,
    blank.style,
    blank.color,
    blank.size,
    blank.on_hand_quantity != null ? `On hand: ${blank.on_hand_quantity}` : null,
  ].filter(Boolean).join(' / ');
}

export default function CreateFinishedFromBlank() {
  const [search, setSearch] = useState('');
  const [blankProducts, setBlankProducts] = useState([]);
  const [bins, setBins] = useState([]);
  const [blankProductId, setBlankProductId] = useState('');
  const [existingFinishedSearch, setExistingFinishedSearch] = useState('');
  const [existingFinishedProducts, setExistingFinishedProducts] = useState([]);
  const [existingFinishedProductId, setExistingFinishedProductId] = useState('');
  const [finishedBinId, setFinishedBinId] = useState('');
  const [blankBinId, setBlankBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [logoName, setLogoName] = useState('');
  const [decorationType, setDecorationType] = useState('');
  const [placement, setPlacement] = useState('');
  const [decorationSize, setDecorationSize] = useState('');
  const [deductBlank, setDeductBlank] = useState(true);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedBlank = useMemo(
    () => blankProducts.find((row) => String(row.blank_product_id || row.id) === String(blankProductId)),
    [blankProducts, blankProductId]
  );

  const selectedExistingFinished = useMemo(
    () => existingFinishedProducts.find((row) => String(row.finished_product_id || row.id) === String(existingFinishedProductId)),
    [existingFinishedProducts, existingFinishedProductId]
  );

  async function loadInitial() {
    try {
      const [binRows, blankRows, finishedRows] = await Promise.all([
        getBins(),
        searchBlankProductsForFinishedCreation(''),
        getFinishedProducts(''),
      ]);
      setBins(binRows);
      setBlankProducts(blankRows);
      setExistingFinishedProducts(finishedRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load page data.');
    }
  }

  useEffect(() => { loadInitial(); }, []);

  async function runSearch(event) {
    event.preventDefault();
    setMessage('');
    try {
      const rows = await searchBlankProductsForFinishedCreation(search);
      setBlankProducts(rows);
      setMessage(`Found ${rows.length} blank product(s).`);
    } catch (err) {
      setMessage(err.message || 'Blank product search failed.');
    }
  }

  async function runExistingFinishedSearch(event) {
    event.preventDefault();
    setMessage('');
    try {
      const rows = await getFinishedProducts(existingFinishedSearch);
      setExistingFinishedProducts(rows);
      setMessage(`Found ${rows.length} existing finished product(s).`);
    } catch (err) {
      setMessage(err.message || 'Existing finished product search failed.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await createFinishedProductFromBlank({
        blankProductId,
        existingFinishedProductId: existingFinishedProductId || null,
        finishedBinId,
        quantity: Number(quantity),
        customerName,
        logoName,
        decorationType,
        placement,
        decorationSize,
        notes,
        deductBlank,
        blankBinId: deductBlank ? blankBinId : null,
      });
      setMessage(`Finished product created/received. SKU: ${result?.finished_sku || 'created'}`);
      setQuantity(1);
      setNotes('');
    } catch (err) {
      setMessage(err.message || 'Failed to create finished product.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Finished Inventory</p>
          <h1>Create Finished Product from Blank</h1>
          <p>Create finished inventory outside of an order or pullsheet.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <form onSubmit={runSearch} className="card elevated-card">
        <h2>Find Blank Product</h2>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search blank SKU, brand, style, color, size..." />
        <button type="submit">Search Blanks</button>
      </form>

      <form onSubmit={submit} className="card elevated-card">
        <h2>Finished Product Details</h2>

        <label>Blank product</label>
        <select value={blankProductId} onChange={(event) => setBlankProductId(event.target.value)} required>
          <option value="">Choose blank product...</option>
          {blankProducts.map((blank) => (
            <option key={blank.blank_product_id || blank.id} value={blank.blank_product_id || blank.id}>
              {formatBlankLabel(blank)}
            </option>
          ))}
        </select>

        {selectedBlank && <p className="helper-text">Selected blank: <strong>{formatBlankLabel(selectedBlank)}</strong></p>}

        <section className="nested-card">
          <h3>Optional Manual Pairing</h3>
          <p className="helper-text">
            If this finished item already exists from WooCommerce or a previous manual entry, search and select it here.
            When selected, the system will add inventory to that existing finished product instead of creating a new one.
          </p>

          <div className="inline-form-row">
            <input
              value={existingFinishedSearch}
              onChange={(event) => setExistingFinishedSearch(event.target.value)}
              placeholder="Search existing finished product by SKU, customer, logo, brand, color, size..."
            />
            <button type="button" onClick={runExistingFinishedSearch}>Search Existing Finished</button>
          </div>

          <label>Pair to existing finished product</label>
          <select value={existingFinishedProductId} onChange={(event) => setExistingFinishedProductId(event.target.value)}>
            <option value="">No manual pairing — auto-match or create new</option>
            {existingFinishedProducts.map((finished) => (
              <option key={finished.finished_product_id || finished.id} value={finished.finished_product_id || finished.id}>
                {[
                  finished.finished_sku || finished.sku,
                  finished.customer_name,
                  finished.logo_name,
                  finished.brand,
                  finished.style,
                  finished.color,
                  finished.size,
                  finished.finished_on_hand != null ? `On hand: ${finished.finished_on_hand}` : null,
                ].filter(Boolean).join(' / ')}
              </option>
            ))}
          </select>

          {selectedExistingFinished && (
            <p className="helper-text">
              Manual pairing selected. Inventory will be added to: <strong>{selectedExistingFinished.finished_sku || selectedExistingFinished.sku || selectedExistingFinished.name}</strong>
            </p>
          )}
        </section>

        <div className="form-grid">
          <label>Customer<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
          <label>Logo / Design<input value={logoName} onChange={(event) => setLogoName(event.target.value)} required /></label>
          <label>Decoration Type<input value={decorationType} onChange={(event) => setDecorationType(event.target.value)} placeholder="Screen Print, DTF, Embroidery" /></label>
          <label>Placement<input value={placement} onChange={(event) => setPlacement(event.target.value)} placeholder="Left Chest, Full Front" /></label>
          <label>Decoration Size<input value={decorationSize} onChange={(event) => setDecorationSize(event.target.value)} placeholder="3.5 in, 10 in" /></label>
          <label>Quantity<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
        </div>

        <label>Finished inventory bin</label>
        <select value={finishedBinId} onChange={(event) => setFinishedBinId(event.target.value)} required>
          <option value="">Choose finished bin...</option>
          {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}
        </select>

        <label className="checkbox-label">
          <input type="checkbox" checked={deductBlank} onChange={(event) => setDeductBlank(event.target.checked)} />
          Deduct blank inventory from a source bin
        </label>

        {deductBlank && (
          <>
            <label>Blank source bin</label>
            <select value={blankBinId} onChange={(event) => setBlankBinId(event.target.value)} required>
              <option value="">Choose source blank bin...</option>
              {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>)}
            </select>
          </>
        )}

        <label>Notes</label>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />

        <button type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create Finished Product + Add Inventory'}</button>
      </form>
    </main>
  );
}
