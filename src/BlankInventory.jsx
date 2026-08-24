import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBlankInventory, getFinishedProducts } from './lib/inventoryApi';

function qty(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function statusLabel(row) {
  const status = String(row.inventory_status || '').replace(/_/g, ' ');
  if (status) return status;
  return qty(row.quantity_on_hand ?? row.total_quantity) > 0 ? 'in stock' : 'zero on hand';
}

function splitSkuList(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitSkuList);
  }

  return String(value || '')
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function compactSku(value, max = 38) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  const left = Math.max(12, Math.floor(max * 0.58));
  const right = Math.max(8, max - left - 1);
  return `${text.slice(0, left)}…${text.slice(-right)}`;
}


function compactDescription(value, max = 110) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function SkuChipList({ value, expanded, onToggle, emptyLabel = 'None linked' }) {
  const skus = splitSkuList(value);
  if (!skus.length) return <span className="inventory-muted-inline">{emptyLabel}</span>;

  const visible = expanded ? skus : skus.slice(0, 2);
  const hiddenCount = Math.max(0, skus.length - visible.length);

  return (
    <div className="inventory-sku-list">
      <div className="inventory-sku-chips">
        {visible.map((sku) => (
          <span className="inventory-sku-chip" key={sku} title={sku}>
            {compactSku(sku)}
          </span>
        ))}
      </div>
      {skus.length > 2 && (
        <button type="button" className="inventory-inline-button" onClick={onToggle}>
          {expanded ? 'Show fewer' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

function finishedStatusLabel(row) {
  const available = qty(firstValue(row, ['available_quantity', 'quantity_available', 'total_quantity', 'quantity_on_hand']));
  if (available > 0) return 'in stock';
  return 'zero on hand';
}

export default function BlankInventory() {
  const [mode, setMode] = useState('blank');
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [expandedSkuRows, setExpandedSkuRows] = useState({});
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);

  const modeCopy = useMemo(() => {
    if (mode === 'finished') {
      return {
        title: 'Finished products',
        tableTitle: 'Finished Products',
        description: 'Search decorated or completed products by any SKU, name, description, customer, logo, placement, blank, color, size, or bin.',
        placeholder: 'Search any SKU, name, description, customer, logo, placement...'
      };
    }

    return {
      title: 'Blank products',
      tableTitle: 'Blank Products',
      description: 'Search every blank SKU, linked Woo SKU, product name, description, brand, style, color, size, barcode, or status.',
      placeholder: 'Search any SKU, name, description, brand, style, color, size...'
    };
  }, [mode]);

  const load = useCallback(async ({ nextMode = mode, nextSearch = search } = {}) => {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;

    setMessage('');
    setLoading(true);
    setRows([]);
    setExpandedSkuRows({});

    try {
      const data = nextMode === 'finished'
        ? await getFinishedProducts(nextSearch)
        : await getBlankInventory(nextSearch);

      if (requestSeq.current !== requestId) return;

      setRows(data || []);
    } catch (err) {
      if (requestSeq.current !== requestId) return;
      setMessage(err.message || `Failed to load ${nextMode === 'finished' ? 'finished products' : 'blank products'}.`);
    } finally {
      if (requestSeq.current === requestId) {
        setLoading(false);
      }
    }
  }, [mode, search]);

  function changeMode(nextMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setMessage(`Switched to ${nextMode === 'finished' ? 'Finished Products' : 'Blank Products'} search.`);
  }

  useEffect(() => {
    load({ nextMode: mode, nextSearch: '' });
  }, [mode, load]);

  function rowKey(row, index) {
    return (
      row.product_row_id ||
      row.finished_product_id ||
      row.blank_product_id ||
      row.id ||
      row.sku_base ||
      row.finished_sku ||
      index
    );
  }

  function toggleSkuRow(key) {
    setExpandedSkuRows((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <main className="page inventory-overview-page">
      <div className="inventory-overview-header card">
        <div>
          <h1>Inventory Overview</h1>
          <p className="muted">
            Choose whether the search should look at blank products or finished products.
          </p>
        </div>
        <div className="inventory-mode-toggle" role="radiogroup" aria-label="Inventory search mode">
          <label className={`inventory-mode-option ${mode === 'blank' ? 'active' : ''}`}>
            <input
              type="radio"
              name="inventory-search-mode"
              value="blank"
              checked={mode === 'blank'}
              onChange={() => changeMode('blank')}
            />
            Blank Products
          </label>
          <label className={`inventory-mode-option ${mode === 'finished' ? 'active' : ''}`}>
            <input
              type="radio"
              name="inventory-search-mode"
              value="finished"
              checked={mode === 'finished'}
              onChange={() => changeMode('finished')}
            />
            Finished Products
          </label>
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); load({ nextMode: mode, nextSearch: search }); }} className="card inventory-search-card">
        <div className="inventory-search-copy">
          <h2>{modeCopy.title}</h2>
          <p className="muted">{modeCopy.description}</p>
          <p className="inventory-current-mode-note">Current search mode: <strong>{modeCopy.tableTitle}</strong></p>
        </div>
        <div className="inventory-search-controls">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={modeCopy.placeholder}
          />
          <button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
        </div>
      </form>

      {message && <p className="message">{message}</p>}
      {loading && (
        <p className="message">Loading {mode === 'finished' ? 'finished products' : 'blank products'}...</p>
      )}

      {mode === 'blank' ? (
        <section className="card inventory-table-card">
          <div className="inventory-table-heading">
            <h2>Blank Products</h2>
            <span className="muted">{rows.length} result(s)</span>
          </div>
          <div className="inventory-overview-table-wrap">
            <table className="inventory-overview-table">
              <thead>
                <tr>
                  <th>Blank SKU</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Brand</th>
                  <th>Style</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>On Hand</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Linked Woo SKUs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const key = rowKey(row, index);
                  return (
                    <tr key={key}>
                      <td className="inventory-primary-sku" title={row.blank_sku || row.sku_base || ''}>
                        {compactSku(row.blank_sku || row.sku_base || '')}
                      </td>
                      <td>{row.name || row.blank_product_name || row.woo_product_name || ''}</td>
                      <td className="inventory-description-cell" title={row.description || row.search_description || ''}>
                        {compactDescription(row.description || row.search_description || '')}
                      </td>
                      <td>{row.brand || ''}</td>
                      <td>{row.product_type || row.style || ''}</td>
                      <td>{row.color || ''}</td>
                      <td>{row.size || ''}</td>
                      <td>{qty(row.quantity_on_hand ?? row.on_hand_quantity ?? row.total_quantity)}</td>
                      <td>{qty(row.available_quantity ?? row.quantity_on_hand ?? row.on_hand_quantity ?? row.total_quantity)}</td>
                      <td>{statusLabel(row)}</td>
                      <td className="inventory-linked-skus-cell">
                        <SkuChipList
                          value={row.woo_sku || row.linked_woo_skus || row.woo_skus || ''}
                          expanded={Boolean(expandedSkuRows[key])}
                          onToggle={() => toggleSkuRow(key)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan="11" className="inventory-empty-cell">
                      No blank products matched this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card inventory-table-card">
          <div className="inventory-table-heading">
            <h2>Finished Products</h2>
            <span className="muted">{rows.length} result(s)</span>
          </div>
          <div className="inventory-overview-table-wrap">
            <table className="inventory-overview-table">
              <thead>
                <tr>
                  <th>Finished SKU</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Customer</th>
                  <th>Logo / Placement</th>
                  <th>Blank SKU</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>On Hand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const key = rowKey(row, index);
                  const logoPlacement = [firstValue(row, ['logo', 'logo_name']), row.placement]
                    .filter(Boolean)
                    .join(' / ');
                  return (
                    <tr key={key}>
                      <td className="inventory-primary-sku" title={row.finished_sku || row.sku || ''}>
                        {compactSku(row.finished_sku || row.sku || '')}
                      </td>
                      <td>{row.finished_name || row.name || ''}</td>
                      <td className="inventory-description-cell" title={row.description || row.search_description || ''}>
                        {compactDescription(row.description || row.search_description || '')}
                      </td>
                      <td>{row.customer || row.customer_name || ''}</td>
                      <td>{logoPlacement}</td>
                      <td title={firstValue(row, ['blank_sku_base', 'blank_sku', 'sku_base'])}>
                        {compactSku(firstValue(row, ['blank_sku_base', 'blank_sku', 'sku_base']))}
                      </td>
                      <td>{row.color || row.color_code || ''}</td>
                      <td>{row.size || row.size_code || ''}</td>
                      <td>{qty(firstValue(row, ['total_quantity', 'quantity_on_hand', 'on_hand_quantity']))}</td>
                      <td>{row.inventory_status || finishedStatusLabel(row)}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan="10" className="inventory-empty-cell">
                      No finished products matched this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
