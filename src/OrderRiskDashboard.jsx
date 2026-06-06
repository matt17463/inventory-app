import { useEffect, useState } from 'react';
import { getPhase5RiskDashboard } from './lib/inventoryApi';

export default function OrderRiskDashboard() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  async function load() {
    try { setRows(await getPhase5RiskDashboard(search)); setMessage(''); }
    catch (err) { setMessage(err.message || 'Failed to load risk dashboard.'); }
  }
  useEffect(() => { load(); }, []);

  return <main className="page"><section className="page-header"><div><p className="eyebrow">Priority</p><h1>Order Priority & Due Date Risk</h1><p>Jobs are scored by due date, status, shortages, production progress, and open tasks.</p></div><button onClick={load}>Refresh</button></section>{message && <p className="message">{message}</p>}<section className="card elevated-card"><div className="search-row"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search job, customer, order, status..." /><button onClick={load}>Search</button></div></section><section className="card elevated-card table-card"><div className="responsive-table"><table className="data-table"><thead><tr><th>Risk</th><th>Job</th><th>Customer</th><th>Order</th><th>Status</th><th>Due</th><th>Open Tasks</th><th>Reason</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan="8">No jobs found.</td></tr>:rows.map(row=><tr key={row.job_id}><td><strong>{row.risk_level}</strong><br />{row.risk_score}</td><td>{row.job_name}</td><td>{row.customer_name}</td><td>{row.woocommerce_order_id || '—'}</td><td>{row.status}</td><td>{row.due_date || '—'}</td><td>{row.open_task_count}</td><td>{row.risk_reason}</td></tr>)}</tbody></table></div></section></main>;
}
