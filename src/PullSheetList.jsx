import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createPullSheet,
  getPullSheets,
  pullSheetStatusLabel,
  updatePullSheetStatuses,
} from './lib/inventoryApi';

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued / Open' },
  { value: 'ready_to_pull', label: 'Ready to Pull' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'waiting_on_blanks', label: 'Waiting on Blanks' },
  { value: 'ready_to_produce', label: 'Ready to Produce' },
  { value: 'in_production', label: 'In Production' },
  { value: 'qc', label: 'QC' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'completed', label: 'Completed / Filled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'voided', label: 'Voided' },
];

const SORT_OPTIONS = [
  { value: 'order_placed', label: 'Date Order Placed' },
  { value: 'due_date', label: 'Date Order Due' },
  { value: 'order_number', label: 'Order Number' },
  { value: 'customer', label: 'Customer' },
  { value: 'status', label: 'Status' },
];

const CLOSED_STATUSES = new Set(['completed', 'cancelled', 'canceled', 'voided', 'void']);

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isClosedStatus(status) {
  return CLOSED_STATUSES.has(normalizeStatus(status));
}

function statusOptionLabel(status) {
  const normalized = normalizeStatus(status);
  return STATUS_OPTIONS.find((option) => option.value === normalized)?.label || pullSheetStatusLabel(status) || status || 'Open';
}

function getOrderNumber(job) {
  return job?.woocommerce_order_id || job?.manual_order_id || job?.order_number || job?.order_id || '';
}

function getOrderPlacedDate(job) {
  return (
    job?.order_placed_at ||
    job?.date_order_placed ||
    job?.order_date ||
    job?.woocommerce_order_date ||
    job?.woocommerce_created_at ||
    job?.woo_order_created_at ||
    job?.order_created_at ||
    job?.created_at ||
    ''
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function jobSearchText(job) {
  return [
    job.id,
    job.job_name,
    getOrderNumber(job),
    job.customer_name,
    job.status,
    job.due_date,
    getOrderPlacedDate(job),
    job.created_at,
  ]
    .filter((part) => part !== undefined && part !== null)
    .join(' ')
    .toLowerCase();
}

function sortDate(value) {
  const ts = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
}

function sortText(value) {
  return String(value || '').trim();
}

function compareJobs(a, b, sortBy, sortDirection) {
  let result = 0;

  if (sortBy === 'order_placed') {
    result = sortDate(getOrderPlacedDate(a)) - sortDate(getOrderPlacedDate(b));
  } else if (sortBy === 'due_date') {
    result = sortDate(a?.due_date) - sortDate(b?.due_date);
  } else if (sortBy === 'order_number') {
    result = collator.compare(sortText(getOrderNumber(a)), sortText(getOrderNumber(b)));
  } else if (sortBy === 'customer') {
    result = collator.compare(sortText(a?.customer_name), sortText(b?.customer_name));
  } else if (sortBy === 'status') {
    result = collator.compare(statusOptionLabel(a?.status), statusOptionLabel(b?.status));
  }

  if (result === 0) {
    // Stable fallback keeps the newest pull sheets higher when sort values match.
    result = sortDate(a?.created_at) - sortDate(b?.created_at);
  }

  return sortDirection === 'asc' ? result : -result;
}

export default function PullSheetList() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('completed');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [sortBy, setSortBy] = useState('order_placed');
  const [sortDirection, setSortDirection] = useState('desc');
  const [form, setForm] = useState({
    jobName: '',
    customerName: '',
    orderNumber: '',
    dueDate: '',
    notes: '',
  });

  async function load() {
    setMessage('');
    try {
      const rows = await getPullSheets();
      setJobs(rows);
    } catch (err) {
      setMessage(err.message || 'Failed to load pull sheets.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visibleJobs = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();

    return [...jobs]
      .filter((job) => {
        const normalized = normalizeStatus(job.status);
        if (statusFilter === 'open' && isClosedStatus(normalized)) return false;
        if (statusFilter === 'closed' && !isClosedStatus(normalized)) return false;
        if (statusFilter && !['all', 'open', 'closed'].includes(statusFilter) && normalized !== statusFilter) return false;
        if (term && !jobSearchText(job).includes(term)) return false;
        return true;
      })
      .sort((a, b) => compareJobs(a, b, sortBy, sortDirection));
  }, [jobs, search, statusFilter, sortBy, sortDirection]);

  const visibleIds = useMemo(() => visibleJobs.map((job) => job.id).filter(Boolean), [visibleJobs]);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  function toggleJob(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }

  function toggleVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }

  async function submit(event) {
    event.preventDefault();
    setCreating(true);
    setMessage('');

    try {
      const job = await createPullSheet(form);
      setForm({ jobName: '', customerName: '', orderNumber: '', dueDate: '', notes: '' });
      navigate(`/pullsheets/${job.id}`);
    } catch (err) {
      setMessage(err.message || 'Failed to create pull sheet.');
    } finally {
      setCreating(false);
    }
  }

  async function applyBulkStatus() {
    const ids = selectedIds.filter(Boolean);
    if (!ids.length) {
      setMessage('Choose at least one pull sheet to update.');
      return;
    }

    const label = statusOptionLabel(bulkStatus);
    const confirmed = window.confirm(
      `Change ${ids.length} pull sheet${ids.length === 1 ? '' : 's'} to “${label}”?\n\nThis only changes the pull sheet/job status. It does not deduct inventory, create reservations, or change WooCommerce orders.`
    );
    if (!confirmed) return;

    setBulkBusy(true);
    setMessage('');
    try {
      const updated = await updatePullSheetStatuses({ jobIds: ids, status: bulkStatus });
      setMessage(`Updated ${updated.length || ids.length} pull sheet${(updated.length || ids.length) === 1 ? '' : 's'} to “${label}”.`);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update pull sheet statuses.');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="page pullsheet-list-page">
      <h1>Pull Sheets</h1>
      <p className="muted">
        Create a pull sheet for a job, add the blank garments needed, then choose whether to use finished stock or pull blanks from inventory.
      </p>

      {message && <p className="message">{message}</p>}

      <section className="content-two-column">
        <form onSubmit={submit} className="card elevated-card">
          <h2>Create Pull Sheet</h2>

          <label>
            Job Name
            <input
              value={form.jobName}
              onChange={(event) => setForm((prev) => ({ ...prev, jobName: event.target.value }))}
              placeholder="North Mason Fastpitch hoodies"
              required
            />
          </label>

          <label>
            Customer
            <input
              value={form.customerName}
              onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
              placeholder="Customer, school, team, or organization"
            />
          </label>

          <label>
            Order Number
            <input
              value={form.orderNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, orderNumber: event.target.value }))}
              placeholder="WooCommerce/order reference if available"
            />
          </label>

          <label>
            Due Date
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </label>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Production notes, decoration method, etc."
            />
          </label>

          <button className="primary-action" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Pull Sheet'}
          </button>
        </form>

        <section className="card elevated-card">
          <h2>How Pull Sheets Work</h2>
          <ol className="simple-steps">
            <li>Create a pull sheet for the job.</li>
            <li>Add each blank item needed by searching your blank inventory.</li>
            <li>For each line, use matching finished stock if available.</li>
            <li>If finished stock is not available, deduct the blank from its bin after pulling it.</li>
            <li>Return decorated extras to a finished-products bin for future orders.</li>
          </ol>
        </section>
      </section>

      <section className="card elevated-card">
        <div className="page-header-row" style={{ alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2>Existing Pull Sheets</h2>
            <p className="muted">Bulk-close old pull sheets that were already filled without changing inventory.</p>
          </div>
          <button type="button" className="secondary-button" onClick={load}>Refresh</button>
        </div>

        <div className="form-grid" style={{ marginBottom: '1rem' }}>
          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order, customer, job name, status..."
            />
          </label>
          <label>
            Show
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="open">Open only</option>
              <option value="all">All pull sheets</option>
              <option value="closed">Completed / cancelled / voided only</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Sort By
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Bulk Status Update</h3>
          <p className="muted">
            Selected: {selectedIds.length}. This changes only the pull sheet/job status. It does not deduct inventory or change WooCommerce.
          </p>
          <div className="button-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="button" className="primary-action" disabled={bulkBusy || selectedIds.length === 0} onClick={applyBulkStatus}>
              {bulkBusy ? 'Updating...' : `Apply to ${selectedIds.length || 0} Selected`}
            </button>
            <button type="button" className="secondary-button" disabled={!selectedIds.length || bulkBusy} onClick={() => setSelectedIds([])}>
              Clear Selection
            </button>
          </div>
        </div>

        {!visibleJobs.length ? (
          <p className="muted">No pull sheets match the current filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>
                  <label className="checkbox-line" style={{ margin: 0 }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
                    Select
                  </label>
                </th>
                <th>Job</th>
                <th>Order</th>
                <th>Order Placed</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(job.id)}
                      onChange={() => toggleJob(job.id)}
                      aria-label={`Select pull sheet ${job.job_name || job.id}`}
                    />
                  </td>
                  <td>{job.job_name}</td>
                  <td>{getOrderNumber(job)}</td>
                  <td>{formatDate(getOrderPlacedDate(job))}</td>
                  <td>{job.customer_name || ''}</td>
                  <td>{statusOptionLabel(job.status)}</td>
                  <td>{formatDate(job.due_date)}</td>
                  <td><Link to={`/pullsheets/${job.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
