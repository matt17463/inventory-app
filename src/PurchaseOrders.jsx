import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPurchaseOrders, money } from './lib/inventoryApi';

function number(value) {
  return Number(value || 0).toLocaleString();
}

export default function PurchaseOrders() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('open');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadRows() {
    setLoading(true);
    setMessage('');
    try {
      setRows(await getPurchaseOrders(status));
    } catch (err) {
      setMessage(err.message || 'Failed to load purchase orders. Run Phase 1 SQL first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRows(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.orders += 1;
    acc.units += Number(row.total_units_ordered || 0);
    acc.open += Number(row.total_units_open || 0);
    acc.value += Number(row.estimated_total_cost || 0);
    return acc;
  }, { orders: 0, units: 0, open: 0, value: 0 }), [rows]);

  return (
    <main className="page phase1-page">
      <section className="page-header phase1-header">
        <div>
          <p className="eyebrow">Purchasing Phase 1</p>
          <h1>Purchase Orders</h1>
          <p>Track blank purchase orders, expected arrivals, received quantities, and open units.</p>
        </div>
        <div className="phase1-actions">
          <Link className="secondary-button" to="/purchasing">Purchasing Report</Link>
          <Link className="primary-action" to="/purchase-orders/new">Create PO</Link>
        </div>
      </section>

      {message && <p className="message error-message">{message}</p>}

      <section className="kpi-grid phase1-kpis">
        <div className="kpi-card"><span>{number(totals.orders)}</span><strong>Orders</strong><small>Visible POs</small></div>
        <div className="kpi-card"><span>{number(totals.units)}</span><strong>Units Ordered</strong><small>Total units</small></div>
        <div className="kpi-card"><span>{number(totals.open)}</span><strong>Open Units</strong><small>Not received</small></div>
        <div className="kpi-card"><span>{money(totals.value)}</span><strong>Estimated Cost</strong><small>All visible POs</small></div>
      </section>

      <section className="card elevated-card purchasing-controls">
        <div className="segmented-tabs">
          {['open', 'draft', 'ordered', 'partial', 'received', 'cancelled', 'all'].map((value) => (
            <button key={value} type="button" className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{value}</button>
          ))}
        </div>
      </section>

      <section className="card elevated-card table-card">
        <h2>Purchase Order List</h2>
        {loading ? <p>Loading purchase orders...</p> : (
          <div className="responsive-table">
            <table className="data-table phase1-table">
              <thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Expected</th><th>Lines</th><th>Ordered</th><th>Received</th><th>Open</th><th>Estimated Cost</th><th>Actions</th></tr></thead>
              <tbody>
                {!rows.length ? <tr><td colSpan="10">No purchase orders found.</td></tr> : rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.po_number}</strong></td>
                    <td>{row.supplier_name}</td>
                    <td><span className={`status-pill status-${row.status}`}>{row.status}</span></td>
                    <td>{row.expected_at || ''}</td>
                    <td>{number(row.line_count)}</td>
                    <td>{number(row.total_units_ordered)}</td>
                    <td>{number(row.total_units_received)}</td>
                    <td><strong>{number(row.total_units_open)}</strong></td>
                    <td>{money(row.estimated_total_cost)}</td>
                    <td><Link to={`/purchase-orders/${row.id}/receive`}>Open / Receive</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
