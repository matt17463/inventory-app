import { useEffect, useState } from 'react';
import { getPhase5ProductionCalendar } from './lib/inventoryApi';

export default function ProductionCalendar() {
  const [rows, setRows] = useState([]); const [message, setMessage] = useState('');
  async function load(){ try{ setRows(await getPhase5ProductionCalendar()); setMessage(''); }catch(err){ setMessage(err.message || 'Failed to load production calendar.'); } }
  useEffect(()=>{ load(); }, []);
  return <main className="page"><section className="page-header"><div><p className="eyebrow">Schedule</p><h1>Production Calendar</h1><p>Plan jobs by due date, status, estimated production time, and risk level.</p></div><button onClick={load}>Refresh</button></section>{message&&<p className="message">{message}</p>}<section className="card elevated-card table-card"><div className="responsive-table"><table className="data-table"><thead><tr><th>Date</th><th>Job</th><th>Customer</th><th>Status</th><th>Units</th><th>Est. Hours</th><th>Risk</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan="7">No scheduled jobs found.</td></tr>:rows.map(row=><tr key={row.job_id}><td>{row.schedule_date || 'Unscheduled'}</td><td>{row.job_name}</td><td>{row.customer_name}</td><td>{row.status}</td><td>{row.total_units}</td><td>{Number(row.estimated_hours||0).toFixed(2)}</td><td><strong>{row.risk_level}</strong></td></tr>)}</tbody></table></div></section></main>;
}
