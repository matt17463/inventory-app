import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { shouldSimulateWrites } from './lib/testingMode';
import './GuidedJobPhaseTwo.css';

const drill = [
  { title:'Confirm order source', task:'Is this a recurring WooCommerce order or an occasional QuickBooks-invoiced group order?', check:'WooCommerce checkout belongs to the online store. A one-time group request must be approved and invoiced through Client Orders.' },
  { title:'Check approved artwork',task:'Where is the approved production file, and does its version match the printed instructions?',check:'Artwork existence alone does not prove client approval. Verify actual approval and exact approved print file.'},
  { title:'Check blank inventory',task:'What should you do when a job item has no mapped blank or active reservation?',check:'Correct mappings and review the authoritative Purchasing Report. Never deduct inventory from the training exercise.'},
  { title:'Use QR job instructions',task:'Locate the approved recipe and garment placement diagram for the correct product size.',check:'Use measured placement instructions and verify the physical garment before pressing or printing.'},
  { title:'Inspect quality and pack',task:'Where do QC pass/fail and packing confirmation belong?',check:'Save inspection on the official QC Checklist. Packing evidence is separate from QC and cannot substitute for a passed inspection.'},
  { title:'Customer handoff',task:'What proof confirms the customer collected the order or the shipment was dispatched?',check:'Record the actual pickup/shipping evidence and update the authoritative Production Board separately.'},
];
const labels={packing_checked:'Packing verified',ready_for_pickup:'Ready for pickup',picked_up:'Customer collected',shipped:'Shipped',delivery_exception:'Delivery blocker'};
const mayShip=new Set(['packing_checked','ready_for_pickup','picked_up','shipped','delivery_exception']);
function message(e){return e?.message||'Unable to save job evidence.';}

export default function GuidedJobPhaseTwo({jobId,evidence,onRefresh,editable=false}){
 const [candidates,setCandidates]=useState([]);
 const [handoffId,setHandoffId]=useState('');
 const [kind,setKind]=useState('packing_checked');
 const [details,setDetails]=useState('');
 const [packages,setPackages]=useState('1');
 const [carrier,setCarrier]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [showDrill,setShowDrill]=useState(false);
 const [drillStep,setDrillStep]=useState(0);
 const [showAnswer,setShowAnswer]=useState(false);
 const qc=[...(evidence?.qc||[])].sort((a,b)=>new Date(b.qc_completed_at||b.created_at||0)-new Date(a.qc_completed_at||a.created_at||0))[0];
 const passed=qc?.passed===true;
 const stored=evidence?.fulfillment||[];
 const linked=evidence?.artworkLinks||[];
 useEffect(()=>{
  let alive=true;
  setCandidates([]);setHandoffId('');setNotice('');
  if(!jobId||!editable)return;
  // Read only source candidates; no handoff is marked approved by this listing.
  supabase.from('sc_approval_production_handoffs')
    .select('id,artwork_title,approved_file_url,automation_status,production_job_id')
    .not('approved_file_url','is',null).order('created_at',{ascending:false}).limit(100)
    .then(({data,error})=>{
      if(!alive)return;
      if(error)setNotice('Artwork candidates unavailable: '+message(error));
      else setCandidates((data||[]).filter(r=>Boolean(r.approved_file_url)));
    });
  return()=>{alive=false;};
 },[jobId,editable]);

 async function linkArtwork(){
  if(!handoffId||!jobId)return;
  setBusy(true);setNotice('');
  try {
   if(shouldSimulateWrites())throw Error('Testing Mode: no live artwork link was created. Exit training when you are ready for a real job.');
   const candidate=candidates.find(c=>c.id===handoffId);
   if(!candidate)throw Error('Choose a valid artwork handoff.');
   if(candidate.production_job_id && String(candidate.production_job_id)!==String(jobId))
     throw Error('This handoff is already attached to another production job.');
   if(!window.confirm('Confirm this is the EXACT client-approved artwork for job #'+jobId+'? This links evidence only; it will not approve the artwork or change production status.'))return;
   const {data:session,error:userError}=await supabase.auth.getUser();
   if(userError||!session.user)throw Error('Sign in before linking artwork.');
   const {error}=await supabase.from('sc_job_artwork_links').insert({job_id:jobId,handoff_id:handoffId,linked_by:session.user.id});
   if(error)throw error;
   await onRefresh?.();setNotice('Approved artwork reference linked. Verify customer approval and production file version.');
  }catch(e){setNotice(message(e));}
  finally{setBusy(false);}
 }
 async function saveFulfillment(e){
  e.preventDefault();setBusy(true);setNotice('');
  try {
   if(shouldSimulateWrites())throw Error('Testing Mode: packing/fulfillment is a read-only drill. No live records were created.');
   if(!mayShip.has(kind))throw Error('Choose an accepted fulfillment event.');
   if(!details.trim()||details.trim().length<2)throw Error('Enter the actual packing or handoff details.');
   const count=Number(packages);
   if(!Number.isSafeInteger(count)||count<1||count>10000)throw Error('Package count must be from 1 to 10,000.');
   if(['picked_up','shipped','ready_for_pickup'].includes(kind)&&!passed)
     throw Error('This job does not have a latest passing QC checklist. Complete official QC before marking pickup or shipment.');
   if(['shipped','picked_up'].includes(kind)&&!window.confirm('Confirm that the actual customer handoff/dispatch occurred, not just that it is scheduled.'))return;
   const {data:session,error:userError}=await supabase.auth.getUser();
   if(userError||!session.user)throw Error('Sign in before saving fulfillment.');
   const {error}=await supabase.from('sc_job_fulfillment_checks').insert({
     job_id:jobId,kind,details:details.trim(),package_count:count,
     carrier_reference:kind==='shipped'?carrier.trim()||null:null,actor_id:session.user.id,
   });
   if(error)throw error;
   setDetails('');setCarrier('');await onRefresh?.();
   setNotice('Actual fulfillment evidence recorded. Verify/update the official Production Board separately.');
  }catch(e){setNotice(message(e));}
  finally{setBusy(false);}
 }
 return <div className="sc-hub-phase-two">
  <section className="sc-hub-phase-section">
   <h4>Approved artwork: link the exact production handoff</h4>
   <p>Use an existing artwork handoff instead of copying an unrelated file. This does not grant client approval; check the original approval record and production file.</p>
   {linked.length?<ul>{linked.map(x=><li key={x.id}><strong>{x.handoff?.artwork_title||'Artwork handoff'}</strong>
    {' · '+(x.handoff?.automation_status||'Status not confirmed')}{x.handoff?.approved_file_url?' · Approved-file reference exists':''}</li>)}</ul>:<p>No explicit artwork handoff linked to this job.</p>}
   {editable&&<div className="sc-hub-phase-form"><label>Choose an existing artwork handoff
    <select value={handoffId} onChange={e=>setHandoffId(e.target.value)}><option value="">Select artwork file reference</option>
     {candidates.map(c=><option value={c.id} key={c.id}>{c.artwork_title||'Artwork'} — {c.automation_status||'unreviewed'} {c.production_job_id?'[linked job '+c.production_job_id+']':''}</option>)}
    </select></label>
    <button type="button" onClick={linkArtwork} disabled={busy||!handoffId||linked.some(x=>x.handoff_id===handoffId)}>Link to selected job</button></div>}
   <Link to="/approval-automation">Open authoritative artwork approvals →</Link>
  </section>
  <section className="sc-hub-phase-section">
   <h4>QC & packing / delivery evidence</h4>
   <p><strong>Latest QC:</strong> {passed?'Pass recorded':qc?.passed===false?'Needs correction':'No passing inspection on file'} · <Link to={'/qc-checklist?job='+jobId}>Open this job in QC →</Link></p>
   {stored.length?<ul>{stored.map(x=><li key={x.id}>
    <strong>{labels[x.kind]||x.kind}</strong> — {x.details} · {new Date(x.created_at).toLocaleString()}
    {x.package_count?' · '+x.package_count+' packages':''}
    </li>)}</ul>:<p>No packing, shipment or customer collection evidence recorded yet.</p>}
   {editable&&<form onSubmit={saveFulfillment} className="sc-hub-phase-form">
    <label>Event<select value={kind} onChange={e=>setKind(e.target.value)}>
     {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Package count<input type="number" min="1" max="10000" value={packages} onChange={e=>setPackages(e.target.value)}/></label>
    {kind==='shipped'&&<label>Carrier/tracking reference (optional)<input value={carrier} maxLength={150} onChange={e=>setCarrier(e.target.value)}/></label>}
    <label>Actual packing, pickup or delivery details<textarea rows="2" maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="What was checked, packed or handed to the customer?" /></label>
    <button type="submit" disabled={busy||details.trim().length<2}>Save fulfillment evidence</button>
    <small>Notes are append-only. This action does not send notifications, book shipping, change WooCommerce/QBO billing, or complete the production job.</small>
   </form>}
  </section>
  <section className="sc-hub-phase-section sc-hub-training-drill">
   <div className="sc-hub-drill-head"><div><h4>Family training: safe job walkthrough</h4>
    <p>Practice the six decisions in a simulated example, without touching live orders or stock.</p></div>
    <button type="button" onClick={()=>{setShowDrill(v=>!v);setDrillStep(0);setShowAnswer(false);}}>{showDrill?'Close training':'Start walkthrough'}</button></div>
   {showDrill&&<div className="sc-hub-drill-content">
    <p className="eyebrow">Practice {drillStep+1} of {drill.length}</p>
    <h5>{drill[drillStep].title}</h5><p>{drill[drillStep].task}</p>
    {showAnswer&&<div className="sc-hub-drill-answer"><strong>What to verify:</strong> {drill[drillStep].check}</div>}
    <div className="sc-team-controls">
     <button type="button" onClick={()=>setShowAnswer(v=>!v)}>{showAnswer?'Hide guidance':'Show guidance'}</button>
     <button type="button" onClick={()=>{setDrillStep(v=>Math.max(0,v-1));setShowAnswer(false);}} disabled={drillStep===0}>Back</button>
     <button type="button" onClick={()=>{if(drillStep===drill.length-1){setShowDrill(false);setDrillStep(0);}else{setDrillStep(v=>v+1);}setShowAnswer(false);}}>
      {drillStep===drill.length-1?'Finish walkthrough':'Next practice step →'}</button>
    </div>
   </div>}
  </section>
  {notice&&<p role="status" className="message">{notice}</p>}
 </div>;
}
