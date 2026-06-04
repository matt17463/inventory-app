import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createBin, formatBinLabel, getBins, updateBinDisplayOrder } from './lib/inventoryApi';

export default function BinsDashboard() {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [binCode, setBinCode] = useState('');
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  async function loadBins() {
    setLoading(true);
    setMessage('');

    try {
      setBins(await getBins());
    } catch (err) {
      setMessage(err.message || 'Failed to load bins.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBins();
  }, []);


  function moveBin(binId, direction) {
    setBins((current) => {
      const list = [...current];
      const index = list.findIndex((bin) => String(bin.id) === String(binId));
      if (index < 0) return current;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= list.length) return current;
      const [item] = list.splice(index, 1);
      list.splice(nextIndex, 0, item);
      return list.map((bin, orderIndex) => ({ ...bin, display_order: orderIndex + 1 }));
    });
  }

  async function saveBinOrder() {
    setMessage('');
    try {
      await updateBinDisplayOrder(bins.map((bin, index) => ({ id: bin.id, display_order: index + 1 })));
      setMessage('Bin order saved.');
      await loadBins();
    } catch (err) {
      setMessage(err.message || 'Failed to save bin order. Run the bin display order SQL first.');
    }
  }

  async function handleAddBin(event) {
    event.preventDefault();

    try {
      const created = await createBin({ binCode, label, location });
      setMessage(`Created ${formatBinLabel(created) || `Bin ${created.id}`}.`);
      setBinCode('');
      setLabel('');
      setLocation('');
      await loadBins();
    } catch (err) {
      setMessage(err.message || 'Failed to create bin.');
    }
  }

  const term = search.toLowerCase();
  const filteredBins = bins.filter((bin) =>
    [bin.bin_code, bin.label, bin.location, String(bin.id)]
      .filter(Boolean)
      .some((part) => String(part).toLowerCase().includes(term))
  );

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Storage</p>
          <h1>Bins</h1>
        </div>
        <Link className="secondary-action" to="/nfc-writer">Write NFC Tags</Link>
      </div>

      <section className="card">
        <h2>Add New Bin</h2>
        <form onSubmit={handleAddBin} className="inline-form">
          <input value={binCode} onChange={(e) => setBinCode(e.target.value)} placeholder="Bin code" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
          <button type="submit">+ Add Bin</button>
        </form>
      </section>

      <section className="card">
        <label htmlFor="bin-search">Search bins</label>
        <input
          id="bin-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bin code, label, or location"
        />
        <p className="helper-text">Use Move Up / Move Down to arrange bins, then save the display order.</p>
        <button type="button" onClick={saveBinOrder}>Save Bin Display Order</button>
      </section>

      {message && <p className="message">{message}</p>}
      {loading && <p>Loading bins…</p>}

      {!loading && (
        <section className="bin-grid">
          {filteredBins.length === 0 ? (
            <p>No matching bins.</p>
          ) : (
            filteredBins.map((bin, index) => (
              <div key={bin.id} className="bin-card bin-card-sortable">
                <Link to={`/bin/${bin.id}`} className="bin-card-link">
                  <strong>{formatBinLabel(bin) || `Bin ${bin.id}`}</strong>
                  <span>ID {bin.id}</span>
                  <em>View contents →</em>
                </Link>
                <div className="bin-sort-actions">
                  <button type="button" onClick={() => moveBin(bin.id, 'up')} disabled={index === 0}>↑ Move Up</button>
                  <button type="button" onClick={() => moveBin(bin.id, 'down')} disabled={index === filteredBins.length - 1}>↓ Move Down</button>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}
