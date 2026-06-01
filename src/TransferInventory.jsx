import { useEffect, useState } from 'react';
import {
  findBlankProductByScannedValue,
  formatBinLabel,
  formatBlankProductLabel,
  getBins,
  getBlankProducts,
  transferBlankInventory,
} from './lib/inventoryApi';

export default function TransferInventory() {
  const [bins, setBins] = useState([]);
  const [products, setProducts] = useState([]);
  const [fromBinId, setFromBinId] = useState('');
  const [toBinId, setToBinId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([getBins(), getBlankProducts()])
      .then(([binRows, productRows]) => {
        setBins(binRows);
        setProducts(productRows);
      })
      .catch((err) => setMessage(err.message || 'Failed to load transfer data.'));
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    try {
      setProducts(await getBlankProducts(search));
    } catch (err) {
      setMessage(err.message || 'Search failed.');
    }
  }

  async function handleScanLookup() {
    setMessage('');
    try {
      const found = await findBlankProductByScannedValue(search);
      if (!found) {
        setMessage('No product found for that barcode/SKU.');
        return;
      }
      setSelectedProductId(found.id);
      setProducts([found]);
      setMessage(`Selected ${formatBlankProductLabel(found)}.`);
    } catch (err) {
      setMessage(err.message || 'Lookup failed.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!fromBinId || !toBinId || !selectedProductId) {
      setMessage('Choose a from bin, to bin, and product.');
      return;
    }

    if (fromBinId === toBinId) {
      setMessage('From bin and to bin must be different.');
      return;
    }

    try {
      await transferBlankInventory({
        fromBinId,
        toBinId,
        blankProductId: selectedProductId,
        quantity,
        notes,
      });
      setMessage('Transfer completed.');
      setQuantity(1);
      setNotes('');
    } catch (err) {
      setMessage(err.message || 'Transfer failed.');
    }
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Inventory Movement</p>
          <h1>Transfer Inventory</h1>
          <p className="helper-text">Move blank items between bins without losing ledger history.</p>
        </div>
      </div>

      <section className="card">
        <form onSubmit={handleSearch} className="inline-form">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Scan/type SKU, barcode, color, size..." />
          <button type="submit">Search</button>
          <button type="button" className="button-outline" onClick={handleScanLookup}>Use Exact Scan</button>
        </form>
      </section>

      <form onSubmit={handleSubmit} className="card transfer-card">
        <label>From bin</label>
        <select value={fromBinId} onChange={(e) => setFromBinId(e.target.value)} required>
          <option value="">Choose source bin...</option>
          {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
        </select>

        <label>To bin</label>
        <select value={toBinId} onChange={(e) => setToBinId(e.target.value)} required>
          <option value="">Choose destination bin...</option>
          {bins.map((bin) => <option key={bin.id} value={bin.id}>{formatBinLabel(bin) || `Bin ${bin.id}`}</option>)}
        </select>

        <label>Blank item</label>
        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} required>
          <option value="">Choose product...</option>
          {products.map((product) => <option key={product.id} value={product.id}>{formatBlankProductLabel(product)}</option>)}
        </select>

        <label>Quantity</label>
        <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />

        <label>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional transfer notes" />

        <button type="submit">Transfer Inventory</button>
      </form>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
