import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createBin, formatBinLabel, getBins } from './lib/inventoryApi';

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
      </section>

      {message && <p className="message">{message}</p>}
      {loading && <p>Loading bins…</p>}

      {!loading && (
        <section className="bin-grid">
          {filteredBins.length === 0 ? (
            <p>No matching bins.</p>
          ) : (
            filteredBins.map((bin) => (
              <Link key={bin.id} to={`/bin/${bin.id}`} className="bin-card">
                <strong>{formatBinLabel(bin) || `Bin ${bin.id}`}</strong>
                <span>ID {bin.id}</span>
                <em>View contents →</em>
              </Link>
            ))
          )}
        </section>
      )}
    </main>
  );
}
