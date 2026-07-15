import React, { useEffect, useMemo, useState } from 'react';
import {
  bulkSetJobDueDates,
  listPullSheetDueDates,
  rebuildPullSheetDueDates,
  setJobDueDate,
} from './lib/dueDateApi';

function formatDate(value) {
  if (!value) return 'No due date';
  return String(value).slice(0, 10);
}

function bucketLabel(bucket) {
  switch (bucket) {
    case 'overdue':
      return 'Overdue';
    case 'due_today':
      return 'Due today';
    case 'due_tomorrow':
      return 'Due tomorrow';
    case 'due_this_week':
      return 'Due this week';
    case 'future':
      return 'Future';
    default:
      return 'No due date';
  }
}

function safeLocalDateTime(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function PullSheetDueDateEditor() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inlineDates, setInlineDates] = useState({});

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, checked]) => checked)
        .map(([id]) => Number(id))
        .filter(Boolean),
    [selected]
  );

  async function loadRows() {
    setLoading(true);
    setError('');

    try {
      const data = await listPullSheetDueDates({ search, limit: 200 });
      setRows(data || []);

      const nextInlineDates = {};
      (data || []).forEach((row) => {
        nextInlineDates[row.job_id] = row.due_date ? String(row.due_date).slice(0, 10) : '';
      });
      setInlineDates(nextInlineDates);
    } catch (err) {
      setError(err.message || 'Unable to load due dates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveOne(row) {
    setSavingId(row.job_id);
    setError('');
    setMessage('');

    try {
      const nextDate = inlineDates[row.job_id] || null;

      await setJobDueDate({
        jobId: row.job_id,
        dueDate: nextDate,
        source: 'inventory_app',
        reason: 'Due date edited from Pull Sheet Due Dates page',
        changedBy: 'inventory_app',
      });

      setMessage(`Updated due date for order #${row.woocommerce_order_id || row.job_id}.`);
      await loadRows();
    } catch (err) {
      setError(err.message || 'Unable to save due date');
    } finally {
      setSavingId(null);
    }
  }

  async function saveBulk(clearDate = false) {
    setError('');
    setMessage('');

    if (!selectedIds.length) {
      setError('Select at least one pull sheet.');
      return;
    }

    try {
      const result = await bulkSetJobDueDates({
        jobIds: selectedIds,
        dueDate: clearDate ? null : bulkDueDate || null,
        reason: clearDate ? 'Cleared due date' : bulkReason || 'Bulk due date update',
        changedBy: 'inventory_app',
      });

      setMessage(`Bulk update complete. Updated: ${result.updated || 0}. Failed: ${result.failed || 0}.`);
      setSelected({});
      await loadRows();
    } catch (err) {
      setError(err.message || 'Unable to bulk update due dates');
    }
  }

  async function rebuildDueDateSync() {
    setRebuilding(true);
    setError('');
    setMessage('');

    try {
      const result = await rebuildPullSheetDueDates({ limit: 5000 });
      setMessage(`Rebuild complete. Synced jobs: ${result.synced_jobs || 0}.`);
      await loadRows();
    } catch (err) {
      setError(err.message || 'Unable to rebuild due date sync');
    } finally {
      setRebuilding(false);
    }
  }

  function toggleAll(checked) {
    if (!checked) {
      setSelected({});
      return;
    }

    const next = {};
    rows.forEach((row) => {
      next[row.job_id] = true;
    });
    setSelected(next);
  }

  return (
    <div className="page-shell pullsheet-due-date-editor">
      <div className="page-header">
        <div>
          <h1>Pull Sheet Due Dates</h1>
          <p>
            Set due dates individually or bulk update selected pull sheets. These due dates are stored
            on the production job and can be used by the Production Board.
          </p>
        </div>

        <button type="button" className="secondary" onClick={rebuildDueDateSync} disabled={rebuilding}>
          {rebuilding ? 'Rebuilding…' : 'Rebuild Due Date Sync'}
        </button>
      </div>

      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel due-date-toolbar">
        <div className="field-row">
          <label>
            Search
            <input
              type="search"
              value={search}
              placeholder="Order #, customer, or status"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadRows();
              }}
            />
          </label>

          <button type="button" onClick={loadRows} disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        <div className="bulk-due-date-box">
          <strong>Bulk due date</strong>

          <div className="field-row">
            <input
              type="date"
              value={bulkDueDate}
              onChange={(event) => setBulkDueDate(event.target.value)}
            />

            <input
              type="text"
              value={bulkReason}
              placeholder="Reason / note"
              onChange={(event) => setBulkReason(event.target.value)}
            />

            <button type="button" onClick={() => saveBulk(false)} disabled={!selectedIds.length}>
              Apply to {selectedIds.length || 0} selected
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() => saveBulk(true)}
              disabled={!selectedIds.length}
            >
              Clear selected due dates
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <table className="data-table due-date-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Current Due Date</th>
              <th>Bucket</th>
              <th>Edit Due Date</th>
              <th>Updated</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.job_id} className={row.is_overdue ? 'is-overdue' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[row.job_id])}
                    onChange={(event) =>
                      setSelected((prev) => ({
                        ...prev,
                        [row.job_id]: event.target.checked,
                      }))
                    }
                  />
                </td>

                <td>
                  <strong>#{row.woocommerce_order_id || row.job_id}</strong>
                  <div className="muted">Job #{row.job_id}</div>
                </td>

                <td>{row.customer_name || '—'}</td>
                <td>{row.job_status || '—'}</td>
                <td>{formatDate(row.due_date)}</td>

                <td>
                  <span className={`due-date-chip ${row.due_date_bucket || 'no_due_date'}`}>
                    {bucketLabel(row.due_date_bucket)}
                  </span>
                </td>

                <td>
                  <div className="inline-date-editor">
                    <input
                      type="date"
                      value={inlineDates[row.job_id] || ''}
                      onChange={(event) =>
                        setInlineDates((prev) => ({
                          ...prev,
                          [row.job_id]: event.target.value,
                        }))
                      }
                    />

                    <button
                      type="button"
                      onClick={() => saveOne(row)}
                      disabled={savingId === row.job_id}
                    >
                      {savingId === row.job_id ? 'Saving…' : 'Save'}
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setInlineDates((prev) => ({
                          ...prev,
                          [row.job_id]: '',
                        }))
                      }
                    >
                      Clear
                    </button>
                  </div>
                </td>

                <td>
                  {safeLocalDateTime(row.due_date_updated_at)}
                  {row.due_date_updated_by ? (
                    <div className="muted">by {row.due_date_updated_by}</div>
                  ) : null}
                </td>
              </tr>
            ))}

            {!rows.length && !loading ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  No pull sheets found.
                </td>
              </tr>
            ) : null}

            {loading ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  Loading…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
