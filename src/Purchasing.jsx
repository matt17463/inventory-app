import { useEffect, useMemo, useState } from 'react';
import {
  getPurchasingReorderSuggestions,
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

export default function Purchasing() {
  const [tab, setTab] = useState('shortages');
  const [search, setSearch] = useState('');
  const [shortages, setShortages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);
    setMessage('');
    try {
      const [shortageRows, suggestionRows, summaryRows] = await Promise.all([
        getPurchasingShortages(search),
        getPurchasingReorderSuggestions(search),
        getPurchasingSupplierSummary(),
      ]);
      setShortages(shortageRows);
      setSuggestions(suggestionRows);
      setSummary(summaryRows);
    } catch (err) {
      setMessage(err.message || 'Failed to load purchasing report. Run the purchasing SQL migration first.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRows = tab === 'shortages' ? shortages : suggestions;

  const totals = useMemo(() => {
    const rows = activeRows || [];
    return {
      lines: rows.length,
      units: rows.reduce((sum, row) => sum + Number(row.need_to_order ?? row.recommended_order_quantity ?? 0), 0),
      value: rows.reduce((sum, row) => sum + Number(row.estimated_order_value ?? 0), 0),
    };
  }, [activeRows]);

  function exportActiveRows() {
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
      need_to_order: row.need_to_order ?? row.recommended_order_quantity,
      estimated_order_value: row.estimated_order_value,
    }));

    downloadCsv(tab === 'shortages' ? 'purchasing-shortages.csv' : 'purchasing-reorder-suggestions.csv', rows);
  }

  return (
    <main className="page purchasing-page">
      <section className="page-header purchasing-header">
        <div>
          <p className="eyebrow">Purchasing</p>
          <h1>Blank Purchasing Report</h1>
          <p>
            Use this page to find blanks that are negative or below your reorder target. Negative availability means
            current reservations exceed on-hand quantity and those blanks should be ordered for production.
          </p>
        </div>
        <div className="purchasing-actions">
          <button type="button" onClick={exportActiveRows} disabled={!activeRows.length}>Export CSV</button>
          <button type="button" className="secondary-button" onClick={loadData}>Refresh</button>
        </div>
      </section>

      <section className="kpi-grid purchasing-kpis">
        <div className="kpi-card"><span>{number(totals.lines)}</span><strong>Lines</strong><small>Items to review</small></div>
        <div className="kpi-card"><span>{number(totals.units)}</span><strong>Units to Order</strong><small>Based on current tab</small></div>
        <div className="kpi-card"><span>{money(totals.value)}</span><strong>Estimated Cost</strong><small>Uses unit cost</small></div>
      </section>

      <section className="card elevated-card purchasing-controls">
        <div className="segmented-tabs">
          <button type="button" className={tab === 'shortages' ? 'active' : ''} onClick={() => setTab('shortages')}>
            Shortages / Negative Inventory
          </button>
          <button type="button" className={tab === 'suggestions' ? 'active' : ''} onClick={() => setTab('suggestions')}>
            Reorder Suggestions
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
            placeholder="Search brand, style, color, size, or SKU..."
          />
          <button type="button" onClick={loadData}>Search</button>
        </div>
      </section>

      {message && <p className="message error-message">{message}</p>}
      {loading ? <p>Loading purchasing report...</p> : null}

      {!loading && tab !== 'summary' && (
        <section className="card elevated-card table-card">
          <h2>{tab === 'shortages' ? 'Shortages / Negative Inventory' : 'Reorder Suggestions'}</h2>
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
                  <tr><td colSpan="12">No purchasing needs found.</td></tr>
                ) : activeRows.map((row) => (
                  <tr key={row.blank_product_id} className={Number(row.available_quantity) < 0 ? 'shortage-row' : ''}>
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
                    <td><strong>{number(row.need_to_order ?? row.recommended_order_quantity)}</strong></td>
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
          <p className="helper-text">Use this as a quick supplier order planning summary grouped by brand and style.</p>
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
        <h2>How to Use This Report</h2>
        <ol>
          <li><strong>Shortages</strong> shows items where reservations exceed on-hand inventory. Order at least the “Order Qty.”</li>
          <li><strong>Reorder Suggestions</strong> adds your low-stock threshold, so you can cover current jobs plus safety stock.</li>
          <li><strong>Supplier Summary</strong> groups the order by brand and style for easier vendor purchasing.</li>
          <li>Export CSV and use it as your purchasing list when ordering blanks from suppliers.</li>
        </ol>
      </section>
    </main>
  );
}
