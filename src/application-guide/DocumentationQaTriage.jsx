import {useEffect,useMemo,useState} from 'react';
import {getDocumentationQa,saveDocumentationQa} from '../lib/centralTrainingApi';
import wordpress from './wordpressPluginAudits.json';
import dialogs from './conditionalDialogs.json';

const states=['needs-review','in-progress','evidence-captured','blocked'];
const pending=[
 ...(wordpress.plugins||[]).filter(p=>!(p.adminScreens||[]).length&&!(p.publicScreens||[]).length)
   .map(p=>({type:'wordpress-plugin',id:p.slug,title:p.name,description:'Inventory only — no plugin screen details verified'})),
 ...(dialogs.dialogs||[]).filter(d=>d.status!=='live-verified')
   .map(d=>({type:'conditional-dialog',id:d.id,title:d.title,description:d.status+' — behavior not fully live-verified'})),
];
export default function DocumentationQaTriage(){
 const [records,setRecords]=useState([]),[selected,setSelected]=useState(''),
  [state,setState]=useState('needs-review'),[evidence,setEvidence]=useState(''),
  [note,setNote]=useState(''),[status,setStatus]=useState('loading'),[error,setError]=useState('');
 const selection=useMemo(()=>pending.find(x=>x.type+':'+x.id===selected),[selected]);
 async function reload(){
  try{const d=await getDocumentationQa();setRecords(d.reviews||[]);setStatus('ready');setError('');}
  catch(e){setStatus('unavailable');setError(e.message||'QA triage is unavailable.');}
 }
 useEffect(()=>{reload();},[]);
 function choose(key){
  setSelected(key);
  const item=pending.find(x=>x.type+':'+x.id===key);
  const previous=records.find(x=>x.target_type===item?.type&&x.target_id===item?.id);
  setState(previous?.review_state||'needs-review');
  setEvidence(previous?.evidence_reference||'');
  setNote(previous?.reviewer_note||'');
 }
 async function save(){
  if(!selection)return;
  setStatus('saving');setError('');
  try{
   await saveDocumentationQa(selection.type,selection.id,state,evidence,note);
   await reload();
  }catch(e){setStatus('ready');setError('Review was NOT saved: '+(e.message||'Unavailable'));}
 }
 return <section className="sc-doc-qa-triage">
  <h3>WordPress and conditional-screen verification queue</h3>
  <p><strong>{pending.length} outstanding audit targets</strong> are available for triage. Evidence notes are manager-only and browser-independent. Recording evidence does not mark a plugin or dialog live-verified: changing a verification claim requires an independent code-reviewed audit record and rebuild.</p>
  <button type="button" onClick={reload} disabled={status==='saving'}>Refresh saved QA notes</button>
  <p role="status">Central audit notes: {status==='ready'?'Available':status==='loading'?'Loading…':status==='saving'?'Saving…':'Unavailable'}</p>
  {error&&<p role="alert">{error}</p>}
  <label>Select an outstanding plugin or dialog
   <select value={selected} onChange={e=>choose(e.target.value)}>
    <option value="">Select audit item</option>
    {pending.map(p=><option key={p.type+':'+p.id} value={p.type+':'+p.id}>{p.title} — {p.type}</option>)}
   </select>
  </label>
  {selection&&<div className="sc-doc-qa-edit">
   <p>{selection.description}</p>
   <label>Audit work status
    <select value={state} onChange={e=>setState(e.target.value)}>
     {states.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
   </label>
   <label>Evidence reference (no personal data or secrets)
    <input value={evidence} maxLength={500} onChange={e=>setEvidence(e.target.value)} placeholder="Approved ticket, pull request or private audit ID"/>
   </label>
   <label>Review notes
    <textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}
     placeholder="What was checked? What remains unknown?"/>
   </label>
   <button type="button" disabled={status==='saving'} onClick={save}>Save audit triage</button>
  </div>}
  <div className="sc-doc-qa-records">{records.map(r=><p key={r.target_type+':'+r.target_id}>
    <strong>{r.target_id}</strong> · {r.review_state} · {r.evidence_reference||'No evidence reference'}
   </p>)}</div>
 </section>;
}
