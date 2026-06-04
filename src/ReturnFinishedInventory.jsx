import { useEffect, useState } from 'react';
import {
  formatBinLabel,
  getBins,
  formatFinishedProductLabel,
  getFinishedProducts,
  receiveFinishedInventory,
} from './lib/inventoryApi';

export default function ReturnFinishedInventory() {
  const [search, setSearch] = useState('');
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [bins, setBins] = useState([]);
  const [finishedProductId, setFinishedProductId] = useState('');
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('');
    try {
      const [products, binRows] = await Promise.all([
        getFinishedProducts(search),
        getBins(),
      ]);
      setFinishedProducts(products);
      setBins(binRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load finished inventory.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage('');

    try {
      await receiveFinishedInventory({
        binId,
        finishedProductId,
        quantity,
        notes,
      });
      setMessage('Finished item added to inventory.');
      setQuantity(1);
      setNotes('');
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to add finished item.');
    }
  }

  return (
    <main className="page">
      <h1>Return Finished Item to Inventory</h1>

      <form onSubmit={(event) => { event.preventDefault(); load(); }} className="card">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search finished SKU, customer, logo, brand, color, size..."
        />
        <button type="submit">Search</button>
      </form>

      <form onSubmit={submit} className="card">
        <label>Finished product</label>
        <select value={finishedProductId} onChange={(event) => setFinishedProductId(event.target.value)} required>
          <option value="">Choose finished product...</option>
          {finishedProducts.map((p) => (
            <option key={p.finished_product_id} value={p.finished_product_id}>
              {formatFinishedProductLabel(p)}
            </option>
          ))}
        </select>

        <label>Bin</label>
        <select value={binId} onChange={(event) => setBinId(event.target.value)} required>
          <option value="">Choose bin...</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {formatBinLabel(bin)}
            </option>
          ))}
        </select>

        <label>Quantity</label>
        <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />

        <label>Notes</label>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />

        <button type="submit">Add Finished Inventory</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
