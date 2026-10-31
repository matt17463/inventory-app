import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLowStockItems } from './lib/inventoryApi';

export default function LowStock() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLowStockItems().then(setRows).catch((err) => setMessage(err.message || 'Failed to load low-stock items.')).finally(() => setLoading(false));
  }, []);

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Reorder Watch</p>
          <h1>Low Stock Alerts {loading ? '' : `(${rows.length})`}</h1>
          <p className="helper-text">Items appear here when available quantity is at or below the product reorder threshold.</p>
        </div>
        <div className="button-row"><Link className="sc-btn" to="/purchase-orders/new">Generate Purchase Order</Link><Link className="sc-btn" to="/inventory/edit-blanks">Edit Thresholds</Link></div>
      </div>
      {message && <p className="message">{message}</p>}
      <section className="card wide-card">
        <div className="responsive-table">
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th>Color</th><th>Size</th><th>On Hand</th><th>Reserved</th><th>Available</th><th>Threshold</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.blank_product_id}>
                  <td><strong>{row.sku_base}</strong></td>
                  <td>{row.name}</td>
                  <td>{row.brand}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td>{row.total_quantity}</td>
                  <td>{row.reserved_quantity}</td>
                  <td className="warning-text"><strong>{row.available_quantity}</strong></td>
                  <td>{row.low_stock_threshold}</td>
                </tr>
              ))}
              {loading && <tr><td colSpan="9">Loading low-stock items…</td></tr>}
              {!loading && !message && rows.length === 0 && <tr><td colSpan="9">No low-stock items.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
