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

export default function ProductionBoard() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const data = await getProductionBoard(search);
      setRows(data);
    } catch (err) {
      setMessage(err.message || 'Failed to load production board.');
    }
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map(([key]) => [key, []]));
    rows.forEach((row) => {
      const key = map[row.status] ? row.status : 'ready_to_produce';
      map[key].push(row);
    });
    return map;
  }, [rows]);

  async function move(job, status) {
    setBusyId(job.job_id);
    setMessage('');
    try {
      await updateProductionJobStatus({ jobId: job.job_id, status, notes: `Moved from ${job.status} to ${status}` });
      await load();
    } catch (err) {
      setMessage(err.message || 'Failed to update job status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page phase2-page">
      <section className="page-header phase2-header">
        <div>
          <p className="eyebrow">Phase 2</p>
          <h1>Production Status Board</h1>
          <p>Move pull sheets through production: waiting, ready, production, QC, shipping, and completed.</p>
        </div>
        <Link className="secondary-button" to="/pullsheets">Open Pull Sheets</Link>
      </section>

      <section className="card elevated-card phase2-actions">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job, customer, order, status..." />
        <button type="button" onClick={load}>Search</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="phase2-kanban">
        {COLUMNS.map(([status, label]) => (
          <div className="phase2-column" key={status}>
            <h2>{label} <span>{grouped[status]?.length || 0}</span></h2>
            {(grouped[status] || []).map((job) => (
              <article className="phase2-card" key={job.job_id}>
                <strong>{job.job_name || `Job ${job.job_id}`}</strong>
                <span>{job.customer_name || 'No customer'} {job.woocommerce_order_id ? `· Order ${job.woocommerce_order_id}` : ''}</span>
                <small>{job.total_units || 0} units · {job.completed_units || 0} completed · {job.finished_inventory_used || 0} finished used</small>
                {job.due_date && <small>Due {new Date(job.due_date).toLocaleDateString()}</small>}
                <div className="phase2-card-actions">
                  <Link to={`/pullsheets/${job.job_id}`}>Open</Link>
                  {COLUMNS.filter(([next]) => next !== status).slice(0, 5).map(([next, nextLabel]) => (
                    <button key={next} type="button" disabled={busyId === job.job_id} onClick={() => move(job, next)}>{nextLabel}</button>
                  ))}
                </div>
              </article>
            ))}
            {!grouped[status]?.length && <p className="helper-text">No jobs.</p>}
          </div>
        ))}
      </section>
    </main>
  );
}
