import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { PageHeader, HelpPanel, SectionCard, StatusBadge, ActionButton, EmptyState } from './components/UIPrimitives';

const STATUSES = [
  ['waiting_on_blanks', 'Waiting on Blanks'],
  ['ready_to_produce', 'Ready to Produce'],
  ['in_production', 'In Production'],
  ['qc', 'QC'],
  ['ready_to_ship', 'Ready to Ship'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

function normalizeStatus(status) {
  const s = String(status || 'ready_to_produce').toLowerCase();
  if (s.includes('waiting')) return 'waiting_on_blanks';
  if (s.includes('production') || s === 'in-progress') return 'in_production';
  if (s.includes('qc')) return 'qc';
  if (s.includes('ship')) return 'ready_to_ship';
  if (s.includes('complete')) return 'completed';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('ready')) return 'ready_to_produce';
  if (s === 'reserved' || s === 'new' || s === 'open') return 'ready_to_produce';
  return s;
}

function JobCard({ job, onStatusChange }) {
  const label = job.customer_name || job.customer || job.organization || `Job #${job.id}`;
  const source = job.source_type || (job.woocommerce_order_id ? 'WooCommerce' : 'Manual/Internal');
  const due = job.due_date || job.deadline || '';
  const qty = job.total_quantity || job.quantity || job.item_count || '';
  return (
    <article className="sc-job-card">
      <div className="sc-job-card__top">
        <strong>{label}</strong>
        <StatusBadge status={job.status || 'ready'} />
      </div>
      <div className="sc-job-card__meta">
        <span>Job #{job.id}</span>
        {job.woocommerce_order_id ? <span>Woo #{job.woocommerce_order_id}</span> : null}
        <span>{source}</span>
      </div>
      <div className="sc-job-card__details">
        {due ? <span><b>Due:</b> {due}</span> : <span><b>Due:</b> Not set</span>}
        {qty ? <span><b>Qty:</b> {qty}</span> : null}
      </div>
      <div className="sc-job-card__actions">
        <select value={normalizeStatus(job.status)} onChange={(e) => onStatusChange(job.id, e.target.value)}>
          {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <a className="sc-action-link" href={`/pull-sheets/${job.id}`}>Open Pull Sheet</a>
      </div>
    </article>
  );
}

export default function ProductionBoard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadJobs() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) setError(error.message);
    else setJobs(data || []);
    setLoading(false);
  }

  useEffect(() => { loadJobs(); }, []);

  async function updateJobStatus(jobId, status) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) {
      alert(error.message);
      return;
    }
    setJobs((rows) => rows.map((j) => j.id === jobId ? { ...j, status } : j));
  }

  const grouped = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map(([key]) => [key, []]));
    jobs.forEach((job) => {
      const key = normalizeStatus(job.status);
      if (!map[key]) map[key] = [];
      map[key].push(job);
    });
    return map;
  }, [jobs]);

  return (
    <main className="sc-page sc-production-board-page">
      <PageHeader
        eyebrow="PRODUCTION"
        title="Production Status Board"
        description="Track every active job through the production workflow using clear cards instead of crowded action rows."
        actions={<ActionButton tone="secondary" onClick={loadJobs}>Refresh</ActionButton>}
      />
      <HelpPanel>
        <p>Use the status dropdown on each job card to move work from waiting, to production, to QC, and finally to completed. Open the pull sheet when you need item-level blank, pairing, cancellation, or completion details.</p>
      </HelpPanel>
      {loading ? <SectionCard><p>Loading production board…</p></SectionCard> : null}
      {error ? <SectionCard tone="danger"><p>{error}</p></SectionCard> : null}
      {!loading && !jobs.length ? <EmptyState title="No production jobs found" description="Generated pull sheets and manual orders will appear here once jobs exist." /> : null}
      <div className="sc-kanban-board">
        {STATUSES.map(([key, label]) => (
          <section key={key} className="sc-kanban-column">
            <header><h2>{label}</h2><span>{grouped[key]?.length || 0}</span></header>
            <div className="sc-kanban-column__body">
              {(grouped[key] || []).map((job) => <JobCard key={job.id} job={job} onStatusChange={updateJobStatus} />)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
