import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatBinLabel,
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
  const [itemsLoading, setItemsLoading] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.blank_product_id) === String(blankProductId)) || null,
    [items, blankProductId]
  );

  const loadBins = useCallback(async () => {
    try {
      setBins(await getBins());
    } catch (err) {
      setMessage(err.message || 'Failed to load bins.');
    }
  }, []);

  const loadItems = useCallback(async (binId, term) => {
    setBlankProductId('');

    if (!binId) {
      setItems([]);
      return;
    }

    setItemsLoading(true);
    setMessage('');

    try {
      const rows = await getBlankItemsInBin(binId, term);
      setItems(rows);

      if (rows.length === 1) {
        setBlankProductId(String(rows[0].blank_product_id));
      }

      if (!rows.length) {
        setMessage('No items with on-hand quantity were found in the selected source bin. Try clearing the search or confirm this bin has received inventory.');
      } else {
        setMessage(`Loaded ${rows.length} item${rows.length === 1 ? '' : 's'} from the selected source bin.`);
      }
    } catch (err) {
      setItems([]);
      setMessage(err.message || 'Failed to load items in selected bin.');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBins();
  }, [loadBins]);

  useEffect(() => {
    loadItems(fromBinId, '');
    setSearch('');
  }, [fromBinId, loadItems]);

  async function runSearch(event) {
    event.preventDefault();
    await loadItems(fromBinId, search);
  }

  async function clearSearch() {
    setSearch('');
    await loadItems(fromBinId, '');
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

      const qty = Number(quantity || 0);

      if (!qty || qty <= 0) throw new Error('Quantity must be greater than zero.');
      if (selectedItem && qty > Number(selectedItem.on_hand_quantity || 0)) {
        throw new Error(`The source bin only has ${selectedItem.on_hand_quantity} available.`);
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
            disabled={!fromBinId || itemsLoading}
          />
          <button type="button" onClick={runSearch} disabled={!fromBinId || itemsLoading}>
            {itemsLoading ? 'Searching...' : 'Search Bin Items'}
          </button>
          <button type="button" onClick={clearSearch} disabled={!fromBinId || itemsLoading || !search}>
            Clear
          </button>
        </div>

        <label>
          Item in Source Bin
          <select value={blankProductId} onChange={(event) => setBlankProductId(event.target.value)} required disabled={!fromBinId || itemsLoading}>
            <option value="">
              {!fromBinId
                ? 'Choose source bin first...'
                : itemsLoading
                  ? 'Loading items...'
                  : items.length
                    ? 'Choose item from source bin...'
                    : 'No on-hand items found in this bin'}
            </option>
            {items.map((item) => (
              <option key={item.blank_product_id} value={item.blank_product_id}>
                {[item.sku_base, item.name, item.brand, item.style, item.color, item.size, `${item.on_hand_quantity} on hand`].filter(Boolean).join(' / ')}
              </option>
            ))}
          </select>
        </label>

        {selectedItem ? (
          <p className="muted">
            Selected: {[selectedItem.sku_base, selectedItem.name, selectedItem.brand, selectedItem.style, selectedItem.color, selectedItem.size].filter(Boolean).join(' / ')} · {selectedItem.on_hand_quantity} on hand
          </p>
        ) : null}

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

        <button type="submit" disabled={busy || itemsLoading}>
          {busy ? 'Transferring...' : 'Transfer Inventory'}
        </button>
      </form>
    </main>
  );
}
