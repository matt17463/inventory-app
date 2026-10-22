import {useMemo,useState} from 'react';
import {supabase} from './supabaseClient';
import {shouldSimulateWrites} from './lib/testingMode';
import {closeoutReadiness,closeoutMessage} from './lib/jobCloseout';
import {downloadJobManifest,downloadPackageLabels} from './lib/closeoutPdf';
import './JobCloseoutCenter.css';

const kinds=[
 ['ready_for_pickup','Ready for pickup'],
 ['shipped','Carrier dispatch'],
 ['pickup_complete','Pickup thank-you'],
 ['delivery_followup','Delivery follow-up'],
];
const shortDate=d=>d?new Date(d).toLocaleString():'—';
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=254;
export default function JobCloseoutCenter({evidence,onRefresh,editable=false,canNotify=false}){
 const state=useMemo(()=>closeoutReadiness(evidence),[evidence]);
 const job=evidence?.job||{};
 const [packageCount,setPackageCount]=useState('1');
 const [printMode,setPrintMode]=useState('pickup');
 const [proofType,setProofType]=useState('carrier_delivery_record');
 const [proofRef,setProofRef]=useState('');
 const [proofNote,setProofNote]=useState('');
 const [kind,setKind]=useState('ready_for_pickup');
 const [recipient,setRecipient]=useState('');
 const [subject,setSubject]=useState('');
 const [messageBody,setMessageBody]=useState('');
 const [sourceDraftId,setSourceDraftId]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const records=evidence?.customerMessages||[];
 const drafts=records.filter(m=>m.state==='draft');
 const sent=new Set(records.filter(m=>m.state==='marked_sent').map(m=>m.source_draft_id));
 const verifiedLines=state.itemRows.filter(x=>x.packed===x.required).length;
 const readyForPickupMessage=state.readyForRelease&&state.kind==='ready';
 const shippingAllowed=state.readyForRelease&&state.shipped;
 const pickupDone=state.hasPickup&&state.readyForRelease;
 const notifyAllowed={
  ready_for_pickup:readyForPickupMessage,
  shipped:shippingAllowed,
  pickup_complete:pickupDone,
  delivery_followup:state.confirmation!==null||pickupDone,
 };
 async function recordAction(label,fn){
  setBusy(true);setNotice('');
  try{
   if(shouldSimulateWrites())throw Error('Testing Mode: live closeout writes are disabled. Use the fictional job training exercise.');
   await fn();await onRefresh?.();
   setNotice(label+' recorded. Review source production status separately.');
  }catch(err){setNotice(err.message||'Could not record action.');}
  finally{setBusy(false);}
 }
 function createDraftTemplate(){
  try{
   const suggested=closeoutMessage({kind,job,channel:state.channel,
     reference:(evidence?.fulfillment||[]).find(x=>x.kind==='shipped')?.carrier_reference||''});
   setSubject(suggested.subject);setMessageBody(suggested.body);setSourceDraftId('');
   setNotice('Template loaded. Confirm the customer email, message wording and readiness before saving.');
  }catch(e){setNotice(e.message);}
 }
 async function saveDraft(){
  await recordAction('Notification draft',async()=>{
   if(!canNotify)throw Error('Manager access required for customer notification drafting.');
   if(!validEmail(recipient.trim()))throw Error('Enter a valid customer email address.');
   if(!notifyAllowed[kind])throw Error('Current job evidence does not support this notification type.');
   const {data,error}=await supabase.auth.getUser();
   if(error||!data.user)throw Error('Sign in first.');
   const {error:insertError}=await supabase.from('sc_job_customer_messages').insert({
    job_id:Number(job.id),event_type:kind,state:'draft',recipient_email:recipient.trim().toLowerCase(),
    subject:subject.trim(),message_body:messageBody.trim(),recorded_by:data.user.id,
   });
   if(insertError)throw insertError;
   setSubject('');setMessageBody('');setSourceDraftId('');
  });
 }
 async function markManuallySent(draft){
  await recordAction('Manual send confirmation',async()=>{
   if(!canNotify)throw Error('Manager access required.');
   if(!notifyAllowed[draft.event_type])throw Error('Job is no longer verified for this notification. Re-check QC, packaging and fulfillment before messaging.');
   if(!window.confirm('Only continue if you ACTUALLY SENT this exact email outside Skilled Crafting to '+draft.recipient_email+'. This does not send email automatically.'))return;
   const {data,error}=await supabase.auth.getUser();
   if(error||!data.user)throw Error('Sign in first.');
   const {error:insertError}=await supabase.from('sc_job_customer_messages').insert({
    job_id:Number(job.id),event_type:draft.event_type,state:'marked_sent',source_draft_id:draft.id,
    recipient_email:draft.recipient_email,subject:draft.subject,message_body:draft.message_body,
    recorded_by:data.user.id,
   });
   if(insertError)throw insertError;
  });
 }
 async function copyDraft(draft){
  try{
   await navigator.clipboard.writeText('To: '+draft.recipient_email+'\nSubject: '+draft.subject+'\n\n'+draft.message_body);
   setNotice('Copied this exact email draft. Open your actual email client, send and confirm its recipient, then mark sent here.');
  }catch{setNotice('Clipboard access unavailable; select and copy the draft text manually.');}
 }
 function prepareProof(e){e.preventDefault();
  recordAction('Delivery confirmation',async()=>{
   if(!editable)throw Error('Production access required.');
   if(!state.shipped||!state.readyForRelease)throw Error('First verify actual carrier dispatch, tracking, paid source, QC and exact packing.');
   if(proofRef.trim().length<5)throw Error('Provide a carrier POD event/URL or actual customer confirmation reference.');
   if(!window.confirm('Did you independently verify delivery, not merely the package being shipped?'))return;
   const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw Error('Sign in first.');
   const {error:writeError}=await supabase.from('sc_job_delivery_confirmations').insert({
    job_id:Number(job.id),proof_type:proofType,proof_reference:proofRef.trim(),
    note:proofNote.trim(),verified_by:data.user.id,
   });
   if(writeError)throw writeError;setProofRef('');setProofNote('');
  });
 }
 function downloadLabels(){
  try{downloadPackageLabels(evidence,{count:Number(packageCount),origin:window.location.origin,method:printMode});}
  catch(e){setNotice(e.message);}
 }
 return <section className="sc-closeout-center" aria-label="Production job closeout">
  <div className="sc-closeout-head"><div><p className="eyebrow">Guided Work Hub / Closeout</p>
    <h3>Package labels, final manifest and customer handoff</h3>
    <p>Review recorded job evidence; generate print materials and prepare customer messages without duplicating your WooCommerce or QuickBooks records.</p></div>
    <span className={'sc-closeout-state '+state.kind}>{state.label}</span>
  </div>
  <div className="sc-closeout-overview">
   <span><strong>{verifiedLines}/{state.itemRows.length}</strong> line counts</span>
   <span><strong>{state.qcPassed?'Passed':'Not verified'}</strong> latest QC</span>
   <span><strong>{state.paymentVerified?'Verified':'Needs review'}</strong> billing</span>
   <span><strong>{state.channel==='unselected'?'Pending':state.channel}</strong> handoff</span>
  </div>
  {!!state.blockers.length&&<div className="sc-closeout-warnings"><strong>Release blockers</strong><ul>
   {state.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
  <section className="sc-closeout-card">
   <h4>1. Print the packing manifest and package labels</h4>
   <p>The manifest lists ordered quantities and latest verified packed quantities. Labels are 4 × 6 inches, include the package number and an internal QR code to this job. They are <strong>not paid carrier postage labels</strong>.</p>
   <div className="sc-closeout-controls">
    <button type="button" onClick={()=>downloadJobManifest(evidence,window.location.origin)}>Download job packing manifest (PDF)</button>
    <label>Number of packages<input type="number" value={packageCount} min="1" max="100" onChange={e=>setPackageCount(e.target.value)}/></label>
    <label>Label purpose<select value={printMode} onChange={e=>setPrintMode(e.target.value)}>
     <option value="pickup">Customer pickup</option><option value="ship">Internal shipping label</option>
    </select></label>
    <button type="button" onClick={downloadLabels}>Download 4×6 package labels (PDF)</button>
   </div>
   {!state.readyForRelease&&<p className="sc-closeout-warning-text">These documents will be marked NOT READY / HOLD. Do not release packages until blockers are resolved.</p>}
  </section>
  <section className="sc-closeout-card">
   <h4>2. Verify customer receipt or carrier delivery</h4>
   {state.hasPickup&&<p>In-person pickup is recorded with a customer acknowledgment in the existing pickup-signature section.</p>}
   {state.shipped?<p>A carrier dispatch with a tracking reference is recorded. Delivery confirmation still requires actual carrier proof or direct customer confirmation.</p>
    :<p>No shipment with tracking is verified. Record actual shipment and carrier reference in the existing fulfillment section first.</p>}
   {(evidence?.deliveryConfirmations||[]).length>0&&<div className="sc-closeout-log"><strong>Delivery verification history</strong>
    {(evidence.deliveryConfirmations||[]).map(v=><p key={v.id}>{v.proof_type}: {v.proof_reference} · {shortDate(v.created_at)}</p>)}</div>}
   {editable&&<form className="sc-closeout-controls" onSubmit={prepareProof}>
    <label>Verification source<select value={proofType} onChange={e=>setProofType(e.target.value)}>
     <option value="carrier_delivery_record">Carrier proof-of-delivery record</option>
     <option value="customer_delivery_confirmation">Direct customer confirmation</option></select></label>
    <label>Actual evidence reference<input value={proofRef} maxLength="500" placeholder="Carrier POD reference, confirmation message ID" onChange={e=>setProofRef(e.target.value)}/></label>
    <label>Verification notes<textarea rows="2" maxLength="1500" value={proofNote} onChange={e=>setProofNote(e.target.value)}/></label>
    <button type="submit" disabled={busy||!shippingAllowed||proofRef.trim().length<5}>Record verified delivery</button>
   </form>}
  </section>
  <section className="sc-closeout-card">
   <h4>3. Customer notifications — reviewed and manually sent</h4>
   <p>No automatic messages are sent. A manager can prepare a message only when the relevant job evidence supports it, copy the approved text to an email application, and log that it was actually sent. Recipient addresses are entered deliberately, not guessed from order records.</p>
   {canNotify&&<div className="sc-closeout-controls">
    <label>Notification type<select value={kind} onChange={e=>{setKind(e.target.value);setSubject('');setMessageBody('');setSourceDraftId('');}}>
     {kinds.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Customer email<input type="email" autoComplete="email" placeholder="Verified client contact email"
     value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
    <button type="button" onClick={createDraftTemplate} disabled={!notifyAllowed[kind]}>Prepare message</button>
    <label>Subject<input value={subject} maxLength="240" onChange={e=>setSubject(e.target.value)}/></label>
    <label>Message<textarea rows="7" value={messageBody} maxLength="5000" onChange={e=>setMessageBody(e.target.value)}/></label>
    <button type="button" disabled={busy||!notifyAllowed[kind]||!validEmail(recipient)||subject.trim().length<5||messageBody.trim().length<10}
     onClick={saveDraft}>Save approved email draft (does not send)</button>
   </div>}
   <div className="sc-closeout-log"><h5>Customer communication history</h5>
    {!records.length&&<p>No messages have been drafted for this job.</p>}
    {drafts.map(d=><div className="sc-closeout-message" key={d.id}>
     <p><strong>{d.event_type.replaceAll('_',' ')}</strong> · {d.recipient_email} · {shortDate(d.created_at)}</p>
     <details><summary>Review exact message</summary><strong>{d.subject}</strong><pre>{d.message_body}</pre></details>
     {sent.has(d.id)?<strong>Manually sent — recorded</strong>:canNotify&&<div className="sc-closeout-actions">
      <button type="button" onClick={()=>copyDraft(d)}>Copy email to send</button>
      <button type="button" disabled={busy} onClick={()=>markManuallySent(d)}>Mark actually sent</button>
     </div>}
    </div>)}
   </div>
  </section>
  <p className="sc-closeout-note">This Closeout Center does not create postage, update carrier status, charge customers, change inventory, or complete a production job. The Production Board remains the final job-status authority.</p>
  {notice&&<p role="status" className="message">{notice}</p>}
 </section>;
}
