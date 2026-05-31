import { useEffect, useState } from 'react';
import { getBlankProducts, getBins, receiveBlankInventory } from './lib/inventoryApi';

export default function ReceiveBlankInventory() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [bins, setBins] = useState([]);
  const [blankProductId, setBlankProductId] = useState('');
  const [binId, setBinId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [productRows, binRows] = await Promise.all([
      getBlankProducts(search),
      getBins(),
    ]);
    setProducts(productRows);
    setBins(binRows);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setMessage('');
    await load();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    try {
      await receiveBlankInventory({
        binId,
        blankProductId,
        quantity,
        notes,
      });
      setMessage('Blank inventory received successfully.');
      setQuantity(1);
      setNotes('');
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <main className="page">
      <h1>Receive Blank Inventory</h1>

      <form onSubmit={handleSearch} className="card">
        <label>Search blank product</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, color, size, brand..." />
        <button type="submit">Search</button>
      </form>

      <form onSubmit={handleSubmit} className="card">
        <label>Blank product</label>
        <select value={blankProductId} onChange={(e) => setBlankProductId(e.target.value)} required>
          <option value="">Choose blank product...</option>
          {products.map((p) => (
            <option key={p.blank_product_id} value={p.blank_product_id}>
              {p.sku_base} — {p.brand || ''} {p.color || ''} {p.size || ''} ({p.total_quantity || 0} on hand)
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

        <button type="submit">Receive Inventory</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
