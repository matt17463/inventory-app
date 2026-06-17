import { useEffect, useMemo, useState } from 'react';
import { getActivityFeed, getActivityFeedForPullSheet, getPullSheets, undoActivityFeedEntry } from './lib/inventoryApi';

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
