import { useEffect, useState } from 'react';
import { getPhase4CustomerReorders } from './lib/inventoryApi';

export default function CustomerReorderIntelligence() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      setRows(await getPhase4CustomerReorders(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load reorder intelligence.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Management Intelligence</p>
          <h1>Customer Reorder Intelligence</h1>
          <p>See which customers repeatedly order the same blank, logo, and placement combinations.</p>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card">
        <h2>Search customer history</h2>
        <div className="inline-form-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, SKU, color, size, logo..." />
          <button type="button" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
        </div>
      </section>

      <section className="card table-card">
        <h2>Reorder Signals</h2>
        <div className="responsive-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th><th>Item</th><th>Logo / Placement</th><th>Jobs</th><th>Total Units</th><th>Avg / Job</th><th>Last Seen</th><th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.customer_name}-${row.blank_product_id}-${row.logo}-${row.placement}`}>
                  <td><strong>{row.customer_name}</strong></td>
                  <td><strong>{row.sku_base}</strong><br /><small>{[row.brand, row.style, row.color, row.size].filter(Boolean).join(' / ')}</small></td>
                  <td>{row.logo}<br /><small>{row.placement}</small></td>
                  <td>{row.job_count}</td>
                  <td>{row.total_units_ordered}</td>
                  <td>{row.average_units_per_job}</td>
                  <td>{row.last_seen_date || '—'}</td>
                  <td>{row.reorder_signal}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="8">No reorder history found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
