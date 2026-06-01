import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from './assets/logo.png';
import { createBin, formatBinLabel, getBins } from './lib/inventoryApi';

export default function Home() {
  const [bins, setBins] = useState([]);
  const [binCode, setBinCode] = useState('');
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadBins() {
    try {
      setBins(await getBins());
    } catch (err) {
      setMessage(err.message || 'Failed to load bins.');
    }
  }

  useEffect(() => {
    loadBins();
  }, []);

  const binCount = bins.length;
  const recentBins = useMemo(() => bins.slice(0, 6), [bins]);

  async function handleCreateBin(event) {
    event.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      const created = await createBin({ binCode, label, location });
      setMessage(`Created bin: ${formatBinLabel(created) || `Bin ${created.id}`}`);
      setBinCode('');
      setLabel('');
      setLocation('');
      await loadBins();
    } catch (err) {
      setMessage(err.message || 'Failed to create bin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="home-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <img src={logo} alt="Skilled Crafting" className="home-logo" />
          <p className="eyebrow">Inventory Control</p>
          <h1>Skilled Crafting Inventory</h1>
          <p className="hero-subtitle">
            Manage blank apparel bins, pull sheets, NFC bin tags, and finished inventory from one clean dashboard.
          </p>

          <div className="hero-actions">
            <Link className="primary-action" to="/bins">View Bins</Link>
            <Link className="secondary-action" to="/add-item">Add Item to Bin</Link>
          </div>
        </div>

        <div className="hero-stat-card">
          <span className="stat-number">{binCount}</span>
          <span className="stat-label">Active bins</span>
          <Link to="/bins">Open bin dashboard →</Link>
        </div>
      </section>

      <section className="dashboard-grid">
        <Link className="app-tile" to="/inventory/blanks">
          <span className="tile-icon">📦</span>
          <h2>Blank Inventory</h2>
          <p>Search blank stock across all bins.</p>
        </Link>

        <Link className="app-tile" to="/add-item">
          <span className="tile-icon">➕</span>
          <h2>Add Item</h2>
          <p>Receive blank apparel into a selected bin.</p>
        </Link>

        <Link className="app-tile" to="/bins">
          <span className="tile-icon">🗂️</span>
          <h2>Bin Contents</h2>
          <p>Open a bin, update quantities, and add items.</p>
        </Link>

        <Link className="app-tile" to="/nfc-writer">
          <span className="tile-icon">🏷️</span>
          <h2>Write NFC Tags</h2>
          <p>Write bin URLs to NFC tags for quick scanning.</p>
        </Link>

        <Link className="app-tile" to="/test-tag">
          <span className="tile-icon">📲</span>
          <h2>Read / Verify NFC</h2>
          <p>Scan a tag and confirm it opens the correct bin.</p>
        </Link>

        <Link className="app-tile" to="/pullsheets">
          <span className="tile-icon">✅</span>
          <h2>Pull Sheets</h2>
          <p>Pick items for jobs and mark pulls complete.</p>
        </Link>
      </section>

      <section className="content-two-column">
        <form onSubmit={handleCreateBin} className="card elevated-card">
          <h2>Add New Bin</h2>
          <p className="helper-text">Create a storage bin from the home page, then write an NFC tag for it.</p>

          <label htmlFor="bin-code">Bin code</label>
          <input
            id="bin-code"
            value={binCode}
            onChange={(event) => setBinCode(event.target.value)}
            placeholder="Example: A-01"
          />

          <label htmlFor="bin-label">Label</label>
          <input
            id="bin-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Example: Hoodies - Navy"
          />

          <label htmlFor="bin-location">Location</label>
          <input
            id="bin-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Example: Shelf 2"
          />

          <button type="submit" disabled={saving}>
            {saving ? 'Creating...' : '+ Add New Bin'}
          </button>
        </form>

        <section className="card elevated-card">
          <h2>Recent Bins</h2>
          {recentBins.length === 0 ? (
            <p>No bins found yet.</p>
          ) : (
            <div className="recent-bin-list">
              {recentBins.map((bin) => (
                <Link key={bin.id} to={`/bin/${bin.id}`} className="recent-bin">
                  <strong>{formatBinLabel(bin) || `Bin ${bin.id}`}</strong>
                  <span>View contents →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>

      {message && <p className="message">{message}</p>}
    </main>
  );
}
