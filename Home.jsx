import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from './assets/logo.png';
import {
  createBin,
  formatBinLabel,
  getActivityFeed,
  getBins,
  getDashboardMetrics,
  getLowStockItems,
  money,
} from './lib/inventoryApi';

export default function Home() {
  const [bins, setBins] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [activity, setActivity] = useState([]);
  const [binCode, setBinCode] = useState('');
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadDashboard() {
    try {
      const [binRows, metricRow, lowRows, activityRows] = await Promise.all([
        getBins(),
        getDashboardMetrics(),
        getLowStockItems(),
        getActivityFeed(8),
      ]);

      setBins(binRows);
      setMetrics(metricRow);
      setLowStock(lowRows.slice(0, 6));
      setActivity(activityRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load dashboard. Run the latest SQL migration if this is your first time opening this version.');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

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
      await loadDashboard();
    } catch (err) {
      setMessage(err.message || 'Failed to create bin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="home-page">
      <section className="hero-panel operations-hero">
        <div className="hero-copy">
          <img src={logo} alt="Skilled Crafting" className="home-logo" />
          <p className="eyebrow">Warehouse Operations</p>
          <h1>Inventory control built for apparel production.</h1>
          <p className="hero-subtitle">
            Track blank inventory, bin locations, reservations, NFC bin tags, audits, transfers, low-stock alerts, and activity from one dashboard.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" to="/scan">Scan Inventory</Link>
            <Link className="secondary-action" to="/transfer">Transfer Between Bins</Link>
            <Link className="secondary-action" to="/audit">Audit a Bin</Link>
          </div>
        </div>

        <div className="hero-stat-card">
          <span className="stat-number">{metrics?.total_available_units ?? 0}</span>
          <span className="stat-label">Available blank units</span>
          <Link to="/inventory/blanks">Open inventory →</Link>
        </div>
      </section>

      <section className="kpi-grid">
        <Link className="kpi-card" to="/bins">
          <span>{metrics?.total_bins ?? bins.length}</span>
          <strong>Bins</strong>
          <small>Storage locations</small>
        </Link>
        <Link className="kpi-card" to="/inventory/blanks">
          <span>{metrics?.total_units_on_hand ?? 0}</span>
          <strong>On hand</strong>
          <small>Total units counted</small>
        </Link>
        <Link className="kpi-card" to="/reservations">
          <span>{metrics?.total_reserved_units ?? 0}</span>
          <strong>Reserved</strong>
          <small>Internal holds only</small>
        </Link>
        <Link className="kpi-card" to="/low-stock">
          <span>{metrics?.low_stock_count ?? 0}</span>
          <strong>Low stock</strong>
          <small>Below reorder point</small>
        </Link>
        <Link className="kpi-card" to="/valuation">
          <span>{money(metrics?.total_inventory_value ?? 0)}</span>
          <strong>Value</strong>
          <small>Estimated blank value</small>
        </Link>
      </section>

      <section className="dashboard-grid operations-grid">
        <Link className="app-tile" to="/scan"><span className="tile-icon">📷</span><h2>Barcode / QR Scan</h2><p>Scan or type a SKU to receive, transfer, or reserve inventory.</p></Link>
        <Link className="app-tile" to="/add-item"><span className="tile-icon">➕</span><h2>Add Blank Item</h2><p>Create a new blank item or receive an existing blank directly into a bin.</p></Link>
        <Link className="app-tile" to="/inventory/edit-blanks"><span className="tile-icon">✏️</span><h2>Edit Blank Items</h2><p>Update unit costs, reorder points, barcodes, images, and item details.</p></Link>
        <Link className="app-tile" to="/transfer"><span className="tile-icon">🔁</span><h2>Transfer Inventory</h2><p>Move blank inventory from one bin to another with a ledger trail.</p></Link>
        <Link className="app-tile" to="/audit"><span className="tile-icon">🧮</span><h2>Audit Mode</h2><p>Open a bin, count actual units, and adjust discrepancies.</p></Link>
        <Link className="app-tile" to="/reservations"><span className="tile-icon">📌</span><h2>Reservations</h2><p>Hold inventory for jobs without blocking online orders.</p></Link>
        <Link className="app-tile" to="/valuation"><span className="tile-icon">💵</span><h2>Inventory Valuation</h2><p>See value by product using unit costs and on-hand quantities.</p></Link>
        <Link className="app-tile" to="/purchasing"><span className="tile-icon">🛒</span><h2>Purchasing</h2><p>Find negative availability and export a supplier order list.</p></Link>
        <Link className="app-tile" to="/woo-sync"><span className="tile-icon">🔄</span><h2>WooCommerce Sync</h2><p>Monitor sync queue records for your WooCommerce integration.</p></Link>
        <Link className="app-tile" to="/color-aliases"><span className="tile-icon">🎨</span><h2>Color Alias Review</h2><p>Approve or reject WooCommerce color aliases before relinking products.</p></Link>
      </section>

      <section className="content-two-column wide-two-column">
        <form onSubmit={handleCreateBin} className="card elevated-card">
          <h2>Add New Bin</h2>
          <p className="helper-text">Create a storage bin, then open the bin and write an NFC tag for it.</p>
          <label htmlFor="bin-code">Bin code</label>
          <input id="bin-code" value={binCode} onChange={(event) => setBinCode(event.target.value)} placeholder="Example: A-01" />
          <label htmlFor="bin-label">Label</label>
          <input id="bin-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Example: Hoodies - Navy" />
          <label htmlFor="bin-location">Location</label>
          <input id="bin-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Example: Shelf 2" />
          <button type="submit" disabled={saving}>{saving ? 'Creating...' : '+ Add New Bin'}</button>
        </form>

        <section className="card elevated-card">
          <h2>Low Stock Snapshot</h2>
          {lowStock.length === 0 ? <p>No low-stock items right now.</p> : lowStock.map((item) => (
            <Link key={item.blank_product_id} to="/low-stock" className="compact-row">
              <strong>{item.sku_base}</strong>
              <span>{item.available_quantity} available · reorder at {item.low_stock_threshold}</span>
            </Link>
          ))}
        </section>
      </section>

      <section className="content-two-column wide-two-column">
        <section className="card elevated-card">
          <h2>Recent Activity</h2>
          {activity.length === 0 ? <p>No activity yet.</p> : activity.map((event) => (
            <div key={event.id} className="activity-row">
              <strong>{event.activity_type}</strong>
              <span>{event.description}</span>
              <small>{new Date(event.created_at).toLocaleString()}</small>
            </div>
          ))}
          <Link to="/activity" className="button-link">View Full Activity Feed</Link>
        </section>

        <section className="card elevated-card">
          <h2>Recent Bins</h2>
          {recentBins.length === 0 ? <p>No bins found yet.</p> : (
            <div className="recent-bin-list">
              {recentBins.map((bin) => (
                <Link key={bin.id} to={`/bin/${bin.id}`} className="recent-bin">
                  <strong>{formatBinLabel(bin) || `Bin ${bin.id}`}</strong>
                  <span>View NFC dashboard + contents →</span>
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
