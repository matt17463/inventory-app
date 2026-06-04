import { useEffect, useState } from 'react';
import {
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  getBlankItemsInBin,
  transferBlankInventory,
} from './lib/inventoryApi';

export default function TransferInventory() {
  const [bins, setBins] = useState([]);
  const [fromBinId, setFromBinId] = useState('');
  const [toBinId, setToBinId] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [blankProductId, setBlankProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadBins() {
    try {
      setBins(await getBins());
    } catch (err) {
      setMessage(err.message || 'Failed to load bins.');
    }
  }

  async function loadItems(binId = fromBinId, term = search) {
    setBlankProductId('');
    if (!binId) {
      setItems([]);
      return;
    }

    try {
      const rows = await getBlankItemsInBin(binId, term);
      setItems(rows);
      if (rows.length === 1) {
        setBlankProductId(rows[0].blank_product_id);
      }
    } catch (err) {
      setMessage(err.message || 'Failed to load items in selected bin.');
    }
  }

  useEffect(() => {
    loadBins();
  }, []);

  useEffect(() => {
    loadItems(fromBinId, search);
  }, [fromBinId]);

  async function runSearch(event) {
    event.preventDefault();
    await loadItems(fromBinId, search);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      if (!fromBinId) throw new Error('Choose the source bin.');
      if (!toBinId) throw new Error('Choose the destination bin.');
      if (String(fromBinId) === String(toBinId)) throw new Error('Source and destination bins must be different.');
      if (!blankProductId) throw new Error('Choose an item from the source bin.');

      const selected = items.find((item) => String(item.blank_product_id) === String(blankProductId));
      const qty = Number(quantity || 0);

      if (!qty || qty <= 0) throw new Error('Quantity must be greater than zero.');
      if (selected && qty > Number(selected.on_hand_quantity || 0)) {
        throw new Error(`The source bin only has ${selected.on_hand_quantity} available.`);
      }

      await transferBlankInventory({
        fromBinId,
        toBinId,
        blankProductId,
        quantity: qty,
        notes,
      });

      setMessage('Transfer completed.');
      setQuantity(1);
      setNotes('');
      await loadItems(fromBinId, search);
    } catch (err) {
      setMessage(err.message || 'Transfer failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>Transfer Blank Inventory</h1>
          <p>Select a source bin first. The item list only shows blanks currently available in that bin.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <form onSubmit={submit} className="card elevated-card">
        <div className="form-grid">
          <label>
            From Bin
            <select value={fromBinId} onChange={(event) => setFromBinId(event.target.value)} required>
              <option value="">Choose source bin...</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>
              ))}
            </select>
          </label>

          <label>
            To Bin
            <select value={toBinId} onChange={(event) => setToBinId(event.target.value)} required>
              <option value="">Choose destination bin...</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>{formatBinLabel(bin)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="inline-form-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search within selected bin by SKU, brand, style, color, size..."
            disabled={!fromBinId}
          />
          <button type="button" onClick={runSearch} disabled={!fromBinId}>Search Bin Items</button>
        </div>

        <label>
          Item in Source Bin
          <select value={blankProductId} onChange={(event) => setBlankProductId(event.target.value)} required>
            <option value="">{fromBinId ? 'Choose item from source bin...' : 'Choose source bin first...'}</option>
            {items.map((item) => (
              <option key={item.blank_product_id} value={item.blank_product_id}>
                {[item.sku_base, item.name, item.brand, item.style, item.color, item.size, `${item.on_hand_quantity} on hand`].filter(Boolean).join(' / ')}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label>
            Quantity
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </label>

          <label>
            Notes
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />
          </label>
        </div>

        <button type="submit" disabled={busy}>
          {busy ? 'Transferring...' : 'Transfer Inventory'}
        </button>
      </form>
    </main>
  );
}
