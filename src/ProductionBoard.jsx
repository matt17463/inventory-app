import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const columns = [
  { key: 'waiting_on_blanks', label: 'Waiting on Blanks' },
  { key: 'ready_to_produce', label: 'Ready to Produce' },
  { key: 'in_production', label: 'In Production' },
  { key: 'qc', label: 'QC' },
  { key: 'ready_to_ship', label: 'Ready to Ship' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '_');
  if (!s || s === 'reserved' || s === 'new' || s === 'open') return 'ready_to_produce';
  if (s === 'waiting') return 'waiting_on_blanks';
  if (s === 'quality_control') return 'qc';
  if (s === 'canceled') return 'cancelled';
  return s;
}

export default function ProductionBoard() {
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadJobs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) setMessage(error.message);
    else setJobs(data || []);
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  async function updateStatus(job, status) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', job.id);
    if (error) setMessage(error.message);
    else loadJobs();
  }

  const grouped = useMemo(() => {
    const out = Object.fromEntries(columns.map((c) => [c.key, []]));
    for (const job of jobs) {
      const key = normalizeStatus(job.status);
      (out[key] || out.ready_to_produce).push(job);
    }
    return out;
  }, [jobs]);

  const customer = (job) => job.customer_name || job.customer || job.billing_name || `Job #${job.id}`;
  const orderRef = (job) => job.woocommerce_order_id ? `Woo #${job.woocommerce_order_id}` : job.manual_order_id ? `Manual #${job.manual_order_id}` : `Job #${job.id}`;

  return (
    <div className="sc-page-stack">
      <div className="sc-page-header-card">
        <div><div className="sc-kicker">Production</div><h2>Production Status Board</h2><p>Move jobs through production using clear cards instead of crowded action buttons.</p></div>
        <button className="sc-btn" onClick={loadJobs}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </div>
      {message && <div className="sc-alert">{message}</div>}
      <div className="sc-kanban-board">
        {columns.map((col) => (
          <section className="sc-kanban-column" key={col.key}>
            <div className="sc-kanban-header"><strong>{col.label}</strong><span>{grouped[col.key]?.length || 0}</span></div>
            <div className="sc-kanban-cards">
              {(grouped[col.key] || []).map((job) => (
                <article className="sc-job-card" key={job.id}>
                  <div className="sc-card-title-row"><strong>{customer(job)}</strong><span className="sc-badge">{orderRef(job)}</span></div>
                  <div className="sc-job-meta">
                    <span>Status: {job.status || 'open'}</span>
                    <span>Due: {job.due_date || 'Not set'}</span>
                    <span>Created: {job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}</span>
                  </div>
                  <label className="sc-field"><span>Move Status</span><select value={normalizeStatus(job.status)} onChange={(e) => updateStatus(job, e.target.value)}>{columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
                  <div className="sc-card-actions"><Link className="sc-btn sc-btn-small" to={`/pull-sheets/${job.id}`}>Open Pull Sheet</Link></div>
                </article>
              ))}
              {!grouped[col.key]?.length && <div className="sc-empty-card">No jobs</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
