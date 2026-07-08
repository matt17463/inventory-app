import { useEffect, useMemo, useState } from 'react';
import {
  applyBulkUndoActivity,
  getActivityFeed,
  getActivityFeedForPullSheet,
  getPullSheets,
  previewBulkUndoActivity,
  undoActivityFeedEntry,
} from './lib/inventoryApi';

const CORE_FIELDS = new Set([
  'id',
  'created_at',
  'activity_type',
  'description',
  'summary',
  'action',
  'action_type',
  'details',
  'payload',
  'metadata',
]);

function safeDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function labelize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function getActivityTitle(row) {
  return row.activity_type || row.action_type || row.action || 'Activity';
}

function getActivityDescription(row) {
  return row.description || row.summary || row.details || row.notes || 'No description was provided.';
}

function getQuantity(row) {
  return row.quantity_change ?? row.quantity ?? row.qty ?? row.quantity_reserved ?? row.delta_quantity ?? null;
}

function getSku(row) {
  return row.sku_base || row.sku || row.blank_sku || row.product_sku || row.product_name || row.name || null;
}

function getBin(row) {
  return row.bin_code || row.bin_label || row.bin_name || row.bin || row.to_bin || row.from_bin || null;
}

function getPullSheetId(row) {
  return row.job_id || row.pullsheet_job_id || row.pull_sheet_id || row.pullsheet_id || row.source_job_id || row.order_job_id || null;
}

function getPullSheetLabel(row) {
  const id = row.id || row.job_id;
  const order = row.order_number || row.woocommerce_order_id || row.source_invoice_number || row.invoice_number;
  const customer = row.customer_name || row.customer || row.client_name;
  const name = row.job_name || row.name || row.title || `Pull Sheet ${id}`;
  return [name, order ? `Order ${order}` : null, customer].filter(Boolean).join(' · ');
}

function getUndoAvailable(row) {
  if (row.undone_at || row.reversed_at || row.undo_activity_id || row.is_undo === true) return false;
  if (row.can_undo === true || row.undo_available === true) return true;

  const sourceTable = String(row.source_table || row.table_name || '').toLowerCase();
  const type = String(row.activity_type || row.action_type || row.action || '').toLowerCase();
  const description = String(row.description || row.summary || '').toLowerCase();

  if (sourceTable.includes('blank_inventory_movements')) return true;
  return ['receive', 'transfer', 'adjust', 'deduct', 'movement', 'inventory']
    .some((needle) => type.includes(needle) || description.includes(needle));
}

function getDetailEntries(row) {
  const preferred = [
    ['Quantity change', getQuantity(row)],
    ['SKU / item', getSku(row)],
    ['Bin', getBin(row)],
    ['From bin', row.from_bin_code || row.from_bin_label || row.from_bin_id],
    ['To bin', row.to_bin_code || row.to_bin_label || row.to_bin_id],
    ['Brand', row.brand || row.blank_brand],
    ['Style', row.product_type || row.style || row.blank_style],
    ['Color', row.color || row.blank_color],
    ['Size', row.size || row.blank_size],
    ['Pull sheet / job', getPullSheetId(row)],
    ['Job item', row.job_item_id || row.pullsheet_item_id],
    ['Order / job', row.order_ref || row.order_id || row.woocommerce_order_id],
    ['Manual order', row.manual_order_id || row.manual_invoice_order_id],
    ['Source', row.source_table || row.entity_type || row.table_name],
    ['Source ID', row.source_id || row.movement_id || row.blank_inventory_movement_id || row.entity_id || row.id],
    ['Notes', row.notes],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  const extras = Object.entries(row)
    .filter(([key, value]) => !CORE_FIELDS.has(key) && value !== undefined && value !== null && value !== '')
    .filter(([key]) => !preferred.some(([label]) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') === key));

  return { preferred, extras };
}

function bulkResultItems(result) {
  return Array.isArray(result?.items) ? result.items : [];
}

function bulkResultCount(result, key) {
  const value = Number(result?.[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function defaultBulkReason(scope) {
  if (scope === 'pullsheet') return 'Bulk undo for selected pull sheet.';
  if (scope === 'order') return 'Bulk undo for selected WooCommerce order.';
  return 'Bulk undo for selected activity time range.';
}

export default function ActivityPage() {
  const [rows, setRows] = useState([]);
  const [pullSheets, setPullSheets] = useState([]);
  const [selectedPullSheetId, setSelectedPullSheetId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPullSheets, setLoadingPullSheets] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [undoingId, setUndoingId] = useState(null);
  const [limit, setLimit] = useState(100);

  const [bulkScope, setBulkScope] = useState('time');
  const [bulkStartAt, setBulkStartAt] = useState('');
  const [bulkEndAt, setBulkEndAt] = useState('');
  const [bulkPullSheetId, setBulkPullSheetId] = useState('');
  const [bulkOrderId, setBulkOrderId] = useState('');
  const [bulkLimit, setBulkLimit] = useState(250);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function loadPullSheets() {
    setLoadingPullSheets(true);
    try {
      const data = await getPullSheets();
      setPullSheets(data || []);
    } catch (err) {
      setMessage(err.message || 'Failed to load pull sheet list for the activity filter.');
    } finally {
      setLoadingPullSheets(false);
    }
  }

  async function load() {
    setLoading(true);
    setMessage('');
    setExpandedId(null);
    try {
      const data = selectedPullSheetId
        ? await getActivityFeedForPullSheet(selectedPullSheetId, limit)
        : await getActivityFeed(limit);
      setRows(data);
    } catch (err) {
      setMessage(err.message || 'Failed to load activity feed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPullSheets();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPullSheetId, limit]);

  useEffect(() => {
    if (selectedPullSheetId && !bulkPullSheetId) {
      setBulkPullSheetId(selectedPullSheetId);
    }
  }, [selectedPullSheetId, bulkPullSheetId]);

  function buildBulkUndoOptions() {
    const reason = bulkReason.trim() || defaultBulkReason(bulkScope);

    if (bulkScope === 'time') {
      if (!bulkStartAt && !bulkEndAt) {
        throw new Error('Choose a start time, end time, or both before previewing a time-range undo.');
      }
      return {
        startAt: bulkStartAt || null,
        endAt: bulkEndAt || null,
        limit: bulkLimit,
        reason,
      };
    }

    if (bulkScope === 'pullsheet') {
      if (!bulkPullSheetId) throw new Error('Choose a pull sheet before previewing a pull-sheet undo.');
      return {
        jobId: bulkPullSheetId,
        limit: bulkLimit,
        reason,
      };
    }

    if (bulkScope === 'order') {
      if (!bulkOrderId) throw new Error('Enter a WooCommerce order number before previewing an order undo.');
      return {
        orderId: bulkOrderId,
        limit: bulkLimit,
        reason,
      };
    }

    throw new Error('Choose a bulk undo scope.');
  }

  async function handleBulkPreview() {
    setBulkBusy(true);
    setMessage('');
    setBulkPreview(null);
    try {
      const result = await previewBulkUndoActivity(buildBulkUndoOptions());
      setBulkPreview(result);
      setMessage(result?.message || 'Bulk undo preview complete.');
    } catch (err) {
      setMessage(err.message || 'Bulk undo preview failed.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkApply() {
    const previewCount = bulkResultCount(bulkPreview, 'candidate_count');
    if (!previewCount) {
      setMessage('Preview the bulk undo first. No undoable activity is currently selected.');
      return;
    }

    const ok = window.confirm(
      `Undo ${previewCount} activity entr${previewCount === 1 ? 'y' : 'ies'}?\n\nThis will create reversing inventory movements. It will not delete the original activity records. This should only be used to reverse mistakes.`
    );
    if (!ok) return;

    setBulkBusy(true);
    setMessage('');
    try {
      const result = await applyBulkUndoActivity(buildBulkUndoOptions());
      setBulkPreview(result);
      setMessage(
        `Bulk undo complete. Undone: ${bulkResultCount(result, 'undone_count')}. Failed/skipped: ${bulkResultCount(result, 'failed_count')}.`
      );
      await load();
    } catch (err) {
      setMessage(err.message || 'Bulk undo failed.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleUndo(row) {
    const label = getActivityDescription(row);
    const ok = window.confirm(
      `Undo this activity?\n\n${label}\n\nThis will create a reversing inventory movement where possible. It will not delete the original activity record.`
    );
    if (!ok) return;

    setUndoingId(row.id);
    setMessage('');
    try {
      const result = await undoActivityFeedEntry(row, 'Undone from Activity Feed page.');
      setMessage(result?.message || 'Activity was undone.');
      await load();
    } catch (err) {
      setMessage(err.message || 'Unable to undo this activity.');
    } finally {
      setUndoingId(null);
    }
  }

  const selectedPullSheet = useMemo(
    () => pullSheets.find((sheet) => String(sheet.id || sheet.job_id) === String(selectedPullSheetId)),
    [pullSheets, selectedPullSheetId]
  );

  const rowsWithMeta = useMemo(() => rows.map((row) => ({ ...row, undoable: getUndoAvailable(row) })), [rows]);
  const bulkItems = bulkResultItems(bulkPreview);

  return (
    <main className="page activity-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">Audit Trail</p>
          <h1>Activity Feed</h1>
          <p className="helper-text">
            Review inventory activity, filter by pull sheet, open each entry for details, and undo reversible inventory movements when a receiving, transfer, or deduction mistake is made.
          </p>
        </div>
        <div className="activity-toolbar">
          <select
            value={selectedPullSheetId}
            onChange={(e) => setSelectedPullSheetId(e.target.value)}
            disabled={loadingPullSheets}
            title="Show activity generated by a specific pull sheet."
          >
            <option value="">All activity</option>
            {pullSheets.map((sheet) => {
              const id = sheet.id || sheet.job_id;
              return (
                <option key={id} value={id}>
                  {getPullSheetLabel(sheet)}
                </option>
              );
            })}
          </select>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
          </select>
          <button type="button" className="sc-btn secondary" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {selectedPullSheetId && (
        <div className="card subtle-card">
          <strong>Filtered by pull sheet:</strong>{' '}
          {selectedPullSheet ? getPullSheetLabel(selectedPullSheet) : `Pull Sheet ${selectedPullSheetId}`}
          <button type="button" className="sc-btn link" onClick={() => setSelectedPullSheetId('')}>
            Clear filter
          </button>
        </div>
      )}

      <section className="card wide-card">
        <div className="page-heading-row">
          <div>
            <p className="eyebrow">Bulk Undo</p>
            <h2>Undo activity by time, order, or pull sheet</h2>
            <p className="helper-text">
              Preview first, then apply. Bulk undo only reverses safe inventory movement activity by creating opposite inventory movements. Other activity is skipped.
            </p>
          </div>
          <div className="activity-toolbar">
            <button type="button" className="sc-btn secondary" onClick={handleBulkPreview} disabled={bulkBusy}>
              {bulkBusy ? 'Working…' : 'Preview Bulk Undo'}
            </button>
            <button
              type="button"
              className="sc-btn danger"
              onClick={handleBulkApply}
              disabled={bulkBusy || bulkResultCount(bulkPreview, 'candidate_count') === 0 || bulkPreview?.dry_run === false}
            >
              Apply Bulk Undo
            </button>
          </div>
        </div>

        <div className="activity-detail-grid">
          <label>
            <b>Undo scope</b>
            <select
              value={bulkScope}
              onChange={(e) => {
                setBulkScope(e.target.value);
                setBulkPreview(null);
              }}
            >
              <option value="time">Time range</option>
              <option value="pullsheet">Specific pull sheet</option>
              <option value="order">Specific WooCommerce order</option>
            </select>
          </label>

          {bulkScope === 'time' && (
            <>
              <label>
                <b>Start time</b>
                <input type="datetime-local" value={bulkStartAt} onChange={(e) => setBulkStartAt(e.target.value)} />
              </label>
              <label>
                <b>End time</b>
                <input type="datetime-local" value={bulkEndAt} onChange={(e) => setBulkEndAt(e.target.value)} />
              </label>
            </>
          )}

          {bulkScope === 'pullsheet' && (
            <label>
              <b>Pull sheet</b>
              <select value={bulkPullSheetId} onChange={(e) => setBulkPullSheetId(e.target.value)} disabled={loadingPullSheets}>
                <option value="">Choose pull sheet…</option>
                {pullSheets.map((sheet) => {
                  const id = sheet.id || sheet.job_id;
                  return (
                    <option key={id} value={id}>
                      {getPullSheetLabel(sheet)}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {bulkScope === 'order' && (
            <label>
              <b>WooCommerce order number</b>
              <input
                type="number"
                inputMode="numeric"
                value={bulkOrderId}
                onChange={(e) => setBulkOrderId(e.target.value)}
                placeholder="Example: 11879"
              />
            </label>
          )}

          <label>
            <b>Max actions</b>
            <select value={bulkLimit} onChange={(e) => setBulkLimit(Number(e.target.value))}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </label>

          <label>
            <b>Reason / note</b>
            <input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder={defaultBulkReason(bulkScope)}
            />
          </label>
        </div>

        {bulkPreview && (
          <div className="activity-detail-panel">
            <h3>{bulkPreview.dry_run ? 'Bulk undo preview' : 'Bulk undo result'}</h3>
            <div className="activity-chips">
              <span>Candidates: {bulkResultCount(bulkPreview, 'candidate_count')}</span>
              {!bulkPreview.dry_run && <span>Undone: {bulkResultCount(bulkPreview, 'undone_count')}</span>}
              {!bulkPreview.dry_run && <span>Failed: {bulkResultCount(bulkPreview, 'failed_count')}</span>}
              <span>Limit: {bulkResultCount(bulkPreview, 'limit')}</span>
            </div>

            {bulkItems.length > 0 ? (
              <div className="activity-list">
                {bulkItems.slice(0, 12).map((item, index) => (
                  <article key={`${item.activity_id || item.source_id || index}`} className="activity-row full">
                    <div className="activity-main-row">
                      <div>
                        <strong>{labelize(item.activity_type || item.status || 'Activity')}</strong>
                        <span>{item.description || item.result?.message || 'No description was provided.'}</span>
                        <small>{safeDate(item.created_at)}</small>
                      </div>
                      <div className="activity-chips">
                        {item.status && <span>{labelize(item.status)}</span>}
                        {item.quantity && <span>Qty {item.quantity}</span>}
                        {item.sku && <span>{item.sku}</span>}
                        {item.job_id && <span>Pull Sheet {item.job_id}</span>}
                        {item.order_id && <span>Order {item.order_id}</span>}
                      </div>
                    </div>
                  </article>
                ))}
                {bulkItems.length > 12 && <p className="helper-text">Showing first 12 of {bulkItems.length} previewed actions.</p>}
              </div>
            ) : (
              <p className="helper-text">No undoable inventory activity matched this scope.</p>
            )}
          </div>
        )}
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card wide-card activity-list">
        {rowsWithMeta.map((row) => {
          const isExpanded = expandedId === row.id;
          const { preferred, extras } = getDetailEntries(row);
          const undoable = row.undoable;

          return (
            <article key={row.id || `${row.source_table}-${row.source_id}`} className={`activity-row full ${isExpanded ? 'expanded' : ''}`}>
              <div className="activity-main-row">
                <button
                  type="button"
                  className="activity-title-button"
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  aria-expanded={isExpanded}
                >
                  <strong>{labelize(getActivityTitle(row))}</strong>
                  <span>{getActivityDescription(row)}</span>
                  <small>{safeDate(row.created_at)}</small>
                </button>

                <div className="activity-actions">
                  <button type="button" className="sc-btn secondary" onClick={() => setExpandedId(isExpanded ? null : row.id)}>
                    {isExpanded ? 'Hide Details' : 'Details'}
                  </button>
                  <button
                    type="button"
                    className="sc-btn danger"
                    onClick={() => handleUndo(row)}
                    disabled={!undoable || undoingId === row.id}
                    title={undoable ? 'Create a reversing inventory movement for this activity.' : 'This activity cannot be safely undone from the feed.'}
                  >
                    {undoingId === row.id ? 'Undoing…' : 'Undo'}
                  </button>
                </div>
              </div>

              <div className="activity-chips">
                {getQuantity(row) !== null && <span>Qty {formatValue(getQuantity(row))}</span>}
                {getSku(row) && <span>{getSku(row)}</span>}
                {getBin(row) && <span>{getBin(row)}</span>}
                {getPullSheetId(row) && <span>Pull Sheet {getPullSheetId(row)}</span>}
                {!undoable && <span className="muted-chip">No safe undo</span>}
              </div>

              {isExpanded && (
                <div className="activity-detail-panel">
                  <h3>What happened</h3>
                  <div className="activity-detail-grid">
                    {preferred.map(([label, value]) => (
                      <div key={`${row.id}-${label}`}>
                        <b>{label}</b>
                        <span>{formatValue(value)}</span>
                      </div>
                    ))}
                  </div>

                  {extras.length > 0 && (
                    <>
                      <h3>Additional fields</h3>
                      <div className="activity-detail-grid compact">
                        {extras.slice(0, 24).map(([key, value]) => (
                          <div key={`${row.id}-${key}`}>
                            <b>{labelize(key)}</b>
                            <span>{formatValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <details className="activity-raw-json">
                    <summary>Raw activity record</summary>
                    <pre>{JSON.stringify(row, null, 2)}</pre>
                  </details>
                </div>
              )}
            </article>
          );
        })}
        {rows.length === 0 && (
          <p>{loading ? 'Loading activity…' : selectedPullSheetId ? 'No activity was found for this pull sheet.' : 'No activity yet.'}</p>
        )}
      </section>
    </main>
  );
}
