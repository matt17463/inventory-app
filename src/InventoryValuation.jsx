import { useEffect, useMemo, useState } from 'react';
import { getInventoryValuation, money, updateBlankProductUnitCost } from './lib/inventoryApi';

export default function InventoryValuation() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [costInputs, setCostInputs] = useState({});
  const [savingCostId, setSavingCostId] = useState(null);

  async function loadValuation() {
    try {
      const data = await getInventoryValuation();
      setRows(data);
      setCostInputs(
        Object.fromEntries(
          data.map((row) => [row.blank_product_id, Number(row.unit_cost || 0).toFixed(2)])
        )
      );
    } catch (err) {
      setMessage(err.message || 'Failed to load valuation.');
    }
  }

  useEffect(() => {
    loadValuation();
  }, []);

  async function saveUnitCost(blankProductId) {
    setSavingCostId(blankProductId);
    setMessage('');

    try {
      await updateBlankProductUnitCost(blankProductId, costInputs[blankProductId]);
      await loadValuation();
      setMessage('Unit cost saved and valuation refreshed.');
    } catch (err) {
      setMessage(err.message || 'Failed to save unit cost.');
    } finally {
      setSavingCostId(null);
    }
  }

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
                  <td>
                    <div className="inline-cost-editor">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={costInputs[row.blank_product_id] ?? ''}
                        onChange={(event) =>
                          setCostInputs((current) => ({
                            ...current,
                            [row.blank_product_id]: event.target.value,
                          }))
                        }
                        aria-label={`Unit cost for ${row.sku_base}`}
                      />
                      <button
                        type="button"
                        onClick={() => saveUnitCost(row.blank_product_id)}
                        disabled={savingCostId === row.blank_product_id}
                      >
                        {savingCostId === row.blank_product_id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </td>
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
