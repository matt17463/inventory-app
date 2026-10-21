import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { shouldSimulateWrites } from './lib/testingMode';
import { supabase } from './supabaseClient';
import './UVStudio.css';

function newProject(){return{
 id:null,title:'New UV Patch',material_type:'leather',project_type:'patch',status:'draft',
 customer_reference:'',order_reference:'',artwork_url:'',proof_url:'',material_recipe_id:'',
 quantity:1,unit_cost:0,selling_price:0,artwork_config:{},production_config:{},
};}
const fmt = n=>Number.isFinite(Number(n))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):'—';
function inputData(record){
 const fields=['title','material_type','project_type','customer_reference','order_reference','artwork_url','proof_url'];
 return Object.fromEntries(fields.map(k=>[k,record[k]||'']));
}
function csvLine(values){return values.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');}
export default function UVStudio(){
 const access=useContext(EmployeeAccessContext);
 const admin=['admin','manager'].includes(access?.role);
 const canWrite=['admin','manager','operator'].includes(access?.role);
 const iframe=useRef(null);
 const waiting=useRef(null);
 const [project,setProject]=useState(newProject);
 const [projects,setProjects]=useState([]);
 const [recipes,setRecipes]=useState([]);
 const [events,setEvents]=useState([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [eventKind,setEventKind]=useState('qc');
 const [eventOutcome,setEventOutcome]=useState('pending');
 const [eventDetail,setEventDetail]=useState('');
 const [showLibrary,setShowLibrary]=useState(true);
 const update=(key,value)=>setProject(p=>({...p,[key]:value}));
 const load=useCallback(async()=>{
  const [pr,re]=await Promise.all([
   supabase.from('sc_uv_projects').select('*').order('updated_at',{ascending:false}).limit(200),
   supabase.from('sc_material_recipes').select('id,machine_type,operation,material_name,machine_model,status,settings').eq('machine_type','xtool_omni').eq('status','approved').limit(300)
  ]);
  if(pr.error)throw pr.error;if(re.error)throw re.error;
  setProjects(pr.data||[]);setRecipes(re.data||[]);
 },[]);
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[load]);
 useEffect(()=>{
  function onMessage(event){
   if(event.origin!==window.location.origin||event.source!==iframe.current?.contentWindow)return;
   if(event.data?.requestId!==waiting.current?.id)return;
   if(event.data?.type==='SC_UV_SNAPSHOT'){
    waiting.current.resolve(event.data);waiting.current=null;
   } else if(event.data?.type==='SC_UV_SNAPSHOT_ERROR'){
    waiting.current.reject(new Error(event.data.message||'Cannot read UV editor'));waiting.current=null;
   }
  }
  window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
 },[]);
 const requestSnapshot=()=>new Promise((resolve,reject)=>{
  if(!iframe.current?.contentWindow){reject(Error('UV designer is not loaded'));return;}
  const id='snapshot-'+Date.now();
  const timeout=window.setTimeout(()=>{
   if(waiting.current?.id===id){waiting.current=null;reject(Error('UV designer did not respond. Load the designer and try again.'));}
  },6000);
  waiting.current={id,resolve:value=>{window.clearTimeout(timeout);resolve(value);},reject:e=>{window.clearTimeout(timeout);reject(e);}};
  iframe.current.contentWindow.postMessage({type:'SC_UV_REQUEST_SNAPSHOT',requestId:id},window.location.origin);
 });
 async function save(){
  if(!canWrite)return setMessage('Read-only employee access.');
  if(!project.title.trim())return setMessage('Project title is required.');
  setBusy(true);
  try{
   const snapshot=await requestSnapshot();
   const payload={
    ...inputData(project),
    title:project.title.trim(),
    material_recipe_id:project.material_recipe_id||null,
    quantity:Number(project.quantity)||1,
    unit_cost:Number(project.unit_cost)||0,
    selling_price:Number(project.selling_price)||0,
    artwork_config:snapshot.data,
    production_config:{
     ...(project.production_config||{}),
     snapshot_note:snapshot.warning,
     local_source_artwork:snapshot.hasSourceArtwork,
     editor_version:'v0.3 integrated',
     calibration_records_local:snapshot.calibrationRecordsCount
    },
    updated_at:new Date().toISOString()
   };
   if(payload.quantity<1||payload.quantity>10000||payload.unit_cost<0||payload.selling_price<0)throw Error('Invalid quantity or price.');
   if(shouldSimulateWrites()){setMessage('Training preview: project validated but not saved.');return;}
   let response;
   if(project.id){
    const permitted=admin||['draft','proof'].includes(project.status);
    if(!permitted)throw Error('Approved projects require a manager to revise.');
    response=await supabase.from('sc_uv_projects').update({...payload,status:'draft',version:(project.version||1)+1,approved_at:null,approved_by:null}).eq('id',project.id).select().single();
   }else response=await supabase.from('sc_uv_projects').insert({...payload,status:'draft'}).select().single();
   if(response.error)throw response.error;
   setProject({...response.data,material_recipe_id:response.data.material_recipe_id||''});
   await load();
   setMessage('Project metadata saved. Production PNGs and original image are NOT stored in cloud; export them from the designer and attach to your Artwork Vault.');
  }catch(e){setMessage(e.message||'Could not save project');}finally{setBusy(false);}
 }
 async function loadEvents(id){
  const {data,error}=await supabase.from('sc_uv_project_events').select('*').eq('project_id',id).order('recorded_at',{ascending:false}).limit(100);
  if(error)setMessage(error.message);else setEvents(data||[]);
 }
 function openProject(item){
  setProject({...item,material_recipe_id:item.material_recipe_id||''});
  loadEvents(item.id);
  setMessage('Project metadata opened. For now, import the original artwork into the embedded designer again; embedded canvas files are local.');
  setShowLibrary(false);
 }
 async function writeEvent(){
  if(!project.id)return setMessage('Save the project first.');
  if(!eventDetail.trim())return setMessage('Enter an inspection observation.');
  setBusy(true);
  try{
   if(shouldSimulateWrites()){setMessage('Training preview: QC event not written.');return;}
   const {error}=await supabase.from('sc_uv_project_events').insert({
    project_id:project.id,kind:eventKind,outcome:eventOutcome,detail:eventDetail.trim(),
    metadata:{material_type:project.material_type,recipe_id:project.material_recipe_id||null}
   });
   if(error)throw error;
   setEventDetail('');await loadEvents(project.id);setMessage('Inspection/production event recorded.');
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 async function setStatus(status){
  if(!admin||!project.id)return;
  if(status==='approved'&&(!project.material_recipe_id||!project.artwork_url.trim()||!project.proof_url.trim())){
   return setMessage('Approval requires an approved material recipe plus source artwork and an approved customer proof stored in the Artwork Vault.');
  }
  if(shouldSimulateWrites())return setMessage('Training mode: status unchanged.');
  setBusy(true);
  try{
   const patch={status,updated_at:new Date().toISOString(),
    approved_at:status==='approved'?new Date().toISOString():null,
    approved_by:status==='approved'?access?.user?.id||null:null};
   if(status==='approved'&&!patch.approved_by){
    const {data}=await supabase.auth.getUser();patch.approved_by=data?.user?.id||null;
   }
   const {data,error}=await supabase.from('sc_uv_projects').update(patch).eq('id',project.id).select().single();
   if(error)throw error;setProject({...data,material_recipe_id:data.material_recipe_id||''});await load();
   setMessage('Project status updated; physical production still requires the xTool Studio operator checklist and QC.');
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 const total=Number(project.unit_cost||0)*Number(project.quantity||1);
 const revenue=Number(project.selling_price||0)*Number(project.quantity||1);
 const gross=revenue-total;
 function exportJobCard(){
  const rows=[
   ['Skilled Crafting UV job card',''],['Title',project.title],['Customer',project.customer_reference],
   ['Order',project.order_reference],['Material',project.material_type],['Source artwork',project.artwork_url],
   ['Approved recipe',project.material_recipe_id],['Quantity',project.quantity],
   ['Unit cost',project.unit_cost],['Unit price',project.selling_price],['Status',project.status],
   ['UV Studio editor settings (relative/intended only)',JSON.stringify(project.artwork_config||{})],
   ['Production warning','Final mask and ink control happens in xTool Studio. Verify printed coupon and registration before batch production.']
  ];
  const blob=new Blob([rows.map(row=>csvLine(row)).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='uv-job-'+(project.id||'draft')+'.csv';a.click();window.setTimeout(()=>URL.revokeObjectURL(u),2500);
 }
 return <main className="page sc-uv-app">
  <header className="page-header"><div><p className="eyebrow">SKILLED CRAFTING / DIMENSIONAL UV PREPRESS</p><h1>UV Studio</h1>
    <p>Embroidery simulation, relief maps, patch sheets, cutline artwork, calibration and production job records.</p>
    <p className="sc-uv-disclaimer">The embedded editor is a design tool, not an Omni RIP. xTool Studio controls physical ink passes and texture height.</p></div>
    <div className="sc-uv-buttons"><button className="secondary-button" onClick={()=>setShowLibrary(!showLibrary)}>Saved projects ({projects.length})</button><Link className="secondary-button" to="/material-settings">Material recipes</Link><Link className="secondary-button" to="/artwork-requests">Artwork requests</Link></div></header>
  {!!message&&<p className="sc-uv-notice" role="status">{message}</p>}
  {showLibrary&&<section className="card sc-uv-library"><h2>UV project library</h2>
    <div className="sc-uv-buttons"><button className="primary-button" onClick={()=>{setProject(newProject());setEvents([]);setShowLibrary(false);}}>Start new project</button>
    <button className="secondary-button" onClick={()=>load().catch(e=>setMessage(e.message))}>Refresh</button></div>
    <div className="sc-uv-projects">{projects.map(x=><button key={x.id} className="sc-uv-project" onClick={()=>openProject(x)}><strong>{x.title}</strong>
      <span>{x.material_type} · {x.quantity} item(s) · {x.status}</span><small>{x.customer_reference||'No customer linked'}</small></button>)}
    {!projects.length&&<p>No saved UV projects yet. Start a new project to create a production record.</p>}</div></section>}
  <section className="card sc-uv-job"><h2>Job and pricing</h2><div className="sc-uv-fields">
    {[['title','Job title'],['customer_reference','Customer / club'],['order_reference','Woo / manual order reference'],
      ['artwork_url','Artwork Vault source URL'],['proof_url','Approved customer proof URL']].map(([id,label])=>
      <label key={id}>{label}<input value={project[id]||''} onChange={e=>update(id,e.target.value)}/></label>)}
    <label>Material<select value={project.material_type} onChange={e=>update('material_type',e.target.value)}>
      {['leather','synthetic','transfer_film','metal','other'].map(x=><option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></label>
    <label>Product type<select value={project.project_type} onChange={e=>update('project_type',e.target.value)}>
      {['patch','transfer','metal_plate','other'].map(x=><option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></label>
    <label>Approved Omni recipe<select value={project.material_recipe_id||''} onChange={e=>update('material_recipe_id',e.target.value)}>
      <option value="">No approved recipe selected</option>{recipes.map(x=><option key={x.id} value={x.id}>{x.material_name} · {x.machine_model} · {x.operation}</option>)}</select></label>
    <label>Quantity<input type="number" min="1" max="10000" value={project.quantity} onChange={e=>update('quantity',e.target.value)}/></label>
    <label>Cost per item ($)<input type="number" step="0.01" min="0" value={project.unit_cost} onChange={e=>update('unit_cost',e.target.value)}/></label>
    <label>Selling price per item ($)<input type="number" step="0.01" min="0" value={project.selling_price} onChange={e=>update('selling_price',e.target.value)}/></label>
  </div>
  <div className="sc-uv-costs"><span>Estimated batch cost <strong>{fmt(total)}</strong></span><span>Revenue <strong>{fmt(revenue)}</strong></span><span>Gross contribution (before overhead) <strong>{fmt(gross)}</strong></span></div>
  <div className="sc-uv-buttons"><button className="primary-button" disabled={busy||!canWrite} onClick={save}>Save project metadata from editor</button>
    <button className="secondary-button" onClick={exportJobCard}>Export job card CSV</button>
    {admin&&project.id&&<><button className="secondary-button" onClick={()=>setStatus('proof')} disabled={busy}>Request proof</button>
      <button className="secondary-button" onClick={()=>setStatus('approved')} disabled={busy||project.status==='approved'}>Approve for production</button></>}</div>
  <p className="sc-uv-disclaimer">Saving records design settings only. Re-import your original logo when reopening until Artwork Vault/R2 binary-file sync is implemented. Keep exported 300-DPI print files with the job.</p>
  </section>
  <section className="sc-uv-designer card"><div className="sc-uv-frame-head"><h2>Faux embroidery & UV texture editor</h2><span>Full prepress tools · version 0.3</span></div>
    <iframe ref={iframe} src="/uv-studio/index.html" title="Skilled Crafting UV Studio advanced editor" loading="eager" allow="clipboard-write"/></section>
  <section className="card sc-uv-qc"><h2>Production events & quality control</h2>
    <p>Record a material test, print inspection, customer proof, reprint, or QC failure. Confirm machine recipe and physical print before fulfillment.</p>
    <div className="sc-uv-fields">
      <label>Event type<select value={eventKind} onChange={e=>setEventKind(e.target.value)}>{['qc','test_print','proof','approval','reprint','note'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Outcome<select value={eventOutcome} onChange={e=>setEventOutcome(e.target.value)}>{['pending','pass','fail','approved','rejected'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="sc-uv-event-notes">Observation / substrate lot / operator / actual print result<textarea value={eventDetail} onChange={e=>setEventDetail(e.target.value)} rows={3}/></label>
    </div><button className="primary-button" disabled={busy||!canWrite||!project.id} onClick={writeEvent}>Save production event</button>
    <div className="sc-uv-events">{events.map(x=><article key={x.id}><strong>{x.kind}: {x.outcome}</strong> · {new Date(x.recorded_at).toLocaleString()}<p>{x.detail}</p></article>)}</div>
  </section>
 </main>;
}
