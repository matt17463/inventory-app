import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  applyBulkPairingRepair,
  formatBlankProductLabel,
  getBlankProducts,
  previewBulkPairingRepair,
} from './lib/inventoryApi';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'queued', label: 'Queued / Open' },
  { value: 'ready_to_pull', label: 'Ready to Pull' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'waiting_on_blanks', label: 'Waiting on Blanks' },
  { value: 'in_production', label: 'In Production' },
  { value: 'completed', label: 'Completed / Filled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'voided', label: 'Voided' },
];

function dateForInput(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString();
}

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function blankLabel(blank) {
  if (!blank) return '—';
  return formatBlankProductLabel(blank) || blank.sku_base || blank.name || blank.id || 'Blank product';
}

function normalizeSearchValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function searchTokens(term) {
  return String(term || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function blankSearchText(blank) {
  return [
    blank?.sku_base,
    blank?.barcode,
    blank?.name,
    blank?.brand,
    blank?.style,
    blank?.color,
    blank?.size,
    blank?.brands?.name,
    blank?.brands?.code,
    blank?.product_types?.name,
    blank?.product_types?.code,
    blank?.colors?.name,
    blank?.colors?.code,
    blank?.sizes?.name,
    blank?.sizes?.code,
    formatBlankProductLabel(blank),
  ].filter(Boolean).join(' ');
}

function blankMatchesTokens(blank, term) {
  const tokens = searchTokens(term);
  if (!tokens.length) return true;
  const raw = blankSearchText(blank).toLowerCase();
  const normalized = normalizeSearchValue(raw);
  return tokens.every((token) => raw.includes(token) || normalized.includes(normalizeSearchValue(token)));
}

function normalizeBlankSearchRow(row) {
  const item = row?.item || row?.result || row?.sc_search_blank_products_for_pairing || row || {};
  return {
    ...item,
    brands: item.brands || item.brand_obj || (item.brand || item.brand_code ? { name: item.brand, code: item.brand_code } : null),
    product_types: item.product_types || item.product_type_obj || (item.style || item.product_type || item.style_code ? { name: item.style || item.product_type, code: item.style_code } : null),
    colors: item.colors || item.color_obj || (item.color || item.color_code ? { name: item.color, code: item.color_code } : null),
    sizes: item.sizes || item.size_obj || (item.size || item.size_code ? { name: item.size, code: item.size_code } : null),
  };
}

async function searchBlankProductsForPairing(term, limit = 100) {
  const cleanTerm = String(term || '').trim();

  // Preferred path: server-side token search. This searches the full blank catalog instead of
  // loading only the first page of blanks and filtering in the browser.
  const rpc = await supabase.rpc('sc_search_blank_products_for_pairing', {
    p_search: cleanTerm,
    p_limit: limit,
  });

  if (!rpc.error) {
    return (rpc.data || []).map(normalizeBlankSearchRow).filter((row) => row.id);
  }

  // Backward-compatible fallback while the SQL patch is being installed.
  const rows = await getBlankProducts(cleanTerm);
  return (rows || [])
    .map(normalizeBlankSearchRow)
    .filter((row) => row.id && blankMatchesTokens(row, cleanTerm))
    .slice(0, limit);
}

export default function BulkPairingRepair() {
  const [filters, setFilters] = useState({
    search: '',
    woocommerceOrderId: '',
    jobId: '',
    orderSku: '',
    currentBlankProductId: '',
    status: '',
    startAt: dateForInput(30),
    endAt: '',
    limit: 250,
  });
  const [blankSearch, setBlankSearch] = useState('');
  const [currentBlankSearch, setCurrentBlankSearch] = useState('');
  const [newBlankProductId, setNewBlankProductId] = useState('');
  const [blanks, setBlanks] = useState([]);
  const [currentBlanks, setCurrentBlanks] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [blankLoading, setBlankLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [applyOptions, setApplyOptions] = useState({
    clearReservations: true,
    recreateReservations: false,
    updateSourceMapping: false,
    clearFinishedProductLink: false,
    reason: '',
  });

  async function loadBlanks(term, setter) {
    setBlankLoading(true);
    try {
      const rows = await searchBlankProductsForPairing(term, 100);
      setter(rows);
    } catch (err) {
      setError(err.message || 'Failed to search blank products.');
    } finally {
      setBlankLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      loadBlanks(blankSearch, setBlanks);
    }, 250);
    return () => clearTimeout(handle);
  }, [blankSearch]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadBlanks(currentBlankSearch, setCurrentBlanks);
    }, 250);
    return () => clearTimeout(handle);
  }, [currentBlankSearch]);

  const selectedRows = useMemo(
    () => candidates.filter((row) => selectedIds.includes(row.job_item_id)),
    [candidates, selectedIds]
  );

  const selectedQuantity = useMemo(
    () => selectedRows.reduce((sum, row) => sum + numberValue(row.quantity), 0),
    [selectedRows]
  );

  const newBlank = useMemo(
    () => blanks.find((blank) => String(blank.id) === String(newBlankProductId)) || null,
    [blanks, newBlankProductId]
  );

  const filteredCandidates = candidates;
  const allVisibleSelected = filteredCandidates.length > 0 && filteredCandidates.every((row) => selectedIds.includes(row.job_item_id));

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCandidate(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    const ids = filteredCandidates.map((row) => row.job_item_id).filter(Boolean);
    setSelectedIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !ids.includes(id));
      return Array.from(new Set([...prev, ...ids]));
    });
  }

  function buildOptions(extra = {}) {
    return {
      ...filters,
      currentBlankProductId: filters.currentBlankProductId || null,
      newBlankProductId,
      jobItemIds: extra.selectedOnly ? selectedIds : null,
      limit: Number(filters.limit || 250),
      ...extra,
    };
  }

  async function handlePreview(event) {
    event?.preventDefault?.();
    setPreviewLoading(true);
    setMessage('');
    setError('');
    setResult(null);

    try {
      const rows = await previewBulkPairingRepair(buildOptions());
      setCandidates(rows || []);
      setSelectedIds((rows || []).map((row) => row.job_item_id));
      setMessage(`Preview found ${(rows || []).length} matching pull sheet line(s). Review the list before applying.`);
    } catch (err) {
      setError(err.message || 'Bulk pairing preview failed.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleApply() {
    setMessage('');
    setError('');
    setResult(null);

    if (!newBlankProductId) {
      setError('Choose the correct replacement blank product before applying.');
      return;
    }

    if (!selectedIds.length) {
      setError('Select at least one line to repair.');
      return;
    }

    const confirmation = [
      `Repair ${selectedIds.length} selected pull sheet line(s)?`,
      `New blank: ${blankLabel(newBlank)}`,
      applyOptions.updateSourceMapping ? 'Future orders for the selected SKU(s) may also be changed.' : 'Only selected existing pull sheet lines will be changed.',
    ].join('\n');

    if (!window.confirm(confirmation)) return;

    setPreviewLoading(true);
    try {
      const data = await applyBulkPairingRepair(
        buildOptions({
          selectedOnly: true,
          clearReservations: applyOptions.clearReservations,
          recreateReservations: applyOptions.recreateReservations,
          updateSourceMapping: applyOptions.updateSourceMapping,
          clearFinishedProductLink: applyOptions.clearFinishedProductLink,
          reason: applyOptions.reason,
          dryRun: false,
        })
      );
      setResult(data);
      setMessage(`Bulk pairing repair complete. Updated ${data.updated || 0}; failed ${data.failed || 0}.`);
      await handlePreview();
    } catch (err) {
      setError(err.message || 'Bulk pairing repair failed.');
    } finally {
      setPreviewLoading(false);
    }
  }

  function applyQuickSearch(row) {
    setFilters((prev) => ({
      ...prev,
      orderSku: row.order_sku || prev.orderSku,
      currentBlankProductId: row.current_blank_product_id || prev.currentBlankProductId,
    }));
    if (row.current_blank_sku || row.current_blank_name) {
      setCurrentBlankSearch(row.current_blank_sku || row.current_blank_name);
    }
  }

  return (
    <main className="page bulk-pairing-page">
      <section className="hero-card bulk-pairing-hero">
        <div>
          <p className="eyebrow">Pull sheets</p>
          <h1>Bulk Pairing Repair</h1>
          <p>
            Find recent pull sheet lines paired to the wrong blank product, preview the affected orders,
            and update selected lines to the correct blank product in one controlled action.
          </p>
        </div>
        <div className="bulk-pairing-stats">
          <strong>{selectedIds.length}</strong>
          <span>Selected lines</span>
          <small>{selectedQuantity} total qty</small>
        </div>
      </section>

      {(message || error) && (
        <section className={error ? 'notice error' : 'notice success'}>{error || message}</section>
      )}

      <section className="panel bulk-pairing-panel">
        <div className="bulk-pairing-panel-head">
          <div>
            <h2>1. Find incorrectly paired lines</h2>
            <p>Use tight filters first: order SKU/item keywords, current wrong blank, date range, or a Woo order number. Multiple words such as <code>under black</code> match all terms, even when they are separated by hyphens or other SKU text.</p>
          </div>
          <Link className="secondary" to="/pullsheets">Back to Pull Sheets</Link>
        </div>

        <form className="bulk-pairing-grid" onSubmit={handlePreview}>
          <label>
            Search
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Customer, order, pull sheet, SKU, current blank..."
            />
          </label>
          <label>
            Woo order #
            <input
              value={filters.woocommerceOrderId}
              onChange={(event) => updateFilter('woocommerceOrderId', event.target.value)}
              placeholder="11895"
              inputMode="numeric"
            />
          </label>
          <label>
            Pull sheet #
            <input
              value={filters.jobId}
              onChange={(event) => updateFilter('jobId', event.target.value)}
              placeholder="Job ID"
              inputMode="numeric"
            />
          </label>
          <label>
            Ordered SKU / item contains
            <input
              value={filters.orderSku}
              onChange={(event) => updateFilter('orderSku', event.target.value)}
              placeholder="under black or BADGER 230100"
            />
          </label>
          <label>
            Current wrong blank search
            <input
              value={currentBlankSearch}
              onChange={(event) => setCurrentBlankSearch(event.target.value)}
              placeholder="Search current wrong blank..."
            />
          </label>
          <label>
            Current wrong blank
            <select
              value={filters.currentBlankProductId}
              onChange={(event) => updateFilter('currentBlankProductId', event.target.value)}
            >
              <option value="">Any current blank</option>
              {currentBlanks.map((blank) => (
                <option key={blank.id} value={blank.id}>{blankLabel(blank)}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Start date
            <input
              type="datetime-local"
              value={filters.startAt}
              onChange={(event) => updateFilter('startAt', event.target.value)}
            />
          </label>
          <label>
            End date
            <input
              type="datetime-local"
              value={filters.endAt}
              onChange={(event) => updateFilter('endAt', event.target.value)}
            />
          </label>
          <label>
            Limit
            <input
              type="number"
              min="1"
              max="2000"
              value={filters.limit}
              onChange={(event) => updateFilter('limit', event.target.value)}
            />
          </label>
          <div className="bulk-pairing-actions">
            <button type="submit" disabled={previewLoading}>{previewLoading ? 'Searching...' : 'Preview matching lines'}</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setFilters({ search: '', woocommerceOrderId: '', jobId: '', orderSku: '', currentBlankProductId: '', status: '', startAt: dateForInput(30), endAt: '', limit: 250 });
                setCandidates([]);
                setSelectedIds([]);
                setResult(null);
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="panel bulk-pairing-panel">
        <div className="bulk-pairing-panel-head">
          <div>
            <h2>2. Choose the correct blank product</h2>
            <p>This is the blank product that selected pull sheet lines should point to.</p>
          </div>
          {blankLoading ? <span className="muted">Searching blanks...</span> : null}
        </div>
        <div className="bulk-pairing-grid bulk-pairing-grid-narrow">
          <label>
            Search correct blank
            <input
              value={blankSearch}
              onChange={(event) => setBlankSearch(event.target.value)}
              placeholder="Example: under armour black one size"
            />
          </label>
          <label>
            Correct replacement blank
            <select value={newBlankProductId} onChange={(event) => setNewBlankProductId(event.target.value)}>
              <option value="">Choose correct blank product...</option>
              {blanks.map((blank) => (
                <option key={blank.id} value={blank.id}>{blankLabel(blank)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="bulk-blank-search-results">
          <div className="bulk-blank-search-results-head">
            <strong>Matching blank products</strong>
            <span>{blanks.length} result{blanks.length === 1 ? '' : 's'}</span>
          </div>
          {blanks.length ? (
            <div className="bulk-blank-result-list">
              {blanks.slice(0, 25).map((blank) => {
                const selected = String(blank.id) === String(newBlankProductId);
                return (
                  <button
                    key={blank.id}
                    type="button"
                    className={selected ? 'bulk-blank-result selected' : 'bulk-blank-result'}
                    onClick={() => setNewBlankProductId(blank.id)}
                  >
                    <strong>{blank.sku_base || blank.name || 'Blank product'}</strong>
                    <span>{blankLabel(blank)}</span>
                    {blank.image_url ? <img src={blank.image_url} alt="" loading="lazy" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="muted">No matching blanks yet. Try SKU, brand, style, color, or size terms.</p>
          )}
        </div>

        {newBlank ? (
          <div className="bulk-pairing-selected-blank">
            <strong>Replacement:</strong> {blankLabel(newBlank)}
          </div>
        ) : null}
      </section>

      <section className="panel bulk-pairing-panel">
        <div className="bulk-pairing-panel-head">
          <div>
            <h2>3. Review and select lines</h2>
            <p>Selected lines will be moved from their current blank to the correct blank.</p>
          </div>
          <div className="bulk-pairing-actions-inline">
            <button type="button" className="secondary" onClick={toggleAllVisible} disabled={!filteredCandidates.length}>
              {allVisibleSelected ? 'Clear visible' : 'Select visible'}
            </button>
            <button type="button" className="secondary" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>
              Clear all
            </button>
          </div>
        </div>

        <div className="bulk-pairing-summary-row">
          <span>{filteredCandidates.length} candidate line(s)</span>
          <span>{selectedIds.length} selected</span>
          <span>{selectedQuantity} selected qty</span>
        </div>

        <div className="table-scroll">
          <table className="data-table bulk-pairing-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Order / Pull Sheet</th>
                <th>Customer</th>
                <th>Ordered SKU</th>
                <th>Qty</th>
                <th>Currently paired to</th>
                <th>Reservations</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((row) => (
                <tr key={row.job_item_id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.job_item_id)}
                      onChange={() => toggleCandidate(row.job_item_id)}
                    />
                  </td>
                  <td>
                    <strong>Order #{row.woocommerce_order_id || '—'}</strong>
                    <small><Link to={`/pullsheets/${row.job_id}`}>Pull sheet #{row.job_id}</Link></small>
                    <small>{formatDateTime(row.order_placed_at)}</small>
                  </td>
                  <td>{row.customer_name || '—'}</td>
                  <td>
                    <code>{row.order_sku || '—'}</code>
                    <small>{row.item_name}</small>
                    <button type="button" className="link-button" onClick={() => applyQuickSearch(row)}>
                      Use this SKU/current blank as filter
                    </button>
                  </td>
                  <td>{numberValue(row.quantity)}</td>
                  <td>
                    <strong>{row.current_blank_sku || '—'}</strong>
                    <small>{row.current_blank_name}</small>
                  </td>
                  <td>
                    {row.reservation_count || 0} reservation(s)
                    <small>{numberValue(row.reserved_quantity)} reserved</small>
                  </td>
                  <td>
                    {row.pairing_source || '—'}
                    {row.pairing_warning ? <small className="warning-text">{row.pairing_warning}</small> : null}
                  </td>
                </tr>
              ))}
              {!filteredCandidates.length ? (
                <tr><td colSpan="8">No candidates yet. Enter filters and click Preview.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel bulk-pairing-panel bulk-pairing-apply-panel">
        <div>
          <h2>4. Apply repair</h2>
          <p>For accurate inventory, old reservations should usually be cleared. In V5, reservation recreation is optional and defaults off to prevent UUID/bigint reservation errors from blocking the pairing repair. Run the reservation retry tool after repairing if needed.</p>
        </div>
        <div className="bulk-pairing-options">
          <label>
            <input
              type="checkbox"
              checked={applyOptions.clearReservations}
              onChange={(event) => setApplyOptions((prev) => ({ ...prev, clearReservations: event.target.checked }))}
            />
            Clear existing reservations for selected lines
          </label>
          <label>
            <input
              type="checkbox"
              checked={applyOptions.recreateReservations}
              onChange={(event) => setApplyOptions((prev) => ({ ...prev, recreateReservations: event.target.checked }))}
            />
            Recreate reservations against corrected blank when possible (optional)
          </label>
          <label>
            <input
              type="checkbox"
              checked={applyOptions.updateSourceMapping}
              onChange={(event) => setApplyOptions((prev) => ({ ...prev, updateSourceMapping: event.target.checked }))}
            />
            Also update source SKU mapping for future orders
          </label>
          <label>
            <input
              type="checkbox"
              checked={applyOptions.clearFinishedProductLink}
              onChange={(event) => setApplyOptions((prev) => ({ ...prev, clearFinishedProductLink: event.target.checked }))}
            />
            Clear finished product link on selected lines
          </label>
          <label className="bulk-pairing-reason">
            Reason / note
            <textarea
              value={applyOptions.reason}
              onChange={(event) => setApplyOptions((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Example: Recent orders paired to wrong Badger style; correcting to 230100."
              rows={3}
            />
          </label>
        </div>
        <button className="danger" type="button" onClick={handleApply} disabled={previewLoading || !selectedIds.length || !newBlankProductId}>
          Apply pairing repair to {selectedIds.length} selected line(s)
        </button>
      </section>

      {result ? (
        <section className="panel bulk-pairing-panel">
          <h2>Repair Result</h2>
          <div className="bulk-pairing-summary-row">
            <span>Updated: {result.updated || 0}</span>
            <span>Failed: {result.failed || 0}</span>
            <span>Reservations cleared: {result.reservations_cleared || 0}</span>
            <span>Reservations recreated: {result.reservations_recreated || 0}</span>
            <span>Source products updated: {result.source_products_updated || 0}</span>
          </div>
          {Array.isArray(result.items) && result.items.some((item) => item.status === 'failed' || item.reservation_error) ? (
            <pre className="bulk-pairing-result-box">
              {JSON.stringify(result.items.filter((item) => item.status === 'failed' || item.reservation_error), null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
