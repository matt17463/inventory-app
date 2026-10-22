import {useEffect,useMemo,useState} from 'react';
import {getTeamTraining,certifyTraining} from '../lib/centralTrainingApi';
import {TRAINING_VERSION,trainingTutorials} from './trainingData';

const shortId=id=>id?String(id).slice(0,8)+'…'+String(id).slice(-4):'Unknown';
export default function TrainingCertificationBoard(){
 const [rows,setRows]=useState([]),[employee,setEmployee]=useState(''),[tutorial,setTutorial]=useState(''),
  [note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[state,setState]=useState('loading');
 async function refresh(){
  setBusy(true);setError('');
  try{
   const data=await getTeamTraining();
   setRows(data.records||[]);setState('ready');
  }catch(e){setState('unavailable');setError(e.message||'Manager training report unavailable.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{refresh();},[]);
 const users=useMemo(()=>[...new Set(rows.map(r=>r.user_id))].sort(),[rows]);
 const available=useMemo(()=>rows.filter(r=>r.user_id===employee&&r.completed&&
  r.curriculum_version===TRAINING_VERSION&&!r.certification&&
  trainingTutorials.some(t=>t.id===r.tutorial_id)),[employee,rows]);
 async function signoff(){
  if(!employee||!tutorial)return;
  setBusy(true);setError('');
  try{
   await certifyTraining(employee,tutorial,note);
   setNote('');setTutorial('');await refresh();
  }catch(e){setError(e.message||'Manager signoff was not saved.');}
  finally{setBusy(false);}
 }
 return <section className="sc-training-certification">
  <h3>Manager qualification and training report</h3>
  <p>Training completion and manager qualification are separate. Only an authorized manager can certify a completed, current-version tutorial. A later employee edit or curriculum update invalidates the displayed certification.</p>
  <button type="button" disabled={busy} onClick={refresh}>Refresh training records</button>
  {state==='loading'&&<p role="status">Loading central employee training records…</p>}
  {error&&<p role="alert">{error}</p>}
  {state==='ready'&&<>
   <p><strong>{users.length}</strong> account(s) with saved training · <strong>{rows.filter(x=>x.certification).length}</strong> current manager qualification(s) · <strong>{rows.filter(x=>x.completed&&!x.certification).length}</strong> completion(s) awaiting signoff.</p>
   <div className="sc-training-board-list">{rows.map(r=><div key={r.user_id+':'+r.tutorial_id}>
    <strong>{shortId(r.user_id)}</strong> · {trainingTutorials.find(t=>t.id===r.tutorial_id)?.title||r.tutorial_id}
    <small>{r.completed?'Completed':'In progress'} · {r.certification?'Manager certified':r.completed?'Awaiting manager signoff':'Not ready'} · {r.curriculum_version===TRAINING_VERSION?'Current curriculum':'Old curriculum'} · {new Date(r.updated_at).toLocaleDateString()}</small>
   </div>)}</div>
   {!rows.length&&<p>No central training records yet. Employees can begin tracking their current tutorials from this page.</p>}
   <div className="sc-training-signoff-controls">
    <label>Employee account
     <select value={employee} onChange={e=>{setEmployee(e.target.value);setTutorial('');}}>
      <option value="">Select employee</option>{users.map(id=><option key={id} value={id}>{shortId(id)}</option>)}
     </select>
    </label>
    <label>Completed training to certify
     <select value={tutorial} onChange={e=>setTutorial(e.target.value)}>
      <option value="">Select completed tutorial</option>{available.map(row=><option key={row.tutorial_id} value={row.tutorial_id}>
       {trainingTutorials.find(t=>t.id===row.tutorial_id)?.title||row.tutorial_id}</option>)}
     </select>
    </label>
    <label>Manager observation / signoff note
     <textarea value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}
      placeholder="Record a supervised demonstration or practical qualification outcome."/>
    </label>
    <button type="button" disabled={busy||!employee||!tutorial} onClick={signoff}>Certify completed tutorial</button>
   </div>
  </>}
 </section>;
}
