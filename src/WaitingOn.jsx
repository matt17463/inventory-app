import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWaitingOnItems } from './lib/inventoryApi';

function number(value) {
  return Number(value || 0).toLocaleString();
}

export default function WaitingOn() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadRows() {
    setLoading(true);
    setMessage('');
    try {
      setRows(await getWaitingOnItems(search));
    } catch (err) {
      setMessage(err.message || 'Failed to load waiting-on dashboard. Run Phase 1 SQL first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRows(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.lines += 1;
    acc.short += Number(row.short_quantity || 0);
    acc.openPo += Number(row.open_po_quantity || 0);
    acc.uncovered += Math.max(Number(row.short_quantity || 0) - Number(row.open_po_quantity || 0), 0);
    return acc;
  }, { lines: 0, short: 0, openPo: 0, uncovered: 0 }), [rows]);

  return (
    <main className="page phase1-page">
      <section className="page-header phase1-header">
        <div>
          <p className="eyebrow">Purchasing Phase 1</p>
          <h1>What Am I Waiting On?</h1>
          <p>See production shortages, whether they are covered by open purchase orders, and what still needs to be ordered.</p>
        </div>
        <div className="phase1-actions">
          <Link className="secondary-button" to="/purchase-orders/new">Create PO</Link>
          <Link className="secondary-button" to="/purchase-orders">Purchase Orders</Link>
        </div>
      </section>

      {message && <p className="message error-message">{message}</p>}

      <section className="kpi-grid phase1-kpis">
        <div className="kpi-card"><span>{number(totals.lines)}</span><strong>Short Lines</strong><small>Blocked items</small></div>
        <div className="kpi-card"><span>{number(totals.short)}</span><strong>Units Short</strong><small>Total shortage</small></div>
        <div className="kpi-card"><span>{number(totals.openPo)}</span><strong>On PO</strong><small>Open ordered units</small></div>
        <div className="kpi-card"><span>{number(totals.uncovered)}</span><strong>Uncovered</strong><small>Still needs order</small></div>
      </section>

      <section className="card elevated-card purchasing-controls">
        <div className="search-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadRows(); }} placeholder="Search order, customer, SKU, brand, style, color, size..." />
          <button type="button" onClick={loadRows}>Search</button>
        </div>
      </section>

      <section className="card elevated-card table-card">
        <h2>Blocked / Short Items</h2>
        {loading ? <p>Loading shortages...</p> : (
          <div className="responsive-table">
            <table className="data-table phase1-table">
              <thead><tr><th>Order / Job</th><th>Customer</th><th>SKU</th><th>Item</th><th>On Hand</th><th>Reserved</th><th>Available</th><th>Short</th><th>Open PO Qty</th><th>Next PO</th><th>ETA</th><th>Status</th></tr></thead>
              <tbody>
                {!rows.length ? <tr><td colSpan="12">No current shortages found.</td></tr> : rows.map((row) => {
                  const uncovered = Math.max(Number(row.short_quantity || 0) - Number(row.open_po_quantity || 0), 0);
                  return (
                    <tr key={`${row.blank_product_id}-${row.order_ref || 'shortage'}`} className={uncovered > 0 ? 'shortage-row' : 'covered-row'}>
                      <td>{row.order_ref || 'Unassigned'}</td>
                      <td>{row.customer_name || ''}</td>
                      <td><strong>{row.sku_base}</strong></td>
                      <td>{[row.brand, row.product_type, row.color, row.size].filter(Boolean).join(' / ')}</td>
                      <td>{number(row.quantity_on_hand)}</td>
                      <td>{number(row.reserved_quantity)}</td>
                      <td>{number(row.available_quantity)}</td>
                      <td><strong>{number(row.short_quantity)}</strong></td>
                      <td>{number(row.open_po_quantity)}</td>
                      <td>{row.next_po_number ? <Link to={`/purchase-orders/${row.next_purchase_order_id}/receive`}>{row.next_po_number}</Link> : ''}</td>
                      <td>{row.next_expected_at || ''}</td>
                      <td>{uncovered > 0 ? 'Needs PO' : 'Covered by PO'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
