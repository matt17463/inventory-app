import { useEffect, useMemo, useState } from 'react';
import { getInventoryValuation, money } from './lib/inventoryApi';

export default function InventoryValuation() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getInventoryValuation().then(setRows).catch((err) => setMessage(err.message || 'Failed to load valuation.'));
  }, []);

  const totalValue = useMemo(() => rows.reduce((sum, row) => sum + Number(row.inventory_value || 0), 0), [rows]);
  const totalUnits = useMemo(() => rows.reduce((sum, row) => sum + Number(row.total_quantity || 0), 0), [rows]);

  return (
    <main className="page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Accounting Snapshot</p>
          <h1>Inventory Valuation</h1>
          <p className="helper-text">Estimated blank inventory value based on unit_cost on each blank product.</p>
        </div>
      </div>

      <section className="kpi-grid mini-kpis">
        <div className="kpi-card"><span>{totalUnits}</span><strong>Total units</strong></div>
        <div className="kpi-card"><span>{money(totalValue)}</span><strong>Total value</strong></div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card wide-card">
        <div className="responsive-table">
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Brand</th><th>Color</th><th>Size</th><th>Qty</th><th>Unit Cost</th><th>Value</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.blank_product_id}>
                  <td><strong>{row.sku_base}</strong></td>
                  <td>{row.name}</td>
                  <td>{row.brand}</td>
                  <td>{row.color}</td>
                  <td>{row.size}</td>
                  <td>{row.total_quantity}</td>
                  <td>{money(row.unit_cost)}</td>
                  <td><strong>{money(row.inventory_value)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
