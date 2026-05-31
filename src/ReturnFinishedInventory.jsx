import { useEffect, useState } from 'react';
import { getBins, getFinishedProducts, receiveFinishedInventory } from './lib/inventoryApi';

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
    const [products, binRows] = await Promise.all([
      getFinishedProducts(search),
      getBins(),
    ]);
    setFinishedProducts(products);
    setBins(binRows);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  async function submit(e) {
    e.preventDefault();
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
      setMessage(err.message);
    }
  }

  return (
    <main className="page">
      <h1>Return Finished Item to Inventory</h1>

      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="card">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search finished SKU, customer, logo..." />
        <button type="submit">Search</button>
      </form>

      <form onSubmit={submit} className="card">
        <label>Finished product</label>
        <select value={finishedProductId} onChange={(e) => setFinishedProductId(e.target.value)} required>
          <option value="">Choose finished product...</option>
          {finishedProducts.map((p) => (
            <option key={p.finished_product_id} value={p.finished_product_id}>
              {p.finished_sku} — {p.customer || ''} {p.logo || ''} ({p.total_quantity || 0} on hand)
            </option>
          ))}
        </select>

        <label>Bin</label>
        <select value={binId} onChange={(e) => setBinId(e.target.value)} required>
          <option value="">Choose bin...</option>
          {bins.map((b) => (
            <option key={b.id} value={b.id}>{b.bin_code}</option>
          ))}
        </select>

        <label>Quantity</label>
        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />

        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />

        <button type="submit">Add Finished Inventory</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
