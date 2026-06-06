import { useEffect, useMemo, useState } from 'react';
import { getPhase4CampaignForecast } from './lib/inventoryApi';

export default function CampaignForecast() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      setRows(await getPhase4CampaignForecast(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load campaign forecast.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSuggested = useMemo(() => rows.reduce((sum, row) => sum + Number(row.suggested_purchase_quantity || 0), 0), [rows]);
  const urgentRows = useMemo(() => rows.filter((row) => Number(row.suggested_purchase_quantity || 0) > 0), [rows]);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Management Intelligence</p>
          <h1>Campaign Forecasting</h1>
          <p>Use historical customer demand to estimate campaign stock needs and possible purchase quantities.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid">
        <div className="kpi-card"><span>{rows.length}</span><strong>Forecast rows</strong><small>Customer/item combinations</small></div>
        <div className="kpi-card"><span>{urgentRows.length}</span><strong>Need purchase</strong><small>Suggested qty greater than 0</small></div>
        <div className="kpi-card"><span>{totalSuggested}</span><strong>Suggested units</strong><small>Across visible forecast</small></div>
      </section>

      <section className="card elevated-card">
        <h2>Search forecast</h2>
        <div className="inline-form-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, SKU, brand, style, color, size..." />
          <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
        </div>
      </section>

      <section className="card table-card">
        <h2>Forecast</h2>
        <div className="responsive-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th><th>Item</th><th>Historical</th><th>Current On Hand</th><th>Suggested Stock</th><th>Suggested Buy</th><th>Last Order</th><th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.customer_name}-${row.blank_product_id}`}>
                  <td><strong>{row.customer_name}</strong></td>
                  <td><strong>{row.sku_base}</strong><br /><small>{[row.brand, row.style, row.color, row.size].filter(Boolean).join(' / ')}</small></td>
                  <td>{row.historical_units} units / {row.historical_jobs} jobs<br /><small>Avg {row.average_units_per_job}</small></td>
                  <td>{row.current_on_hand}</td>
                  <td>{row.suggested_campaign_stock}</td>
                  <td><strong>{row.suggested_purchase_quantity}</strong></td>
                  <td>{row.last_order_date || '—'}</td>
                  <td>{row.forecast_signal}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="8">No forecast rows found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
