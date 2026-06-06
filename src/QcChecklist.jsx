import { useEffect, useState } from 'react';
import { getPhase5QcJobs, savePhase5QcChecklist } from './lib/inventoryApi';

const CHECKS = [
  ['correct_garment', 'Correct garment'],
  ['correct_color', 'Correct color'],
  ['correct_size_counts', 'Correct size counts'],
  ['correct_logo', 'Correct logo'],
  ['correct_placement', 'Correct placement'],
  ['correct_decoration_size', 'Correct decoration size'],
  ['no_stains', 'No stains'],
  ['no_scorch_marks', 'No scorch marks'],
  ['no_misprints', 'No misprints'],
  ['packed_correctly', 'Folded / packed correctly'],
];

export default function QcChecklist() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checks, setChecks] = useState({});
  const [checkedBy, setCheckedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  async function load(){ try{ setRows(await getPhase5QcJobs('')); setMessage(''); } catch(err){ setMessage(err.message || 'Failed to load QC queue.'); } }
  useEffect(()=>{ load(); }, []);
  function choose(row){ setSelected(row); setChecks(row.checklist || {}); setNotes(row.qc_notes || ''); }
  async function save(passed){ try{ await savePhase5QcChecklist({ jobId:selected.job_id, checklist: checks, passed, checkedBy, notes }); setSelected(null); setChecks({}); setNotes(''); await load(); } catch(err){ setMessage(err.message || 'Failed to save QC checklist.'); } }
  const allChecked = CHECKS.every(([key]) => Boolean(checks[key]));
  return <main className="page"><section className="page-header"><div><p className="eyebrow">Quality Control</p><h1>QC Checklist</h1><p>Verify garments, counts, logo, placement, decoration quality, and packing before shipping.</p></div><button onClick={load}>Refresh</button></section>{message&&<p className="message">{message}</p>}<section className="content-two-column wide-two-column"><section className="card elevated-card table-card"><h2>Jobs Needing QC</h2><div className="responsive-table"><table className="data-table"><thead><tr><th>Job</th><th>Customer</th><th>Status</th><th>Due</th><th>Action</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan="5">No QC jobs found.</td></tr>:rows.map(row=><tr key={row.job_id}><td>{row.job_name}</td><td>{row.customer_name}</td><td>{row.status}</td><td>{row.due_date || '—'}</td><td><button onClick={()=>choose(row)}>Open QC</button></td></tr>)}</tbody></table></div></section><section className="card elevated-card"><h2>{selected ? `QC: ${selected.job_name}` : 'Select a job'}</h2>{!selected?<p>Choose a job from the queue to complete the checklist.</p>:<><label>Checked by</label><input value={checkedBy} onChange={e=>setCheckedBy(e.target.value)} placeholder="Name" />{CHECKS.map(([key,label])=><label key={key} className="checkbox-line"><input type="checkbox" checked={Boolean(checks[key])} onChange={e=>setChecks({...checks,[key]:e.target.checked})}/>{label}</label>)}<label>QC Notes</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Corrections, issues, remake notes..."/><div className="button-row"><button disabled={!allChecked} onClick={()=>save(true)}>Pass QC</button><button className="secondary-button" onClick={()=>save(false)}>Save / Needs Correction</button></div></>}</section></section></main>;
}
