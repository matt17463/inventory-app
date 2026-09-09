import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPurchasingLowStock,
  getPurchasingRecommendedOrders,
  getPurchasingShortages,
  getPurchasingSupplierSummary,
  money,
} from './lib/inventoryApi';
import {
  fixPurchasingPairing,
  reusableMappingSummary,
  searchPurchasingPairingBlanks,
  sourceHasReusableMappingKey,
} from './lib/purchasingPairingApi';
import './purchasingPairing.css';

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

function buildSupplierSummaryFromRecommended(rows) {
  const grouped = new Map();

  (rows || []).forEach((row) => {
    const brand = row?.brand || 'Unspecified';
    const productType = row?.product_type || 'Unspecified';
    const key = `${brand}::${productType}`;
    const current = grouped.get(key) || {
      brand,
      product_type: productType,
      line_count: 0,
      total_recommended_order_quantity: 0,
      estimated_order_value: 0,
    };

    current.line_count += 1;
    current.total_recommended_order_quantity += Number(
      row?.recommended_order_quantity || 0
    );
    current.estimated_order_value += Number(row?.estimated_order_value || 0);
    grouped.set(key, current);
  });

  return [...grouped.values()].sort((a, b) => (
    String(a.brand).localeCompare(String(b.brand))
    || String(a.product_type).localeCompare(String(b.product_type))
  ));
}


function demandSources(row) {
  return Array.isArray(row?.demand_sources) ? row.demand_sources : [];
}

function sourceOrderLabel(source) {
  const raw = source?.order_number || source?.woocommerce_order_id || source?.order_id || '';
  return raw ? `Order #${raw}` : 'Order not recorded';
}

function sourcePullSheetLabel(source) {
  const raw = source?.job_id || source?.pullsheet_number || '';
  return raw ? `Pull Sheet #${raw}` : 'Pull sheet not recorded';
}

function sourceQuantity(source) {
  return Number(source?.quantity || source?.reserved_quantity || 0);
}

function DemandSourcesCell({ row, expanded, onToggle, onFixPairing }) {
  const sources = demandSources(row);
  const visibleSources = expanded ? sources : sources.slice(0, 2);
  const sourceCount = Number(row?.demand_source_count || sources.length || 0);

  if (!sources.length) {
    return (
      <td className="purchasing-source-cell muted-cell">
        {Number(row?.reserved_quantity || 0) > 0 ? 'No source details' : '—'}
      </td>
    );
  }

  return (
    <td className="purchasing-source-cell">
      <div className="source-summary-line">
        <strong>{sourceCount} source{sourceCount === 1 ? '' : 's'}</strong>
        {Number(row?.demand_total_quantity || 0) > 0 && (
          <span>Qty {number(row.demand_total_quantity)}</span>
        )}
      </div>

      <div className="source-chip-list">
        {visibleSources.map((source, index) => (
          <div className="source-chip" key={`${source.job_id || 'job'}-${source.job_item_id || index}`}>
            <div>
              <span>{sourceOrderLabel(source)}</span>
              {source?.customer_name && <small>{source.customer_name}</small>}
            </div>
            <small>
              Qty {number(sourceQuantity(source))}
              {source?.order_sku ? ` • ${source.order_sku}` : ''}
            </small>
            {source?.pairing_warning && <small className="warning-text">{source.pairing_warning}</small>}
            <div className="purchasing-source-actions">
              {source?.job_id ? (
                <Link to={`/pullsheets/${source.job_id}`}>{sourcePullSheetLabel(source)}</Link>
              ) : (
                <span>{sourcePullSheetLabel(source)}</span>
              )}
              {source?.job_item_id ? (
                <button
                  type="button"
                  className="pairing-fix-button"
                  onClick={() => onFixPairing(row, source)}
                >
                  Fix Pairing
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {sources.length > 2 && (
        <button type="button" className="link-button compact-button" onClick={onToggle}>
          {expanded ? 'Show fewer' : `Show ${sources.length - 2} more`}
        </button>
      )}
    </td>
  );
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
  const [expandedSources, setExpandedSources] = useState(() => new Set());
  const [pairingTarget, setPairingTarget] = useState(null);
  const [pairingSearch, setPairingSearch] = useState('');
  const [pairingResults, setPairingResults] = useState([]);
  const [selectedPairingBlank, setSelectedPairingBlank] = useState(null);
  const [pairingReason, setPairingReason] = useState('Correcting blank pairing from Purchasing Report.');
  const [rememberPairing, setRememberPairing] = useState(true);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingMessage, setPairingMessage] = useState('');

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
      const correctedSummary = buildSupplierSummaryFromRecommended(recommendedRows);
      setSummary(correctedSummary.length ? correctedSummary : summaryRows);
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

  function toggleSourceDetails(rowKey) {
    setExpandedSources((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }

  function openPairingFix(row, source) {
    const canRemember = sourceHasReusableMappingKey(source);
    setPairingTarget({ row, source });
    setPairingSearch([row?.brand, row?.product_type, row?.color, row?.size].filter(Boolean).join(' '));
    setPairingResults([]);
    setSelectedPairingBlank(null);
    setPairingReason('Correcting blank pairing from Purchasing Report.');
    setRememberPairing(canRemember);
    setPairingMessage('');
  }

  function closePairingFix() {
    if (pairingBusy) return;
    setPairingTarget(null);
    setPairingSearch('');
    setPairingResults([]);
    setSelectedPairingBlank(null);
    setPairingMessage('');
  }

  async function searchPairingBlanks(event) {
    event?.preventDefault?.();
    setPairingBusy(true);
    setPairingMessage('');
    setSelectedPairingBlank(null);
    try {
      const rows = await searchPurchasingPairingBlanks(pairingSearch);
      setPairingResults(rows);
      if (!rows.length) setPairingMessage('No active blank products matched that search.');
    } catch (err) {
      setPairingMessage(err.message || 'Could not search blank products.');
    } finally {
      setPairingBusy(false);
    }
  }

  async function savePairingFix() {
    if (!pairingTarget?.source?.job_item_id) {
      setPairingMessage('This purchasing source does not have a pull-sheet line ID to repair.');
      return;
    }
    if (!selectedPairingBlank?.id) {
      setPairingMessage('Choose the correct replacement blank product first.');
      return;
    }

    const currentSku = pairingTarget?.row?.sku_base || pairingTarget?.row?.name || 'current blank';
    const nextSku = selectedPairingBlank?.sku_base || selectedPairingBlank?.name || 'selected blank';
    const confirmed = window.confirm(
      `Change this purchasing demand from ${currentSku} to ${nextSku}?\n\n`
      + 'The pull-sheet pairing and its existing reservation will be corrected. '
      + (rememberPairing ? 'A reusable WooCommerce mapping will also be saved when a stable variation/SKU/product key is available.' : 'Future-order mapping will not be changed.')
    );
    if (!confirmed) return;

    setPairingBusy(true);
    setPairingMessage('');
    try {
      const result = await fixPurchasingPairing({
        jobItemId: pairingTarget.source.job_item_id,
        newBlankProductId: selectedPairingBlank.id,
        reason: pairingReason,
        rememberMapping: rememberPairing,
      });

      const saved = Number(result?.mappings_saved || 0);
      const extra = saved
        ? ` Saved ${saved} reusable mapping rule${saved === 1 ? '' : 's'}.`
        : (result?.mapping_skipped_reason ? ` ${result.mapping_skipped_reason}` : '');
      setPairingTarget(null);
      setPairingResults([]);
      setSelectedPairingBlank(null);
      await loadData();
      setMessage(`Blank pairing corrected from Purchasing Report.${extra}`);
    } catch (err) {
      setPairingMessage(err.message || 'Could not correct the purchasing pairing.');
    } finally {
      setPairingBusy(false);
    }
  }

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
      related_orders: row.demand_order_numbers || '',
      related_pull_sheets: row.demand_pullsheet_numbers || '',
      related_source_count: row.demand_source_count || 0,
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
    shortages: 'Shows items where reserved inventory is greater than on-hand inventory, including pull-sheet lines assigned to Pending Stock. These are immediate production shortages.',
    lowStock: 'Shows items where on-hand inventory is at or below your low-stock threshold.',
    recommended: 'Uses Reserved + Pending Stock + Threshold - On Hand. The Create Purchase Order screen uses this same list and separately shows quantities already covered by open purchase orders.',
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
          <Link className="primary-action" to="/purchase-orders/new">Create Purchase Order</Link>
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
            placeholder="Search brand, style, color, size, SKU, order #, or pull sheet #..."
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
                  <th>Orders / Pull Sheets</th>
                  <th>Available</th>
                  <th>Threshold</th>
                  <th>Order Qty</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.length === 0 ? (
                  <tr><td colSpan="13">No purchasing needs found for this section.</td></tr>
                ) : activeRows.map((row) => {
                  const rowKey = `${tab}-${row.blank_product_id}`;

                  return (
                    <tr key={rowKey} className={Number(row.available_quantity) < 0 ? 'shortage-row' : ''}>
                      <td><strong>{row.sku_base}</strong></td>
                      <td>
                        {row.name}
                        {Number(row.pending_stock_quantity || 0) > 0 && (
                          <><br /><small className="warning-text">Unreserved Pending Stock: {number(row.pending_stock_quantity)}</small></>
                        )}
                        {Number(row.non_inventory_purchase_quantity || 0) > 0 && (
                          <><br /><small className="warning-text">Non-Inventory Purchasing: {number(row.non_inventory_purchase_quantity)}</small></>
                        )}
                      </td>
                      <td>{row.brand}</td>
                      <td>{row.product_type}</td>
                      <td>{row.color}</td>
                      <td>{row.size}</td>
                      <td>{number(row.quantity_on_hand)}</td>
                      <td>{number(row.reserved_quantity)}</td>
                      <DemandSourcesCell
                        row={row}
                        expanded={expandedSources.has(rowKey)}
                        onToggle={() => toggleSourceDetails(rowKey)}
                        onFixPairing={openPairingFix}
                      />
                      <td>{number(row.available_quantity)}</td>
                      <td>{number(row.low_stock_threshold)}</td>
                      <td><strong>{number(getOrderQuantity(row, tab))}</strong></td>
                      <td>{money(row.estimated_order_value)}</td>
                    </tr>
                  );
                })}
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

      {pairingTarget ? (
        <div className="purchasing-pairing-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePairingFix(); }}>
          <section className="purchasing-pairing-modal" role="dialog" aria-modal="true" aria-labelledby="purchasing-pairing-title">
            <h2 id="purchasing-pairing-title">Fix Blank Pairing</h2>
            <p>Correct the pull-sheet line that is currently creating purchasing demand against the wrong blank product.</p>

            <div className="purchasing-pairing-summary">
              <div>
                <span>Order / Pull Sheet</span>
                <strong>{sourceOrderLabel(pairingTarget.source)}</strong>
                <small>{sourcePullSheetLabel(pairingTarget.source)} • Line #{pairingTarget.source.job_item_id}</small>
              </div>
              <div>
                <span>Ordered Item</span>
                <strong>{pairingTarget.source.order_sku || pairingTarget.source.item_name || '—'}</strong>
                <small>Qty {number(sourceQuantity(pairingTarget.source))}</small>
              </div>
              <div>
                <span>Currently Paired Blank</span>
                <strong>{pairingTarget.row.sku_base || pairingTarget.row.name || '—'}</strong>
                <small>{[pairingTarget.row.brand, pairingTarget.row.product_type, pairingTarget.row.color, pairingTarget.row.size].filter(Boolean).join(' / ')}</small>
              </div>
            </div>

            <form onSubmit={searchPairingBlanks}>
              <label>Search correct blank product</label>
              <div className="purchasing-pairing-search-row">
                <input
                  value={pairingSearch}
                  onChange={(event) => setPairingSearch(event.target.value)}
                  placeholder="Brand, style, color, size, SKU, or name"
                  autoFocus
                />
                <button type="submit" disabled={pairingBusy}>{pairingBusy ? 'Searching…' : 'Search'}</button>
              </div>
            </form>

            {pairingResults.length ? (
              <div className="purchasing-pairing-results">
                {pairingResults.map((blank) => (
                  <button
                    type="button"
                    key={blank.id}
                    className={`purchasing-pairing-result ${selectedPairingBlank?.id === blank.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPairingBlank(blank)}
                  >
                    <strong>{blank.sku_base || blank.name}</strong>
                    <span>{blank.label || [blank.brand, blank.product_type, blank.color, blank.size].filter(Boolean).join(' / ')}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {selectedPairingBlank ? (
              <div className="purchasing-pairing-note">
                Selected replacement: <strong>{selectedPairingBlank.sku_base || selectedPairingBlank.name}</strong>
              </div>
            ) : null}

            <div className="purchasing-pairing-options">
              <label>
                Reason / note
                <textarea
                  value={pairingReason}
                  onChange={(event) => setPairingReason(event.target.value)}
                  rows={3}
                  placeholder="Example: Woo variation was paired to the wrong hoodie style."
                />
              </label>

              {sourceHasReusableMappingKey(pairingTarget.source) ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={rememberPairing}
                    onChange={(event) => setRememberPairing(event.target.checked)}
                  />
                  <span>
                    <strong>Remember this pairing for future orders</strong>
                    <small>{reusableMappingSummary(pairingTarget.source)}</small>
                  </span>
                </label>
              ) : (
                <div className="purchasing-pairing-note">
                  No reusable WooCommerce variation/SKU/product ID was captured for this source. The current pull-sheet line can still be corrected, but no future rule will be created.
                </div>
              )}
            </div>

            {pairingMessage ? <p className="message error-message">{pairingMessage}</p> : null}

            <div className="purchasing-pairing-modal-actions">
              <button type="button" className="secondary-button" onClick={closePairingFix} disabled={pairingBusy}>Cancel</button>
              <button type="button" onClick={savePairingFix} disabled={pairingBusy || !selectedPairingBlank}>
                {pairingBusy ? 'Saving…' : 'Save Pairing Correction'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="card elevated-card guide-card">
        <h2>How to Use These Sections</h2>
        <ol>
          <li><strong>Current Shortages</strong>: order immediately if production depends on these blanks.</li>
          <li><strong>Low Stock</strong>: monitor and reorder when you want to maintain minimum shelf stock.</li>
          <li><strong>Recommended Orders</strong>: primary buying list. Formula: Reserved + Threshold - On Hand.</li>
          <li><strong>Orders / Pull Sheets</strong>: open the pull sheet or use <strong>Fix Pairing</strong> directly from Purchasing. A saved correction updates the current pull-sheet reservation and can remember the Woo variation/SKU for future orders.</li>
          <li><strong>Supplier Summary</strong>: use this to group the recommended order by brand and style before placing vendor orders.</li>
        </ol>
      </section>
    </main>
  );
}
