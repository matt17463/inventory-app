import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MANUAL_PRODUCTION_STATUSES,
  PRODUCTION_BOARD_COLUMNS,
  listProductionStatusBoard,
  refreshProductionStatusBoard,
  updateProductionBoardStatus,
  updateWooCommerceOrderStatus,
} from './lib/productionStatusApi';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function orderLabel(row) {
  if (row.woo_order_number) return `Woo #${row.woo_order_number}`;
  if (row.woocommerce_order_id) return `Woo #${row.woocommerce_order_id}`;
  if (row.job_id) return `Job #${row.job_id}`;
  return 'Order';
}

function badgeText(value) {
  return String(value || 'unknown').replace(/_/g, ' ');
}

function blockingMessage(row) {
  const issues = Array.isArray(row.blocking_issues) ? row.blocking_issues : [];
  if (issues.length) return issues.map((issue) => issue.message || issue.type).filter(Boolean).join(' ');
  return row.production_status_reason || '';
}

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('attention') || s.includes('cancel') || s.includes('failed')) return 'danger';
  if (s.includes('hold') || s.includes('partial') || s.includes('qc')) return 'warning';
  if (s.includes('complete') || s.includes('ready_to_ship') || s === 'completed') return 'success';
  return 'info';
}

export default function ProductionBoard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [wooStatusByOrder, setWooStatusByOrder] = useState({});

  async function loadBoard(options = {}) {
    const nextSearch = options.search !== undefined ? options.search : search;
    const nextStatus = options.status !== undefined ? options.status : statusFilter;
    setLoading(true);
    setMessage('');

    try {
      const data = await listProductionStatusBoard({ status: nextStatus, search: nextSearch, limit: 300 });
      setRows(data || []);
    } catch (err) {
      setMessage(err.message || 'Could not load production status board.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
    const timer = window.setInterval(() => loadBoard(), 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function forceRefresh() {
    setRefreshing(true);
    setMessage('');
    try {
      const count = await refreshProductionStatusBoard(1000);
      await loadBoard();
      setMessage(`Refreshed production status for ${count || 0} recent job${Number(count) === 1 ? '' : 's'}.`);
    } catch (err) {
      setMessage(err.message || 'Could not refresh the production status board.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleManualStatus(row, nextStatus) {
    if (!row.job_id || !nextStatus) return;
    const key = `status-${row.job_id}`;
    setBusyKey(key);
    setMessage('');

    try {
      await updateProductionBoardStatus({
        jobId: row.job_id,
        status: nextStatus,
        note: `Status changed from Production Board to ${nextStatus}`,
      });
      await loadBoard();
    } catch (err) {
      setMessage(err.message || 'Could not update production status.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleWooStatus(row) {
    const orderId = row.woocommerce_order_id;
    const nextStatus = wooStatusByOrder[orderId] || 'completed';
    if (!orderId || !nextStatus) return;

    const confirmed = window.confirm(`Update WooCommerce order #${row.woo_order_number || orderId} to ${nextStatus}?`);
    if (!confirmed) return;

    const key = `woo-${orderId}`;
    setBusyKey(key);
    setMessage('');

    try {
      await updateWooCommerceOrderStatus({
        orderId,
        status: nextStatus,
        jobId: row.job_id || null,
        note: `Updated from Skilled Crafting Production Board to ${nextStatus}`,
      });
      await loadBoard();
      setMessage(`WooCommerce order #${row.woo_order_number || orderId} updated to ${nextStatus}.`);
    } catch (err) {
      setMessage(err.message || 'Could not update WooCommerce order status.');
    } finally {
      setBusyKey('');
    }
  }

  const grouped = useMemo(() => {
    const map = Object.fromEntries(PRODUCTION_BOARD_COLUMNS.map((column) => [column.key, []]));
    rows.forEach((row) => {
      const key = row.board_column || 'new_order';
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }, [rows]);

  function submitSearch(event) {
    event.preventDefault();
    loadBoard();
  }

  return (
    <main className="sc-page-stack sc-production-status-page">
      <section className="sc-page-header-card">
        <div>
          <div className="sc-kicker">Production</div>
          <h2>Production Status Board</h2>
          <p>
            This board reconciles WooCommerce order status with pull sheet status. Pull sheet lines marked non-inventory no longer block completion.
          </p>
        </div>
        <div className="sc-button-row">
          <button className="sc-btn" type="button" onClick={() => loadBoard()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="sc-btn sc-btn-secondary" type="button" onClick={forceRefresh} disabled={refreshing}>
            {refreshing ? 'Rebuilding…' : 'Rebuild Statuses'}
          </button>
        </div>
      </section>

      {message ? <div className="sc-alert">{message}</div> : null}

      <section className="sc-card sc-production-controls">
        <form className="sc-production-filter-row" onSubmit={submitSearch}>
          <label>
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order #, job #, or customer"
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                loadBoard({ status: event.target.value });
              }}
            >
              <option value="">All statuses</option>
              {PRODUCTION_BOARD_COLUMNS.map((column) => (
                <option key={column.key} value={column.key}>{column.label}</option>
              ))}
            </select>
          </label>
          <button className="sc-btn" type="submit">Search</button>
        </form>
        <div className="sc-production-legend">
          <span><strong>Woo Status</strong> = customer/order/payment state</span>
          <span><strong>Production Status</strong> = calculated from pull sheet lines, reservations, and non-inventory rules</span>
        </div>
      </section>

      <div className="sc-kanban-board sc-production-kanban">
        {PRODUCTION_BOARD_COLUMNS.map((column) => {
          const columnRows = grouped[column.key] || [];
          return (
            <section className="sc-kanban-column sc-production-column" key={column.key}>
              <div className="sc-kanban-header">
                <strong>{column.label}</strong>
                <span>{columnRows.length}</span>
              </div>

              <div className="sc-kanban-cards">
                {columnRows.map((row) => {
                  const key = row.job_id || row.woocommerce_order_id || row.id;
                  const busyStatusKey = `status-${row.job_id}`;
                  const busyWooKey = `woo-${row.woocommerce_order_id}`;
                  const isProductionComplete = row.production_status === 'production_complete' || row.board_column === 'completed';
                  const wooComplete = ['completed', 'cancelled', 'canceled', 'refunded'].includes(String(row.woo_status || '').toLowerCase());
                  const blockers = blockingMessage(row);

                  return (
                    <article className="sc-job-card sc-production-card" key={key}>
                      <div className="sc-card-title-row">
                        <strong>{row.customer_name || orderLabel(row)}</strong>
                        <span className="sc-badge">{orderLabel(row)}</span>
                      </div>

                      <div className="sc-status-pill-row">
                        <span className={`sc-status-pill sc-status-pill--${statusTone(row.woo_status)}`}>Woo: {badgeText(row.woo_status || 'not synced')}</span>
                        <span className={`sc-status-pill sc-status-pill--${statusTone(row.production_status)}`}>Production: {row.production_status_label || badgeText(row.production_status)}</span>
                      </div>

                      <div className="sc-job-meta sc-production-meta">
                        <span>Job: {row.job_id || 'Not created'}</span>
                        <span>Due: {formatDate(row.due_date)}</span>
                        <span>Total: {formatMoney(row.order_total)}</span>
                        <span>Last Woo Sync: {formatDateTime(row.last_woo_sync_at)}</span>
                      </div>

                      <div className="sc-production-line-counts">
                        <span>Total lines <strong>{row.total_lines || 0}</strong></span>
                        <span>Required <strong>{row.inventory_required_lines || 0}</strong></span>
                        <span>Non-inventory <strong>{row.non_inventory_lines || 0}</strong></span>
                        <span>Unpaired <strong>{row.unpaired_required_lines || 0}</strong></span>
                        <span>Resolved <strong>{row.resolved_lines || 0}</strong></span>
                      </div>

                      {blockers ? <div className="sc-warning-callout sc-production-reason">{blockers}</div> : null}

                      {row.job_id ? (
                        <label className="sc-field sc-production-status-select">
                          <span>Move Production Status</span>
                          <select
                            value=""
                            onChange={(event) => handleManualStatus(row, event.target.value)}
                            disabled={busyKey === busyStatusKey}
                          >
                            <option value="">Choose status…</option>
                            {MANUAL_PRODUCTION_STATUSES.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      {row.woocommerce_order_id && isProductionComplete && !wooComplete ? (
                        <div className="sc-production-woo-update">
                          <label>
                            <span>WooCommerce Status</span>
                            <select
                              value={wooStatusByOrder[row.woocommerce_order_id] || 'completed'}
                              onChange={(event) => setWooStatusByOrder((current) => ({
                                ...current,
                                [row.woocommerce_order_id]: event.target.value,
                              }))}
                            >
                              <option value="completed">Completed</option>
                              <option value="processing">Processing</option>
                              <option value="on-hold">On Hold</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>
                          <button
                            className="sc-btn sc-btn-small sc-btn-success"
                            type="button"
                            onClick={() => handleWooStatus(row)}
                            disabled={busyKey === busyWooKey}
                          >
                            {busyKey === busyWooKey ? 'Updating Woo…' : 'Update Woo'}
                          </button>
                        </div>
                      ) : null}

                      <div className="sc-card-actions">
                        {row.job_id ? <Link className="sc-btn sc-btn-small" to={`/pullsheets/${row.job_id}`}>Open Pull Sheet</Link> : null}
                        {row.woocommerce_order_id && !row.job_id ? <span className="sc-muted">Waiting for pull sheet/job creation</span> : null}
                      </div>
                    </article>
                  );
                })}

                {!columnRows.length ? <div className="sc-empty-card">No orders</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
