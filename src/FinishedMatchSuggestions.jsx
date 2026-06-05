import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFinishedMatchSuggestions, useFinishedInventoryForJobItem } from './lib/inventoryApi';

export default function FinishedMatchSuggestions() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

  async function load() {
    try {
      setRows(await getFinishedMatchSuggestions(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load finished inventory suggestions.');
    }
  }

  useEffect(() => { load(); }, []);

  async function apply(row) {
    const qty = Number(row.recommended_use_quantity || 0);
    if (!qty) return;
    setBusyKey(`${row.job_item_id}-${row.finished_product_id}`);
    setMessage('');
    try {
      await useFinishedInventoryForJobItem({
        jobItemId: row.job_item_id,
        finishedProductId: row.finished_product_id,
        quantity: qty,
        notes: `Used finished inventory suggestion ${row.finished_sku || ''}`,
      });
      setMessage(`Applied ${qty} finished unit(s) to ${row.job_name}.`);
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to use finished inventory.');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <main className="page phase2-page">
      <section className="page-header phase2-header">
        <div>
          <p className="eyebrow">Phase 2</p>
          <h1>Finished Inventory Match Suggestions</h1>
          <p>Find finished products that can satisfy pull sheet demand before producing more items.</p>
        </div>
        <Link className="secondary-button" to="/production-board">Production Board</Link>
      </section>

      <section className="card elevated-card phase2-actions">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job, customer, SKU, logo, placement..." />
        <button type="button" onClick={load}>Search</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card elevated-card table-card">
        <div className="responsive-table">
          <table className="data-table phase2-table">
            <thead>
              <tr><th>Job</th><th>Blank Needed</th><th>Finished Match</th><th>Available</th><th>Recommended</th><th>Action</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = `${row.job_item_id}-${row.finished_product_id}`;
                return (
                  <tr key={key}>
                    <td><strong>{row.job_name}</strong><br /><small>{row.customer_name} {row.woocommerce_order_id ? `· ${row.woocommerce_order_id}` : ''}</small></td>
                    <td>{row.blank_sku}<br /><small>{row.needed_quantity} needed · {row.remaining_needed} remaining</small></td>
                    <td>{row.finished_sku}<br /><small>{row.finished_logo || ''} {row.finished_placement ? `· ${row.finished_placement}` : ''}</small></td>
                    <td>{row.available_quantity}</td>
                    <td>{row.recommended_use_quantity}</td>
                    <td><button type="button" disabled={busyKey === key || !row.recommended_use_quantity} onClick={() => apply(row)}>Use Finished</button></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan="6">No finished inventory matches found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
