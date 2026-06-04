import { useEffect, useState } from 'react';
import { getWooSyncQueue } from './lib/inventoryApi';

export default function WooSync() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setRows(await getWooSyncQueue(100));
    } catch (err) {
      setMessage(err.message || 'Failed to load WooCommerce sync queue.');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Integration Monitor</p>
          <h1>WooCommerce Sync Queue</h1>
          <p className="helper-text">This app records inventory events for WooCommerce sync. It does not block online ordering or force out-of-stock restrictions.</p>
        </div>
        <button type="button" onClick={load}>Refresh</button>
      </div>

      <section className="card">
        <h2>Important</h2>
        <p>
          Reservation records are internal planning holds. They reduce the app's available quantity number, but they do not prevent WooCommerce customers from ordering out-of-stock items.
        </p>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card wide-card">
        <div className="responsive-table">
          <table>
            <thead><tr><th>Created</th><th>Entity</th><th>Action</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.entity_type} {row.entity_id}</td>
                  <td>{row.action}</td>
                  <td>{row.status}</td>
                  <td>{row.attempt_count || 0}</td>
                  <td>{row.last_error || ''}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6">No sync records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
