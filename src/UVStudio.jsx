import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { shouldSimulateWrites } from './lib/testingMode';
import { supabase } from './supabaseClient';
import { listUvAssets, uploadUvAsset, readUvEditable, signedUvAsset } from './lib/uvAssets';
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
 const [assets,setAssets]=useState([]);
 const [jobs,setJobs]=useState([]);
 const [customers,setCustomers]=useState([]);
 const [artworkRequests,setArtworkRequests]=useState([]);
 const [blankProducts,setBlankProducts]=useState([]);
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
  const [j,cu,ar,bp]=await Promise.all([
   supabase.from('jobs').select('id,job_name,customer_name,woocommerce_order_id,manual_order_id,status').order('created_at',{ascending:false}).limit(350),
   supabase.from('customers').select('id,name').order('name').limit(1000),
   supabase.from('sc_artwork_system_requests').select('id,organization,customer_name,graphic_text,status').order('created_at',{ascending:false}).limit(150),
   supabase.from('blank_products').select('id,name,unit_cost').order('name').limit(800)
  ]);
  if(!j.error)setJobs(j.data||[]);
  if(!cu.error)setCustomers(cu.data||[]);
  if(!ar.error)setArtworkRequests(ar.data||[]);
  if(!bp.error)setBlankProducts(bp.data||[]);
 },[]);
 useEffect(()=>{load().catch(e=>setMessage(e.message));},[load]);
 useEffect(()=>{
  function onMessage(event){
   if(event.origin!==window.location.origin||event.source!==iframe.current?.contentWindow)return;
   if(event.data?.requestId!==waiting.current?.id)return;
   if(['SC_UV_EXPORT_RESULT','SC_UV_IMPORT_ACCEPTED'].includes(event.data?.type)){
    waiting.current.resolve(event.data);waiting.current=null;
   } else if(event.data?.type==='SC_UV_EXPORT_ERROR'){
    waiting.current.reject(new Error(event.data.message||'UV export failed'));waiting.current=null;
   } else if(event.data?.type==='SC_UV_SNAPSHOT'){
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

 const editorRequest=(type,contents)=>new Promise((resolve,reject)=>{
  if(!iframe.current?.contentWindow){reject(Error('UV designer is not loaded'));return;}
  const id='uv-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  const timeout=window.setTimeout(()=>{if(waiting.current?.id===id){waiting.current=null;reject(Error('UV editor response timed out'));}},50000);
  waiting.current={id,resolve:v=>{window.clearTimeout(timeout);resolve(v);},reject:e=>{window.clearTimeout(timeout);reject(e);}};
  iframe.current.contentWindow.postMessage({type,requestId:id,...(contents?{contents}: {})},window.location.origin);
 });
 const refreshAssets=async(id)=>{
  if(!id){setAssets([]);return [];}
  const list=await listUvAssets(id);setAssets(list);return list;
 };
 async function persistArtwork(id,kind='SC_UV_EXPORT_EDITABLE'){
  const result=await editorRequest(kind);
  const blob=result.buffer?new Blob([result.buffer],{type:result.mime_type}):
    new Blob([result.contents],{type:result.mime_type});
  const uploaded=await uploadUvAsset(id,{
    asset_kind:result.asset_kind,file_name:result.file_name,mime_type:result.mime_type,blob,
    notes:result.asset_kind==='production_zip'?'300 DPI graphics; xTool Studio controls printing':'Versioned UV Studio asset'
  });
  await refreshAssets(id);
  return uploaded;
 }
 async function saveCloudAsset(kind){
  if(!project.id)return setMessage('Save the project first.');
  if(shouldSimulateWrites())return setMessage('Training mode: nothing uploaded.');
  setBusy(true);setMessage('');
  try{
   const asset=await persistArtwork(project.id,kind);
   if(asset.asset_kind==='proof'){
    const {error}=await supabase.from('sc_uv_projects').update({
      proof_url:'r2://'+asset.storage_key,updated_at:new Date().toISOString()
    }).eq('id',project.id);
    if(error)throw error;setProject(p=>({...p,proof_url:'r2://'+asset.storage_key}));
   }
   setMessage('Private '+asset.asset_kind.replace('_',' ')+' uploaded and verified in R2 ('+Math.round(asset.file_size/1024)+' KB).');
  }catch(e){setMessage(e.message||'Cloud export failed');}finally{setBusy(false);}
 }
 async function downloadAsset(asset){
  try{
   const info=await signedUvAsset(project.id,asset.id);
   // Signed download URL opens without exposing the R2 bucket itself.
   window.open(info.url,'_blank','noopener,noreferrer');
  }catch(e){setMessage(e.message||'Could not access stored file');}
 }

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
    labor_minutes:Number(project.labor_minutes)||0,
    overhead_cost:Number(project.overhead_cost)||0,
    waste_quantity:Number(project.waste_quantity)||0,
    material_sku:project.material_sku||'',
    job_id:project.job_id?Number(project.job_id):null,
    customer_id:project.customer_id?Number(project.customer_id):null,
    artwork_request_id:project.artwork_request_id||null,
    mockup_project_id:project.mockup_project_id||null,
    blank_product_id:project.blank_product_id||null,
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
   try{
     const savedAsset=await persistArtwork(response.data.id,'SC_UV_EXPORT_EDITABLE');
     const reference='r2://'+savedAsset.storage_key;
     const {error:refError}=await supabase.from('sc_uv_projects').update({
       artwork_url:reference,updated_at:new Date().toISOString()
     }).eq('id',response.data.id);
     if(refError)throw refError;
     setProject(p=>({...p,artwork_url:reference}));
     setMessage('Project and editable source artwork saved to private R2 storage. Export a production ZIP before manufacturing.');
   }catch(assetError){
     setMessage('Project metadata saved, but cloud artwork save FAILED: '+assetError.message+
     '. Do not approve this job until the original artwork is stored.');
   }
  }catch(e){setMessage(e.message||'Could not save project');}finally{setBusy(false);}
 }
 async function loadEvents(id){
  const {data,error}=await supabase.from('sc_uv_project_events').select('*').eq('project_id',id).order('recorded_at',{ascending:false}).limit(100);
  if(error)setMessage(error.message);else setEvents(data||[]);
 }
 async function openProject(item){
  setProject({...item,material_recipe_id:item.material_recipe_id||''});
  await loadEvents(item.id);setShowLibrary(false);
  try{
   const list=await refreshAssets(item.id);
   const editable=list.find(x=>x.asset_kind==='editable');
   if(editable){
    const json=await readUvEditable(item.id,editable.id);
    await editorRequest('SC_UV_IMPORT_EDITABLE',json);
    setMessage('Private project artwork restored from R2. Review preview and settings before printing.');
   }else setMessage('This project has no cloud-editable asset yet. Upload source artwork before use.');
  }catch(e){setMessage('Project metadata opened. Cloud artwork could not be automatically restored: '+e.message);}
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
 const total=Number(project.unit_cost||0)*(Number(project.quantity||1)+Number(project.waste_quantity||0))
   + Number(project.overhead_cost||0);
 const revenue=Number(project.selling_price||0)*Number(project.quantity||1);
 const gross=revenue-total;
 const selectedJob=jobs.find(x=>String(x.id)===String(project.job_id));
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

    <label>Linked production job<select value={project.job_id||''} onChange={e=>{
      const job=jobs.find(j=>String(j.id)===e.target.value);
      setProject(p=>({...p,job_id:e.target.value,
        customer_reference:job?.customer_name||p.customer_reference,
        order_reference:job?.woocommerce_order_id?'Woo #'+job.woocommerce_order_id:job?.manual_order_id?'Manual #'+job.manual_order_id:p.order_reference}));
    }}><option value="">Unlinked UV sample / standalone</option>{jobs.map(x=><option key={x.id} value={x.id}>Job {x.id} · {x.customer_name||x.job_name||'Unknown'}</option>)}</select></label>
    <label>Existing customer<select value={project.customer_id||''} onChange={e=>update('customer_id',e.target.value)}>
    <option value="">Not linked</option>{customers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Artwork request<select value={project.artwork_request_id||''} onChange={e=>update('artwork_request_id',e.target.value)}>
    <option value="">Not linked</option>{artworkRequests.map(x=><option key={x.id} value={x.id}>{x.organization||x.customer_name||x.graphic_text||x.id} · {x.status}</option>)}</select></label>
    <label>Available inventory blank<select value={project.blank_product_id||''} onChange={e=>{
       const blank=blankProducts.find(x=>x.id===e.target.value);
       setProject(p=>({...p,blank_product_id:e.target.value,unit_cost:blank?.unit_cost??p.unit_cost}));
    }}><option value="">None / custom material</option>{blankProducts.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
    <label>Supplier material SKU<input value={project.material_sku||''} onChange={e=>update('material_sku',e.target.value)}/></label>
    <label>Material<select value={project.material_type} onChange={e=>update('material_type',e.target.value)}>
      {['leather','synthetic','transfer_film','metal','other'].map(x=><option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></label>
    <label>Product type<select value={project.project_type} onChange={e=>update('project_type',e.target.value)}>
      {['patch','transfer','metal_plate','other'].map(x=><option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></label>
    <label>Approved Omni recipe<select value={project.material_recipe_id||''} onChange={e=>update('material_recipe_id',e.target.value)}>
      <option value="">No approved recipe selected</option>{recipes.map(x=><option key={x.id} value={x.id}>{x.material_name} · {x.machine_model} · {x.operation}</option>)}</select></label>
    <label>Quantity<input type="number" min="1" max="10000" value={project.quantity} onChange={e=>update('quantity',e.target.value)}/></label>
    <label>Cost per item ($)<input type="number" step="0.01" min="0" value={project.unit_cost} onChange={e=>update('unit_cost',e.target.value)}/></label>
    <label>Estimated spoiled extras<input type="number" min="0" value={project.waste_quantity||0} onChange={e=>update('waste_quantity',e.target.value)}/></label>
    <label>Labor minutes<input type="number" step="0.1" min="0" value={project.labor_minutes||0} onChange={e=>update('labor_minutes',e.target.value)}/></label>
    <label>Overhead / setup cost ($)<input type="number" step="0.01" min="0" value={project.overhead_cost||0} onChange={e=>update('overhead_cost',e.target.value)}/></label>
    <label>Selling price per item ($)<input type="number" step="0.01" min="0" value={project.selling_price} onChange={e=>update('selling_price',e.target.value)}/></label>
  </div>
  <div className="sc-uv-costs"><span>Estimated batch cost <strong>{fmt(total)}</strong></span><span>Revenue <strong>{fmt(revenue)}</strong></span><span>Gross contribution (before overhead) <strong>{fmt(gross)}</strong></span></div>
  <div className="sc-uv-buttons"><button className="primary-button" disabled={busy||!canWrite} onClick={save}>Save project metadata from editor</button>
    <button className="secondary-button" onClick={exportJobCard}>Export job card CSV</button>
    <button className="secondary-button" disabled={busy||!canWrite||!project.id} onClick={()=>saveCloudAsset('SC_UV_EXPORT_PACK')}>Generate & save production ZIP to R2</button>
    <button className="secondary-button" disabled={busy||!canWrite||!project.id} onClick={()=>saveCloudAsset('SC_UV_EXPORT_PROOF')}>Save customer proof to R2</button>
    {admin&&project.id&&<><button className="secondary-button" onClick={()=>setStatus('proof')} disabled={busy}>Request proof</button>
      <button className="secondary-button" onClick={()=>setStatus('approved')} disabled={busy||project.status==='approved'}>Approve for production</button></>}</div>
  {selectedJob&&<p className="sc-uv-disclaimer">Linked job #{selectedJob.id} · {selectedJob.status}. Inventory is reserved and deducted only by the existing pull-sheet workflow; this UV record will not double-count blanks.</p>}
  {project.id&&<div className="sc-uv-events"><h3>Private Artwork Vault files</h3>{assets.map(a=><article key={a.id}><strong>{a.asset_kind}: {a.file_name}</strong> · {Math.round(a.file_size/1024)} KB · {new Date(a.created_at).toLocaleString()}
  <button type="button" className="secondary-button" onClick={()=>downloadAsset(a)}>Download</button></article>)}
  {!assets.length&&<p>No verified R2 assets yet.</p>}</div>}
  <p className="sc-uv-disclaimer">Source files, editable artwork and production assets are versioned in private R2 storage. The actual UV printing settings, image approvals and physical QC still require verification in xTool Studio and on the printed substrate.</p>
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
