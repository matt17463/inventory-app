import { useEffect, useState } from 'react';
import { getPhase5CapacityPlanning } from './lib/inventoryApi';

export default function CapacityPlanning() {
  const [rows, setRows] = useState([]); const [message, setMessage] = useState('');
  async function load(){ try{ setRows(await getPhase5CapacityPlanning()); setMessage(''); }catch(err){ setMessage(err.message || 'Failed to load capacity planning.'); } }
  useEffect(()=>{ load(); }, []);
  return <main className="page"><section className="page-header"><div><p className="eyebrow">Capacity</p><h1>Capacity Planning</h1><p>Compare scheduled production hours to available shop capacity.</p></div><button onClick={load}>Refresh</button></section>{message&&<p className="message">{message}</p>}<section className="card elevated-card table-card"><div className="responsive-table"><table className="data-table"><thead><tr><th>Date</th><th>Jobs</th><th>Units</th><th>Scheduled Hours</th><th>Available Hours</th><th>Balance</th><th>Status</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan="7">No capacity rows.</td></tr>:rows.map(row=><tr key={row.schedule_date}><td>{row.schedule_date}</td><td>{row.job_count}</td><td>{row.total_units}</td><td>{Number(row.scheduled_hours||0).toFixed(2)}</td><td>{Number(row.available_hours||0).toFixed(2)}</td><td>{Number(row.remaining_hours||0).toFixed(2)}</td><td><strong>{row.capacity_status}</strong></td></tr>)}</tbody></table></div></section></main>;
}
