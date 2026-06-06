import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPhase5CommandCenter, getPhase5RiskDashboard, getPhase5Tasks } from './lib/inventoryApi';

export default function DailyCommandCenter() {
  const [summary, setSummary] = useState({});
  const [riskRows, setRiskRows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [center, risks, taskRows] = await Promise.all([
        getPhase5CommandCenter(),
        getPhase5RiskDashboard(''),
        getPhase5Tasks('open'),
      ]);
      setSummary(center || {});
      setRiskRows((risks || []).slice(0, 10));
      setTasks((taskRows || []).slice(0, 8));
      setMessage('');
    } catch (err) {
      setMessage(err.message || 'Failed to load command center.');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Daily Operations</p>
          <h1>Today at Skilled Crafting</h1>
          <p>One screen for urgent jobs, blocked work, production, purchasing, tasks, QC, and low-stock alerts.</p>
        </div>
        <button type="button" onClick={load}>Refresh</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="kpi-grid phase5-command-kpis">
        <Link className="kpi-card" to="/order-risk"><span>{summary.critical_jobs ?? 0}</span><strong>Critical Jobs</strong><small>Due soon, blocked, or late</small></Link>
        <Link className="kpi-card" to="/waiting-on"><span>{summary.waiting_on_items ?? 0}</span><strong>Waiting On</strong><small>Shortages blocking work</small></Link>
        <Link className="kpi-card" to="/production-board"><span>{summary.in_production_jobs ?? 0}</span><strong>In Production</strong><small>Active shop-floor jobs</small></Link>
        <Link className="kpi-card" to="/qc-checklist"><span>{summary.qc_jobs ?? 0}</span><strong>QC Queue</strong><small>Needs inspection</small></Link>
        <Link className="kpi-card" to="/employee-tasks"><span>{summary.open_tasks ?? 0}</span><strong>Open Tasks</strong><small>Assigned or unassigned</small></Link>
        <Link className="kpi-card" to="/purchase-orders"><span>{summary.open_purchase_orders ?? 0}</span><strong>Open POs</strong><small>Ordered or partial</small></Link>
      </section>

      <section className="content-two-column wide-two-column">
        <section className="card elevated-card table-card">
          <div className="section-heading-row"><h2>Highest Risk Jobs</h2><Link to="/order-risk">View all →</Link></div>
          <div className="responsive-table"><table className="data-table"><thead><tr><th>Risk</th><th>Job</th><th>Customer</th><th>Status</th><th>Due</th><th>Reason</th></tr></thead><tbody>
            {riskRows.length === 0 ? <tr><td colSpan="6">No risk rows found.</td></tr> : riskRows.map((row) => (
              <tr key={row.job_id}><td><strong>{row.risk_level}</strong><br />{row.risk_score}</td><td>{row.job_name}</td><td>{row.customer_name}</td><td>{row.status}</td><td>{row.due_date || '—'}</td><td>{row.risk_reason}</td></tr>
            ))}
          </tbody></table></div>
        </section>

        <section className="card elevated-card table-card">
          <div className="section-heading-row"><h2>Open Tasks</h2><Link to="/employee-tasks">Manage tasks →</Link></div>
          <div className="responsive-table"><table className="data-table"><thead><tr><th>Task</th><th>Assigned</th><th>Status</th><th>Due</th></tr></thead><tbody>
            {tasks.length === 0 ? <tr><td colSpan="4">No open tasks.</td></tr> : tasks.map((task) => (
              <tr key={task.id}><td><strong>{task.title}</strong><br /><small>{task.job_name || task.task_type}</small></td><td>{task.assigned_to_name || 'Unassigned'}</td><td>{task.status}</td><td>{task.due_at ? new Date(task.due_at).toLocaleString() : '—'}</td></tr>
            ))}
          </tbody></table></div>
        </section>
      </section>
    </main>
  );
}
