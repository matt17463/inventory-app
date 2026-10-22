import {useContext,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {boardColumnForRow,listProductionStatusBoard} from './lib/productionStatusApi';
import {loadGuidedJobEvidence,addGuidedJobNote} from './lib/guidedJobApi';
import {dueRisk,jobIdentity,deriveGuidedProgress,GUIDED_STEPS} from './lib/guidedJobProgress';
import './WorkHub.css';
import GuidedJobPhaseTwo from './GuidedJobPhaseTwo';
import GuidedPackingSignoff from './GuidedPackingSignoff';
import JobCloseoutCenter from './JobCloseoutCenter';
import CarrierShippingLabels from './CarrierShippingLabels';

const STAGES=[
 {id:'new_order',label:'Review order'},
 {id:'needs_attention',label:'Resolve blockers'},
 {id:'on_hold',label:'On hold'},
 {id:'ready_to_produce',label:'Production ready'},
 {id:'in_production',label:'In production'},
 {id:'qc',label:'QC'},
 {id:'ready_to_ship',label:'Ready for pickup'},
 {id:'completed',label:'Completed'},
];
const stepLabels={verified:'Recorded',linked:'Linked / check',attention:'Action required',review:'Review',unknown:'Not available',not_applicable:'N/A'};
const formatDate=v=>{if(!v)return 'No due date';const date=/^\d{4}-\d{2}-\d{2}$/.test(v)?new Date(v+'T12:00:00'):new Date(v);return Number.isNaN(date.getTime())?String(v):date.toLocaleDateString();};
const labelJob=r=>r?.woo_order_number?'Woo #'+r.woo_order_number:
  r?.woocommerce_order_id?'Woo #'+r.woocommerce_order_id:
  r?.job_id?'Job #'+r.job_id:'Production job';
const printText=v=>String(v||'').replaceAll('_',' ');

function stageCount(rows){
 return rows.reduce((v,r)=>{const s=boardColumnForRow(r);v[s]=(v[s]||0)+1;return v;},{});
}
function attentionSort(a,b){
 const priority=r=>{
  const s=boardColumnForRow(r);let n=0;
  if(s==='needs_attention'||s==='on_hold'||(Array.isArray(r.blocking_issues)&&r.blocking_issues.length))n+=5;
  const risk=dueRisk(r.due_date||r.order_due_date);
  if(risk.kind==='late')n+=4;else if(risk.kind==='soon')n+=2;
  return n;
 };
 return priority(b)-priority(a);
}

export default function WorkHub(){
 const access=useContext(EmployeeAccessContext);
 const editable=['admin','manager','operator'].includes(access?.role);
 const [params,setParams]=useSearchParams();
 const [rows,setRows]=useState([]);
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('active');
 const selectedId=params.get('job')||'';
 const [boardBusy,setBoardBusy]=useState(true);
 const [boardError,setBoardError]=useState('');
 const [detail,setDetail]=useState(null);
 const [detailLoading,setDetailLoading]=useState(false);
 const [detailError,setDetailError]=useState('');
 const [noteType,setNoteType]=useState('next_action');
 const [note,setNote]=useState('');
 const [savingNote,setSavingNote]=useState(false);
 const [noteMessage,setNoteMessage]=useState('');
 const [openAll,setOpenAll]=useState(false);

 async function reloadBoard(){
  setBoardBusy(true);setBoardError('');
  try{setRows((await listProductionStatusBoard({limit:400}))||[]);}
  catch(err){setBoardError(err.message||'Could not load production jobs.');}
  finally{setBoardBusy(false);}
 }
 useEffect(()=>{reloadBoard();},[]);

 const counts=useMemo(()=>stageCount(rows),[rows]);
 const visible=useMemo(()=>rows.filter(row=>{
  const step=boardColumnForRow(row);
  if(filter==='active'&&['completed','cancelled'].includes(step))return false;
  if(filter==='attention'){
   const risk=dueRisk(row.due_date||row.order_due_date).kind;
   if(['completed','cancelled'].includes(step))return false;
   if(!['needs_attention','on_hold'].includes(step)&&!row.blocking_issues?.length&&!['late','soon'].includes(risk))return false;
  }
  if(!['active','all','attention'].includes(filter)&&step!==filter)return false;
  const words=[row.customer_name,row.job_name,row.woo_order_number,row.woocommerce_order_id,
   row.job_id,row.production_status,row.woo_status,row.order_source].join(' ').toLowerCase();
  return words.includes(search.trim().toLowerCase());
 }).sort(attentionSort),[rows,filter,search]);
 const chosen=visible.find(row=>String(jobIdentity(row)??'')===selectedId)||visible[0]||null;
 const currentId=jobIdentity(chosen);
 useEffect(()=>{
  if(!currentId){setDetail(null);setDetailError('');return;}
  let alive=true;
  setDetailLoading(true);setDetail(null);setDetailError('');setNoteMessage('');
  loadGuidedJobEvidence(currentId).then(data=>{if(alive)setDetail(data);})
   .catch(err=>{if(alive)setDetailError(err.message||'Job details could not be loaded.');})
   .finally(()=>{if(alive)setDetailLoading(false);});
  return()=>{alive=false;};
 },[currentId]);
 const progress=useMemo(()=>chosen&&detail?deriveGuidedProgress(chosen,detail):null,[chosen,detail]);
 const steps=progress?.steps||GUIDED_STEPS;
 const issues=Array.isArray(chosen?.blocking_issues)?chosen.blocking_issues:[];
 const unknowns=detail?.unavailable||{};
 const stepCounts=steps.reduce((count,s)=>{if(s.state==='verified')count++;return count;},0);
 function choose(row){
  const id=jobIdentity(row);if(!id)return;
  const next=new URLSearchParams(params);next.set('job',String(id));setParams(next,{replace:true});
 }
 async function refreshSelected(){
  if(!currentId)return;
  setDetailLoading(true);setDetailError('');
  try{setDetail(await loadGuidedJobEvidence(currentId));}
  catch(e){setDetailError(e.message||'Could not refresh job details.');}
  finally{setDetailLoading(false);}
 }
 async function saveHandoff(e){
  e.preventDefault();if(!currentId)return;
  setSavingNote(true);setNoteMessage('');
  try{
   await addGuidedJobNote({jobId:currentId,kind:noteType,note});
   setNote('');await refreshSelected();
   setNoteMessage('Handoff saved. It did not change production status, inventory or customer billing.');
  }catch(err){setNoteMessage(err.message||'Could not save handoff.');}
  finally{setSavingNote(false);}
 }
 const stage=chosen?boardColumnForRow(chosen):'';
 return <main className="page sc-work-hub">
  <header className="page-header">
   <div><p className="eyebrow">Work Hub · Owner-first guided operations</p>
    <h1>One job, one clear next step</h1>
    <p>Follow the same customer job from order to pickup. Evidence is read from the existing systems; specialist pages remain authoritative for approvals, stock and status changes.</p>
   </div>
   <button type="button" onClick={async()=>{await reloadBoard();await refreshSelected();}} disabled={boardBusy||detailLoading}>
    {boardBusy||detailLoading?'Refreshing…':'Refresh work'}
   </button>
  </header>
  <section className="card elevated-card sc-hub-entry">
   <h2>Start new customer work</h2>
   <div className="sc-hub-entry-grid">
    <Link to="/marketing"><strong>Prospect / customer</strong><span>Develop the lead, quote and approve artwork</span></Link>
    <Link to="/team-stores"><strong>School or group order</strong><span>Recurring Woo store or QuickBooks invoice request</span></Link>
    <Link to="/client-orders"><strong>Client order form</strong><span>Review one-time orders and prepare invoices</span></Link>
    <Link to="/artwork-preflight"><strong>Prepare DTF artwork</strong><span>Check print dimensions, transparency and storage</span></Link>
   </div>
  </section>
  <section className="card elevated-card">
   <div className="sc-hub-heading-row"><div>
    <h2>Active production queue</h2><p>Blocked and urgent jobs appear first. Selecting a job opens the linked evidence and next action.</p>
   </div><span>{rows.length} jobs loaded</span></div>
   <div className="sc-hub-filters">
    <label>Find customer, Woo order or job<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer, order # or item"/></label>
    <label>Filter jobs<select value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="active">All active jobs</option>
     <option value="attention">Needs attention / due soon</option>
     <option value="all">All including completed</option>
     {STAGES.map(s=><option key={s.id} value={s.id}>{s.label} ({counts[s.id]||0})</option>)}
    </select></label>
   </div>
   {boardError&&<p role="alert" className="message">{boardError} <Link to="/production-board">Open Production Board →</Link></p>}
   <div className="sc-hub-layout">
    <div className="sc-hub-list" aria-label="Select production job">
     {visible.map(row=>{
      const id=jobIdentity(row),s=boardColumnForRow(row),risk=dueRisk(row.due_date||row.order_due_date);
      const blocked=(s==='needs_attention'||s==='on_hold'||Boolean(row.blocking_issues?.length));
      const selected=chosen===row;
      return <button type="button" key={id||row.woocommerce_order_id||String(row.id)}
       onClick={()=>choose(row)} aria-pressed={selected} disabled={!id}
       className={'sc-hub-job'+(selected?' selected':'')}>
       <span className="sc-hub-job-name"><strong>{row.customer_name||row.job_name||labelJob(row)}</strong>
        <small>{labelJob(row)} · {printText(s)}</small></span>
       <span className="sc-hub-list-badges">
        {(blocked||['late','soon'].includes(risk.kind))&&<span className={'sc-hub-urgency '+(blocked?'blocked':risk.kind)}>
         {blocked?'Blocker':risk.label}</span>}
        <small>Due {formatDate(row.due_date||row.order_due_date)}</small>
       </span>
      </button>;
     })}
     {!boardBusy&&!visible.length&&<p>No matching jobs. Try another filter or start a new order above.</p>}
    </div>
    <div className="sc-hub-job-details">
     {chosen&&currentId?<div>
      <div className="sc-hub-selected-head"><div>
       <p className="eyebrow">Job workspace</p><h3>{chosen.customer_name||chosen.job_name||labelJob(chosen)}</h3>
       <p>{labelJob(chosen)} · Due {formatDate(chosen.due_date||chosen.order_due_date)} · {printText(stage)}</p>
      </div><button type="button" disabled={detailLoading} onClick={refreshSelected}>{detailLoading?'Loading…':'Refresh evidence'}</button></div>
      {issues.length>0&&<div className="sc-hub-blockers"><strong>Production Board blockers</strong>
       <ul>{issues.map((v,i)=><li key={i}>{typeof v==='string'?v:v?.message||v?.reason||'Review Production Board blocker'}</li>)}</ul>
       <Link to="/exception-center">Open Exception Center →</Link></div>}
      {detailLoading&&<p role="status">Reading order, artwork, inventory, traveler and QC records…</p>}
      {detailError&&<p role="alert" className="message">{detailError} <Link to="/production-board">Open Production Board</Link></p>}
      {progress&&<>
       <div className={'sc-hub-priority '+progress.priority.kind}>
        <p className="eyebrow">Recommended next step · {stepCounts} documented checkpoints</p>
        <h4>{progress.priority.title}</h4>
        <p>{progress.priority.reason}</p>
        <Link className="sc-hub-primary-action" to={progress.priority.href}>Open the correct tool →</Link>
       </div>
       <div className="sc-hub-meta">
        <span>{progress.indicators.itemCount} order lines</span>
        <span>{progress.indicators.travelers} QR travelers</span>
        <span>{progress.indicators.activeReservations} reservation records</span>
        <span>QC: {progress.indicators.qcPassed?'Pass recorded':'Not confirmed here'}</span>
        <span>Photos: {detail.photos?.length||0} linked</span>
       </div>
       {Object.keys(unknowns).length>0&&<div className="sc-hub-unknowns">
        <strong>Some records could not be verified</strong><p>This workspace will not assume they are approved or complete.</p>
        <ul>{Object.entries(unknowns).map(([key,msg])=><li key={key}>{key}: {msg}</li>)}</ul>
       </div>}
       <h4>Job progress — based on recorded evidence</h4>
       <div className="sc-hub-checkpoints">
        {steps.map((s,i)=><div className={'sc-hub-checkpoint '+s.state} key={s.id}>
         <div className="sc-hub-checkpoint-number">{i+1}</div>
         <div><div className="sc-hub-checkpoint-heading"><strong>{s.title}</strong>
          <span className={'sc-hub-proof '+s.state}>{stepLabels[s.state]||'Review'}</span></div>
          <p>{s.reason}</p><Link to={s.href}>Open {s.title.toLowerCase()} →</Link>
         </div>
        </div>)}
       </div>
       <button type="button" className="sc-hub-minor" onClick={()=>setOpenAll(v=>!v)}>
        {openAll?'Hide':'Show'} job line and stock detail</button>
       {openAll&&<div className="sc-hub-evidence-grid">
        <div><h5>Line items</h5>{detail.items.length?detail.items.map(item=><p key={item.id}>
         <strong>{item.ordered_product_name||item.item_name||item.order_sku||'Item #'+item.id}</strong>
         {' · '+(item.selected_color||'')+' '+(item.selected_size||'')+' · Qty '+item.quantity}
         {item.inventory_required!==false&&!item.blank_product_id?' · Blank mapping needed':''}
        </p>):<p>No visible item details.</p>}</div>
        <div><h5>Stock reservations</h5>{detail.reservations.length?detail.reservations.map(r=><p key={r.id}>
         Item #{r.job_item_id||'—'} · {r.status||'Unknown state'} · Reserved {r.quantity_reserved??r.quantity??'—'}
        </p>):<p>No reservation records found. Confirm with Purchasing.</p>}</div>
       </div>}
       <p><Link to={'/production-photo-proof?job='+currentId}>View / upload photos for this job →</Link></p>
       <GuidedJobPhaseTwo key={currentId} jobId={currentId} evidence={detail} editable={editable} onRefresh={refreshSelected}/>
       <GuidedPackingSignoff key={'packing-'+currentId} jobId={currentId} evidence={detail} editable={editable} onRefresh={refreshSelected}/>
       <JobCloseoutCenter key={'closeout-'+currentId} evidence={detail} editable={editable} canNotify={['admin','manager'].includes(access?.role)} onRefresh={refreshSelected}/>
       <CarrierShippingLabels key={'carrier-'+currentId} evidence={detail} canManage={['admin','manager'].includes(access?.role)}/>
       <section className="sc-hub-handoff">
        <div className="sc-hub-handoff-title"><h4>Owner / family handoff notes</h4>
         <small>Logged guidance only; it does not complete steps or alter production state.</small></div>
        {editable&&<form onSubmit={saveHandoff} className="sc-hub-handoff-form">
         <label>What kind of handoff?<select value={noteType} onChange={e=>setNoteType(e.target.value)}>
          <option value="next_action">Next action</option>
          <option value="customer_update">Customer update</option>
          <option value="production_note">Production instruction</option>
          <option value="blocker">Blocker / hold</option>
         </select></label>
         <label>Instructions for whoever picks this up<textarea rows="3" maxLength={2000} value={note}
          placeholder="What needs to happen next, and what to check?" onChange={e=>setNote(e.target.value)}/></label>
         <button type="submit" disabled={savingNote||note.trim().length<2}>{savingNote?'Saving…':'Save handoff note'}</button>
        </form>}
        {noteMessage&&<p role="status" className="message">{noteMessage}</p>}
        <div className="sc-hub-note-list">{detail.notes.length?detail.notes.map(n=><div key={n.id}>
          <small>{printText(n.kind)} · {new Date(n.created_at).toLocaleString()}</small><p>{n.note}</p>
         </div>):<p>No handoff notes recorded for this job.</p>}</div>
       </section>
       <p className="sc-hub-data-disclaimer">Evidence labels distinguish recorded information from a final approval. Always use the linked authoritative page to verify customer promises, inventory availability, QC and fulfillment. QR travelers do not automatically complete production.</p>
      </>}
     </div>:<p>Choose an existing production job to see its next action and handoff instructions.</p>}
    </div>
   </div>
  </section>
 </main>;
}
