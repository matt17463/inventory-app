import { useEffect, useState } from 'react';
import {
  formatBinLabel,
  getBins,
  getBlankProducts,
  receiveBlankInventory,
} from './lib/inventoryApi';

export default function AddItemToBin() {
  const [bins, setBins] = useState([]);
  const [blankProducts, setBlankProducts] = useState([]);
  const [binId, setBinId] = useState('');
  const [blankProductId, setBlankProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadPage() {
    setMessage('');
    setLoading(true);

    try {
      const [binRows, productRows] = await Promise.all([
        getBins(),
        getBlankProducts(search),
      ]);
      setBins(binRows);
      setBlankProducts(productRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    await loadPage();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!binId) return setMessage('Choose a bin.');
    if (!blankProductId) return setMessage('Choose a blank clothing item.');
    if (!quantity || Number(quantity) <= 0) return setMessage('Quantity must be greater than zero.');

    setLoading(true);

    try {
      await receiveBlankInventory({
        binId,
        blankProductId,
        quantity,
        notes,
      });

      setMessage('Blank item added to bin inventory.');
      setQuantity(1);
      setNotes('');
    } catch (err) {
      setMessage(err.message || 'Failed to add item to bin.');
    } finally {
      setLoading(false);
    }
  }

  function productLabel(product) {
    const brand = product.brands?.name || '';
    const type = product.product_types?.name || '';
    const color = product.colors?.name || '';
    const size = product.sizes?.name || '';

    return [product.sku_base, product.name, brand, type, color, size]
      .filter(Boolean)
      .join(' - ');
  }

  return (
    <main className="page">
      <h1>Add Blank Item to Bin</h1>

      <form onSubmit={handleSearch} className="card">
        <label htmlFor="blank-search">Search blank clothing</label>
        <input
          id="blank-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search blank SKU or name"
        />
        <button type="submit" disabled={loading}>Search</button>
      </form>

      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="bin">Bin</label>
        <select id="bin" value={binId} onChange={(event) => setBinId(event.target.value)} required>
          <option value="">Choose bin...</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {formatBinLabel(bin)}
            </option>
          ))}
        </select>

        <label htmlFor="blank-product">Blank clothing item</label>
        <select
          id="blank-product"
          value={blankProductId}
          onChange={(event) => setBlankProductId(event.target.value)}
          required
        >
          <option value="">Choose blank item...</option>
          {blankProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {productLabel(product)}
            </option>
          ))}
        </select>

        <label htmlFor="quantity">Quantity received</label>
        <input
          id="quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />

        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional receiving notes"
        />

        <button type="submit" disabled={loading}>Add Item to Bin</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
