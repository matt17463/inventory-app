import { useEffect, useMemo, useState } from 'react';
import {
  getPurchasingLowStock,
  getPurchasingRecommendedOrders,
  getPurchasingShortages,
  getPurchasingSupplierSummary,
  money,
} from './lib/inventoryApi';

function number(value) {
  return Number(value || 0).toLocaleString();
}

function downloadCsv(filename, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getOrderQuantity(row, tab) {
  if (tab === 'shortages') return Number(row.need_to_order || 0);
  if (tab === 'lowStock') return Number(row.reorder_quantity || 0);
  if (tab === 'recommended') return Number(row.recommended_order_quantity || 0);
  return 0;
}

function getEstimatedValue(row) {
  return Number(row.estimated_order_value || 0);
}

export default function Purchasing() {
  const [tab, setTab] = useState('recommended');
  const [search, setSearch] = useState('');
  const [shortages, setShortages] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recommendedOrders, setRecommendedOrders] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);
    setMessage('');

    try {
      const [shortageRows, lowStockRows, recommendedRows, summaryRows] = await Promise.all([
        getPurchasingShortages(search),
        getPurchasingLowStock(search),
        getPurchasingRecommendedOrders(search),
        getPurchasingSupplierSummary(),
      ]);

      setShortages(shortageRows);
      setLowStock(lowStockRows);
      setRecommendedOrders(recommendedRows);
      setSummary(summaryRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load purchasing reports. Run the purchasing SQL migration first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRows = useMemo(() => {
    if (tab === 'shortages') return shortages;
    if (tab === 'lowStock') return lowStock;
    if (tab === 'recommended') return recommendedOrders;
    return [];
  }, [tab, shortages, lowStock, recommendedOrders]);

  const totals = useMemo(() => {
    const rows = activeRows || [];
    return {
      lines: rows.length,
      units: rows.reduce((sum, row) => sum + getOrderQuantity(row, tab), 0),
      value: rows.reduce((sum, row) => sum + getEstimatedValue(row), 0),
    };
  }, [activeRows, tab]);

  function exportActiveRows() {
    if (tab === 'summary') {
      downloadCsv('purchasing-supplier-summary.csv', summary);
      return;
    }

    const rows = activeRows.map((row) => ({
      sku_base: row.sku_base,
      name: row.name,
      brand: row.brand,
      product_type: row.product_type,
      color: row.color,
      size: row.size,
      quantity_on_hand: row.quantity_on_hand,
      reserved_quantity: row.reserved_quantity,
      available_quantity: row.available_quantity,
      low_stock_threshold: row.low_stock_threshold,
      unit_cost: row.unit_cost,
      need_to_order: getOrderQuantity(row, tab),
      estimated_order_value: row.estimated_order_value,
    }));

    const filenameMap = {
      shortages: 'purchasing-current-shortages.csv',
      lowStock: 'purchasing-low-stock.csv',
      recommended: 'purchasing-recommended-orders.csv',
    };

    downloadCsv(filenameMap[tab] || 'purchasing-report.csv', rows);
  }

  const headingMap = {
    shortages: 'Current Shortages / Negative Inventory',
    lowStock: 'Low Stock Warnings',
    recommended: 'Recommended Orders',
  };

  const helpMap = {
    shortages: 'Shows items where reserved inventory is greater than on-hand inventory. These are immediate production shortages.',
    lowStock: 'Shows items where on-hand inventory is at or below your low-stock threshold.',
    recommended: 'Uses Reserved + Threshold - On Hand. This is the best buying list because it covers current commitments plus safety stock.',
  };

  return (
    <main className="page purchasing-page">
      <section className="page-header purchasing-header">
        <div>
          <p className="eyebrow">Purchasing</p>
          <h1>Blank Purchasing Report</h1>
          <p>
            Use this page to decide what blanks to order. The Recommended Orders tab combines
            current reservations with your low-stock thresholds so you can cover production needs and replenish safety stock.
          </p>
        </div>
        <div className="purchasing-actions">
          <button type="button" onClick={exportActiveRows} disabled={tab !== 'summary' && !activeRows.length}>
            Export CSV
          </button>
          <button type="button" className="secondary-button" onClick={loadData}>Refresh</button>
        </div>
      </section>

      <section className="kpi-grid purchasing-kpis">
        <div className="kpi-card"><span>{number(totals.lines)}</span><strong>Lines</strong><small>Items on current tab</small></div>
        <div className="kpi-card"><span>{number(totals.units)}</span><strong>Units to Order</strong><small>Based on current tab</small></div>
        <div className="kpi-card"><span>{money(totals.value)}</span><strong>Estimated Cost</strong><small>Uses unit cost</small></div>
      </section>

      <section className="card elevated-card purchasing-controls">
        <div className="segmented-tabs">
          <button type="button" className={tab === 'shortages' ? 'active' : ''} onClick={() => setTab('shortages')}>
            Current Shortages
          </button>
          <button type="button" className={tab === 'lowStock' ? 'active' : ''} onClick={() => setTab('lowStock')}>
            Low Stock
          </button>
          <button type="button" className={tab === 'recommended' ? 'active' : ''} onClick={() => setTab('recommended')}>
            Recommended Orders
          </button>
          <button type="button" className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
            Supplier Summary
          </button>
        </div>

        <div className="search-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') loadData(); }}
            placeholder="Search brand, style, color, size, SKU, or product name..."
          />
          <button type="button" onClick={loadData}>Search</button>
        </div>
      </section>

      {message && <p className="message error-message">{message}</p>}
      {loading ? <p>Loading purchasing report...</p> : null}

      {!loading && tab !== 'summary' && (
        <section className="card elevated-card table-card">
          <h2>{headingMap[tab]}</h2>
          <p className="helper-text">{helpMap[tab]}</p>

          <div className="responsive-table">
            <table className="data-table purchasing-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item</th>
                  <th>Brand</th>
                  <th>Style</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>On Hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Threshold</th>
                  <th>Order Qty</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.length === 0 ? (
                  <tr><td colSpan="12">No purchasing needs found for this section.</td></tr>
                ) : activeRows.map((row) => (
                  <tr key={`${tab}-${row.blank_product_id}`} className={Number(row.available_quantity) < 0 ? 'shortage-row' : ''}>
                    <td><strong>{row.sku_base}</strong></td>
                    <td>{row.name}</td>
                    <td>{row.brand}</td>
                    <td>{row.product_type}</td>
                    <td>{row.color}</td>
                    <td>{row.size}</td>
                    <td>{number(row.quantity_on_hand)}</td>
                    <td>{number(row.reserved_quantity)}</td>
                    <td>{number(row.available_quantity)}</td>
                    <td>{number(row.low_stock_threshold)}</td>
                    <td><strong>{number(getOrderQuantity(row, tab))}</strong></td>
                    <td>{money(row.estimated_order_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && tab === 'summary' && (
        <section className="card elevated-card table-card">
          <h2>Supplier / Brand Summary</h2>
          <p className="helper-text">This groups Recommended Orders by brand and style/product type for easier supplier ordering.</p>
          <div className="responsive-table">
            <table className="data-table purchasing-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Style</th>
                  <th>Lines</th>
                  <th>Units to Order</th>
                  <th>Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr><td colSpan="5">No supplier summary available.</td></tr>
                ) : summary.map((row) => (
                  <tr key={`${row.brand}-${row.product_type}`}>
                    <td>{row.brand}</td>
                    <td>{row.product_type}</td>
                    <td>{number(row.line_count)}</td>
                    <td><strong>{number(row.total_recommended_order_quantity)}</strong></td>
                    <td>{money(row.estimated_order_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card elevated-card guide-card">
        <h2>How to Use These Sections</h2>
        <ol>
          <li><strong>Current Shortages</strong>: order immediately if production depends on these blanks.</li>
          <li><strong>Low Stock</strong>: monitor and reorder when you want to maintain minimum shelf stock.</li>
          <li><strong>Recommended Orders</strong>: primary buying list. Formula: Reserved + Threshold - On Hand.</li>
          <li><strong>Supplier Summary</strong>: use this to group the recommended order by brand and style before placing vendor orders.</li>
        </ol>
      </section>
    </main>
  );
}
