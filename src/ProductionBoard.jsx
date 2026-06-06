import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProductionBoard, updateProductionJobStatus } from './lib/inventoryApi';

const COLUMNS = [
  ['waiting_on_blanks', 'Waiting on Blanks'],
  ['ready_to_produce', 'Ready to Produce'],
  ['in_production', 'In Production'],
  ['qc', 'QC'],
  ['ready_to_ship', 'Ready to Ship'],
  ['completed', 'Completed'],
];

function formatDate(value) {
  if (!value) return 'No due date';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function normalizeStatus(status) {
  if (!status) return 'ready_to_produce';
  if (status === 'reserved' || status === 'new' || status === 'open') return 'ready_to_produce';
  return COLUMNS.some(([key]) => key === status) ? status : 'ready_to_produce';
}

export default function ProductionBoard() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await getProductionBoard(search);
      setRows(data || []);
    } catch (err) {
      setMessage(err.message || 'Failed to load production board.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map(([key]) => [key, []]));
    rows.forEach((row) => {
      const key = normalizeStatus(row.status);
      map[key].push(row);
    });
    return map;
  }, [rows]);

  const totalJobs = rows.length;

  async function move(job, status) {
    if (!job?.job_id) return;
    setBusyId(job.job_id);
    setMessage('');
    try {
      await updateProductionJobStatus({ jobId: job.job_id, status, notes: `Moved from ${job.status || 'unknown'} to ${status}` });
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update job status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page production-board-page">
      <section className="page-header production-page-header">
        <div>
          <p className="eyebrow">Production</p>
          <h1>Production Status Board</h1>
          <p>Move pull sheets through each production stage. Jobs are shown as cards so the board is easier to scan.</p>
        </div>
        <Link className="secondary-button" to="/pullsheets">Open Pull Sheets</Link>
      </section>

      <section className="card elevated-card production-board-toolbar">
        <div>
          <label>Search Open Jobs</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job, customer, order, status..." onKeyDown={(e) => { if (e.key === 'Enter') load(); }} />
        </div>
        <button className="primary-button" type="button" onClick={load}>{loading ? 'Searching…' : 'Search'}</button>
        <span className="count-pill">{totalJobs} jobs</span>
      </section>

      {message && <p className="message production-message">{message}</p>}

      <section className="production-kanban-grid">
        {COLUMNS.map(([status, label]) => (
          <section className="production-kanban-column" key={status}>
            <header>
              <h2>{label}</h2>
              <span>{grouped[status]?.length || 0}</span>
            </header>
            <div className="production-kanban-card-stack">
              {(grouped[status] || []).map((job) => {
                const currentStatus = normalizeStatus(job.status);
                return (
                  <article className="production-job-card" key={job.job_id}>
                    <div className="job-card-topline">
                      <strong>{job.job_name || `Order #${job.woocommerce_order_id || job.job_id}`}</strong>
                      <span className="status-chip">{currentStatus.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="job-card-customer">{job.customer_name || 'No customer listed'}</p>
                    <div className="job-card-meta">
                      <span>Order {job.woocommerce_order_id || job.job_id}</span>
                      <span>{job.total_units || 0} units</span>
                      <span>{job.completed_units || 0} completed</span>
                      <span>Due {formatDate(job.due_date)}</span>
                    </div>
                    <div className="job-card-actions-row">
                      <Link className="secondary-button small-button" to={`/pullsheets/${job.job_id}`}>Open</Link>
                      <select value={currentStatus} disabled={busyId === job.job_id} onChange={(e) => move(job, e.target.value)}>
                        {COLUMNS.map(([next, nextLabel]) => <option key={next} value={next}>{nextLabel}</option>)}
                      </select>
                    </div>
                  </article>
                );
              })}
              {!grouped[status]?.length && <p className="helper-text empty-column-note">No jobs in this stage.</p>}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
