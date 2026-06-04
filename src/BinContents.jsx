import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  formatBinLabel,
  formatBlankProductLabel,
  getBin,
  getBinContents,
  getBlankProducts,
  receiveBlankInventory,
  setBinBlankInventoryQuantity,
} from './lib/inventoryApi';

function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function binUrl(binId) {
  return `${window.location.origin}/bin/${binId}`;
}

export default function BinContents() {
  const { binId } = useParams();

  const [bin, setBin] = useState(null);
  const [items, setItems] = useState([]);
  const [blankProducts, setBlankProducts] = useState([]);
  const [selectedBlankProductId, setSelectedBlankProductId] = useState('');
  const [addQuantity, setAddQuantity] = useState(1);
  const [addSearch, setAddSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState(null);
  const [message, setMessage] = useState('');
  const [nfcMessage, setNfcMessage] = useState('');

  async function loadBinAndContents() {
    setLoading(true);
    setMessage('');

    try {
      const [binData, itemRows, productRows] = await Promise.all([
        getBin(binId),
        getBinContents(binId, itemSearch),
        getBlankProducts(addSearch),
      ]);

      setBin(binData);
      setItems(itemRows);
      setBlankProducts(productRows);

      const drafts = {};
      itemRows.forEach((item) => {
        drafts[item.blank_product_id] = item.quantity_on_hand;
      });
      setQuantityDrafts(drafts);
    } catch (err) {
      setMessage(err.message || 'Failed to load bin contents.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBinAndContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binId]);

  async function handleSearchContents(event) {
    event.preventDefault();
    await loadBinAndContents();
  }

  async function handleSearchBlankItems(event) {
    event.preventDefault();

    try {
      setBlankProducts(await getBlankProducts(addSearch));
    } catch (err) {
      setMessage(err.message || 'Failed to search blank products.');
    }
  }

  async function handleAddItem(event) {
    event.preventDefault();
    setMessage('');

    if (!selectedBlankProductId) {
      setMessage('Choose a blank item to add.');
      return;
    }

    if (!addQuantity || Number(addQuantity) <= 0) {
      setMessage('Quantity must be greater than zero.');
      return;
    }

    try {
      await receiveBlankInventory({
        binId,
        blankProductId: selectedBlankProductId,
        quantity: Number(addQuantity),
        notes,
      });

      setMessage('Item added to bin.');
      setSelectedBlankProductId('');
      setAddQuantity(1);
      setNotes('');
      await loadBinAndContents();
    } catch (err) {
      setMessage(err.message || 'Failed to add item to bin.');
    }
  }

  async function handleUpdateQuantity(item) {
    setSavingItemId(item.blank_product_id);
    setMessage('');

    try {
      const nextQuantity = Number(quantityDrafts[item.blank_product_id] ?? 0);

      if (Number.isNaN(nextQuantity) || nextQuantity < 0) {
        throw new Error('Quantity must be zero or greater.');
      }

      await setBinBlankInventoryQuantity({
        binId,
        blankProductId: item.blank_product_id,
        quantity: nextQuantity,
        notes: `Bin contents quantity update from ${item.quantity_on_hand} to ${nextQuantity}`,
      });

      setMessage('Quantity updated.');
      await loadBinAndContents();
    } catch (err) {
      setMessage(err.message || 'Failed to update quantity.');
    } finally {
      setSavingItemId(null);
    }
  }

  async function writeNfcTag() {
    setNfcMessage('');

    if (!nfcSupported()) {
      setNfcMessage('Web NFC is not supported on this device/browser. Use Chrome on Android over HTTPS.');
      return;
    }

    try {
      const url = binUrl(binId);
      const ndef = new window.NDEFReader();

      setNfcMessage('Hold the NFC tag near this device...');
      await ndef.write({
        records: [{ recordType: 'url', data: url }],
      });

      setNfcMessage(`Tag written: ${url}`);
    } catch (err) {
      setNfcMessage(err.message || 'Failed to write NFC tag.');
    }
  }

  async function readNfcTag() {
    setNfcMessage('');

    if (!nfcSupported()) {
      setNfcMessage('Web NFC is not supported on this device/browser. Use Chrome on Android over HTTPS.');
      return;
    }

    try {
      const ndef = new window.NDEFReader();
      setNfcMessage('Hold an NFC tag near this device...');
      await ndef.scan();

      ndef.onreading = (event) => {
        const record = event.message.records[0];

        if (!record) {
          setNfcMessage('No NFC record found.');
          return;
        }

        const decoder = new TextDecoder();
        const url = decoder.decode(record.data);
        const expected = binUrl(binId);

        if (url === expected || url.endsWith(`/bin/${binId}`)) {
          setNfcMessage(`Verified. This tag opens ${url}`);
        } else {
          setNfcMessage(`Tag read, but it points somewhere else: ${url}`);
        }
      };
    } catch (err) {
      setNfcMessage(err.message || 'Failed to read NFC tag.');
    }
  }

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity_on_hand || 0), 0),
    [items]
  );

  if (loading) {
    return <main className="page"><p>Loading bin…</p></main>;
  }

  if (!bin) {
    return <main className="page"><p>Bin not found.</p></main>;
  }

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Bin Contents</p>
          <h1>{formatBinLabel(bin) || `Bin ${bin.id}`}</h1>
          <p className="helper-text">{items.length} item type{items.length === 1 ? '' : 's'} · {totalQuantity} total units</p>
        </div>
        <Link className="secondary-action" to="/bins">← All Bins</Link>
      </div>

      <section className="card nfc-panel">
        <div>
          <h2>NFC Tag</h2>
          <p className="helper-text">Write or verify an NFC tag that opens this bin page.</p>
          <code>{binUrl(binId)}</code>
        </div>
        <div className="nfc-buttons">
          <button type="button" onClick={writeNfcTag}>Write NFC Tag</button>
          <button type="button" className="button-outline" onClick={readNfcTag}>Read / Verify Tag</button>
        </div>
        {nfcMessage && <p className="message">{nfcMessage}</p>}
      </section>

      <section className="card">
        <h2>Add New Item to This Bin</h2>

        <form onSubmit={handleSearchBlankItems} className="inline-form">
          <input
            value={addSearch}
            onChange={(event) => setAddSearch(event.target.value)}
            placeholder="Search blank SKU, color, size, brand..."
          />
          <button type="submit">Search Items</button>
          <Link className="button-link" to="/add-item">Create New Blank Item</Link>
        </form>

        <form onSubmit={handleAddItem} className="bin-add-form">
          <label htmlFor="blank-product">Blank item</label>
          <select
            id="blank-product"
            value={selectedBlankProductId}
            onChange={(event) => setSelectedBlankProductId(event.target.value)}
            required
          >
            <option value="">Choose blank item...</option>
            {blankProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {formatBlankProductLabel(product)}
              </option>
            ))}
          </select>

          <label htmlFor="add-qty">Quantity</label>
          <input
            id="add-qty"
            type="number"
            min="1"
            value={addQuantity}
            onChange={(event) => setAddQuantity(event.target.value)}
            required
          />

          <label htmlFor="add-notes">Notes</label>
          <input
            id="add-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional notes"
          />

          <button type="submit">Add to This Bin</button>
        </form>
      </section>

      <section className="card">
        <h2>Current Contents</h2>

        <form onSubmit={handleSearchContents} className="inline-form">
          <input
            value={itemSearch}
            onChange={(event) => setItemSearch(event.target.value)}
            placeholder="Filter contents..."
          />
          <button type="submit">Search Contents</button>
        </form>

        {items.length === 0 ? (
          <p>No items are currently stored in this bin.</p>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Brand</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Quantity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.bin_id}-${item.blank_product_id}`}>
                    <td>
                      <strong>{item.sku_base}</strong>
                      <br />
                      <span>{item.name}</span>
                    </td>
                    <td>{item.brand || ''}</td>
                    <td>{item.color || ''}</td>
                    <td>{item.size || ''}</td>
                    <td>
                      <input
                        className="qty-input"
                        type="number"
                        min="0"
                        value={quantityDrafts[item.blank_product_id] ?? item.quantity_on_hand}
                        onChange={(event) =>
                          setQuantityDrafts((current) => ({
                            ...current,
                            [item.blank_product_id]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item)}
                        disabled={savingItemId === item.blank_product_id}
                      >
                        {savingItemId === item.blank_product_id ? 'Saving...' : 'Update'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
