import { useEffect, useState } from 'react';
import { createApprovalHandoff, getApprovalHandoffs, markApprovalReadyForProduction } from './lib/phase6Api';

const initial = { customer_name:'', customer_email:'', organization:'', artwork_title:'', artwork_code:'', mockup_url:'', approved_file_url:'', print_locations:'', garment_notes:'', due_date:'' };

export default function ApprovalAutomation() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  async function load(){ setError(''); try { setRows(await getApprovalHandoffs()); } catch(e){ setError(e.message); } }
  useEffect(()=>{load();},[]);
  async function submit(e){ e.preventDefault(); await createApprovalHandoff(form); setForm(initial); await load(); }
  async function ready(row){ const jobId = prompt('Optional production job ID to link:', row.production_job_id || ''); const note = prompt('Manager note:', row.manager_note || ''); await markApprovalReadyForProduction(row.id, jobId || '', note || ''); await load(); }
  return <main className="page phase6-page"><h1>Approval-to-Production Automation</h1><p className="muted">Turn approved artwork into production-ready handoffs, portal updates, audit logs, and task triggers.</p>{error&&<div className="error-card">{error}</div>}
    <form className="phase6-panel phase6-grid-form" onSubmit={submit}><h2>Manual Handoff</h2>
      {Object.keys(initial).map(k => <input key={k} placeholder={k.replaceAll('_',' ')} value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})}/>) }
      <button className="button button-primary">Create Handoff</button>
    </form>
    <div className="table-wrap"><table className="data-table compact-table"><thead><tr><th>Created</th><th>Customer</th><th>Artwork</th><th>Status</th><th>Files</th><th>Action</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.customer_name}<br/><small>{r.organization}</small></td><td>{r.artwork_title}<br/><code>{r.artwork_code}</code></td><td>{r.automation_status}</td><td>{r.mockup_url&&<a href={r.mockup_url} target="_blank">Mockup</a>} {r.approved_file_url&&<a href={r.approved_file_url} target="_blank">File</a>}</td><td><button className="button small" onClick={()=>ready(r)}>Ready for Production</button></td></tr>)}
      {!rows.length&&<tr><td colSpan="6">No approval handoffs yet.</td></tr>}
    </tbody></table></div>
  </main>;
}
