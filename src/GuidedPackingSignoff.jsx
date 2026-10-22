import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from './supabaseClient';
import {shouldSimulateWrites} from './lib/testingMode';
import JobTrainingSimulator from './JobTrainingSimulator';
import './GuidedPackingSignoff.css';

const terminalItem=new Set(['cancelled','canceled','void','voided','removed']);
const activeItem=item=>!terminalItem.has(String(item.status||'').toLowerCase());
const currentQuantity=source=>Number(source?.quantity||0);
const formatted=value=>value?new Date(value).toLocaleString():'—';
function errorMessage(e){return e?.message||'Could not save. Confirm job permissions and network connection.';}
function latestQcPass(qc){
 const sorted=[...(qc||[])].sort((a,b)=>
  new Date(b.qc_completed_at||b.created_at||0)-new Date(a.qc_completed_at||a.created_at||0));
 return sorted[0]?.passed===true;
}
function packingRows(items,packing){
 const mostRecent=new Map();
 for(const entry of [...(packing||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))){
  if(!mostRecent.has(Number(entry.job_item_id)))mostRecent.set(Number(entry.job_item_id),entry);
 }
 return (items||[]).filter(activeItem).map(item=>({
  ...item,latest:mostRecent.get(Number(item.id)),
  packed:Number(mostRecent.get(Number(item.id))?.packed_quantity||0),
  expected:currentQuantity(item),
 }));
}
export default function GuidedPackingSignoff({jobId,evidence,onRefresh,editable}){
 const [counts,setCounts]=useState({});
 const [notes,setNotes]=useState({});
 const [saving,setSaving]=useState('');
 const [alert,setAlert]=useState('');
 const [recipient,setRecipient]=useState('');
 const [relationship,setRelationship]=useState('');
 const [packageCount,setPackageCount]=useState('1');
 const [pickupNote,setPickupNote]=useState('');
 const [consent,setConsent]=useState(false);
 const [revision,setRevision]=useState({handoffId:'',version:'',approvalRef:'',filename:'',note:''});
 const rows=useMemo(()=>packingRows(evidence?.items,evidence?.packing),[evidence?.items,evidence?.packing]);
 const totalUnits=rows.reduce((n,r)=>n+r.expected,0);
 const packedUnits=rows.reduce((n,r)=>n+r.packed,0);
 const fullyPacked=rows.length>0&&rows.every(r=>r.packed===r.expected);
 const passed=latestQcPass(evidence?.qc);
 const acknowledged=Boolean(evidence?.pickup?.length);
 const existingReceipt=evidence?.pickup?.[0];
 const linked=evidence?.artworkLinks||[];
 const reviewed=evidence?.revisionChecks||[];

 async function perform(label,fn){
  setSaving(label);setAlert('');
  try{await fn();await onRefresh?.();setAlert(label+' recorded successfully. Original order, inventory and billing remain unchanged.');}
  catch(e){setAlert(errorMessage(e));}
  finally{setSaving('');}
 }
 function guardPractice(){
  if(shouldSimulateWrites())throw Error('Practice mode: this operation is not simulated. Use the fictional job exercise below; nothing was written.');
 }
 async function saveCount(row){
  const value=Number(counts[row.id]??row.packed);
  await perform('Packing count',async()=>{
   guardPractice();
   if(!Number.isSafeInteger(value)||value<0||value>row.expected)throw Error('Packed quantity must be an integer between 0 and '+row.expected+'.');
   if(!window.confirm('Physically verified '+value+' of '+row.expected+' unit(s) for item #'+row.id+'?'))return;
   const {data,error}=await supabase.auth.getUser();
   if(error||!data.user)throw Error('Sign in to record packing.');
   const {error:insertError}=await supabase.from('sc_job_packing_line_events').insert({
    job_id:jobId,job_item_id:row.id,packed_quantity:value,
    packaging_note:String(notes[row.id]||'').slice(0,1000),
    recorded_by:data.user.id,
   });
   if(insertError)throw insertError;
  });
 }
 async function recordPickup(event){
  event.preventDefault();
  await perform('Pickup acknowledgment',async()=>{
   guardPractice();
   if(!passed)throw Error('Official latest QC must pass first.');
   if(!fullyPacked)throw Error('Every active job line must have an exact verified packing count.');
   if(acknowledged)throw Error('This job already has a customer pickup acknowledgment.');
   if(recipient.trim().length<2||!consent)throw Error('The recipient must type their full name and agree to the receipt statement.');
   const packs=Number(packageCount);
   if(!Number.isSafeInteger(packs)||packs<1||packs>10000)throw Error('Package count must be 1 to 10,000.');
   if(!window.confirm('Is the recipient physically present and acknowledging actual collection of '+packs+' package(s)?'))return;
   const {error}=await supabase.rpc('sc_record_job_pickup_acknowledgment',{
    p_job_id:jobId,p_recipient_name:recipient.trim(),p_relationship:relationship.trim(),
    p_package_count:packs,p_note:pickupNote.trim(),p_consent:true,
   });
   if(error)throw error;
   setRecipient('');setRelationship('');setPickupNote('');setConsent(false);
  });
 }
 async function verifyArtwork(){
  await perform('Artwork version review',async()=>{
   guardPractice();
   const picked=linked.find(x=>x.handoff_id===revision.handoffId);
   if(!picked)throw Error('Link the source artwork handoff to this job first.');
   if(revision.version.trim().length<1||revision.approvalRef.trim().length<3)
     throw Error('Enter the exact artwork revision and a customer approval reference.');
   if(!window.confirm('Have you independently checked the CUSTOMER approval source and verified that this exact file revision is the one to manufacture?'))return;
   const {data,error}=await supabase.auth.getUser();
   if(error||!data.user)throw Error('Sign in before recording a revision check.');
   const {error:insertError}=await supabase.from('sc_job_artwork_revision_checks').insert({
    job_id:jobId,handoff_id:revision.handoffId,revision_label:revision.version.trim(),
    approval_reference:revision.approvalRef.trim(),production_filename:revision.filename.trim(),
    review_note:revision.note.trim(),reviewed_by:data.user.id,
   });
   if(insertError)throw insertError;
   setRevision({handoffId:'',version:'',approvalRef:'',filename:'',note:''});
  });
 }
 return <section className="sc-hub-pack-flow">
  <header><h4>Line-by-line packing, customer sign-off and artwork revisions</h4>
   <p>Inspect and record only what actually happened. Counts and acknowledgments are auditable evidence, not inventory adjustments or Woo/QuickBooks transactions.</p></header>

  <div className="sc-pack-section">
   <h5>1. Verify each order line before sealing bags</h5>
   <p>Verified units: <strong>{packedUnits} / {totalUnits}</strong>. Each new count supersedes earlier packing counts for that line; earlier records remain in the audit trail.</p>
   {rows.length?<div className="sc-pack-overflow"><table><thead><tr><th>Item</th><th>Ordered</th><th>Latest verified</th><th>Enter count</th><th>Action</th></tr></thead><tbody>
    {rows.map(row=><tr key={row.id}><td><strong>{row.ordered_product_name||row.item_name||row.sku||'Item #'+row.id}</strong>
     <small>{[row.selected_color,row.selected_size].filter(Boolean).join(' · ')}</small></td>
     <td>{row.expected}</td><td>{row.latest?row.packed+' · '+formatted(row.latest.created_at):'Not verified'}</td>
     <td><label>Count<input type="number" min="0" max={Math.max(0,row.expected)} step="1" value={counts[row.id]??row.packed}
       disabled={!editable||Boolean(saving)} onChange={e=>setCounts(p=>({...p,[row.id]:e.target.value}))}/></label>
       <label>Bag / pack note<input value={notes[row.id]||''} maxLength="1000" placeholder="Player, size, bag or box"
        disabled={!editable||Boolean(saving)} onChange={e=>setNotes(p=>({...p,[row.id]:e.target.value}))}/></label></td>
     <td><button type="button" disabled={!editable||Boolean(saving)}
       onClick={()=>saveCount(row)}>Verify line</button></td></tr>)}
   </tbody></table></div>:<p>No active items were loaded. Verify the source job before recording fulfillment.</p>}
   {!fullyPacked&&<p className="sc-pack-warning">A pickup signature cannot be recorded until all active lines are verified to exactly match the ordered quantities.</p>}
  </div>

  <div className="sc-pack-section">
   <h5>2. Verify the exact approved artwork revision</h5>
   <p>Revision checks are staff attestations referencing real customer approval. They do not generate or change the underlying customer approval.</p>
   {reviewed.length?<ul>{reviewed.map(x=><li key={x.id}>Revision <strong>{x.revision_label}</strong> · Approval reference: {x.approval_reference}
    {x.production_filename?' · '+x.production_filename:''} · {formatted(x.reviewed_at)}</li>)}</ul>:<p>No explicit artwork revision check recorded.</p>}
   {editable&&linked.length>0&&<div className="sc-pack-edit">
    <label>Approved artwork handoff<select value={revision.handoffId} onChange={e=>setRevision(p=>({...p,handoffId:e.target.value}))}>
      <option value="">Select linked handoff</option>
      {linked.map(l=><option value={l.handoff_id} key={l.id}>{l.handoff?.artwork_title||l.handoff_id}</option>)}
    </select></label>
    <label>Revision or version number<input value={revision.version} placeholder="v3 approved 10/21" onChange={e=>setRevision(p=>({...p,version:e.target.value}))}/></label>
    <label>Customer approval reference<input value={revision.approvalRef} placeholder="Approved proof or email record ID" onChange={e=>setRevision(p=>({...p,approvalRef:e.target.value}))}/></label>
    <label>Production file name<input value={revision.filename} placeholder="client-logo-final-v3.png" onChange={e=>setRevision(p=>({...p,filename:e.target.value}))}/></label>
    <label>Production review note<textarea rows="2" value={revision.note} onChange={e=>setRevision(p=>({...p,note:e.target.value}))}/></label>
    <button type="button" disabled={Boolean(saving)||!revision.handoffId} onClick={verifyArtwork}>Record revision check</button>
   </div>}
   <Link to="/approval-automation">Review the original customer approval record →</Link>
  </div>

  <div className="sc-pack-section">
   <h5>3. Customer pickup acknowledgment (typed signature)</h5>
   <p>Latest official QC: <strong>{passed?'Passed':'Not passed'}</strong>. Packing: <strong>{fullyPacked?'Complete':'Incomplete'}</strong>.
    A receipt records an actual in-person customer collection with a typed-name signature; it does not automatically close the job.</p>
   {acknowledged?<p className="sc-pack-success"><strong>Pickup signed:</strong> {existingReceipt.recipient_name} · {existingReceipt.package_count} package(s) · {formatted(existingReceipt.signed_at)}. This receipt is immutable.</p>:null}
   {editable&&!acknowledged&&<form className="sc-pack-edit" onSubmit={recordPickup}>
    <label>Recipient full name (typed signature)<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Customer or authorized recipient" autoComplete="name"/></label>
    <label>Recipient relationship / role<input value={relationship} onChange={e=>setRelationship(e.target.value)} placeholder="Coach, parent, client representative"/></label>
    <label>Number of packages handed over<input type="number" min="1" max="10000" value={packageCount} onChange={e=>setPackageCount(e.target.value)}/></label>
    <label>Pickup notes<textarea rows="2" maxLength="1000" value={pickupNote} onChange={e=>setPickupNote(e.target.value)} placeholder="Time, location, item exceptions"/></label>
    <label className="sc-pack-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
     <span>The recipient confirms: "I acknowledge receiving the stated number of packages for this Skilled Crafting job." The typed full name represents this pickup acknowledgment.</span></label>
    <button type="submit" disabled={Boolean(saving)||!passed||!fullyPacked||recipient.trim().length<2||!consent}>Record customer pickup signature</button>
   </form>}
   <p><small>Shipment is recorded using the existing fulfillment workflow; this signature screen is for physical customer pickup, not delivery carrier proof.</small></p>
  </div>

  <JobTrainingSimulator />
  {alert&&<p role="status" className="message">{alert}</p>}
 </section>;
}
