import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { shouldSimulateWrites } from './lib/testingMode';
import { supabase } from './supabaseClient';
import { MACHINE_TYPES, machineFor } from './lib/materialSettings';
import { OMNI_DEVICE, OMNI_SETUP, OMNI_PRODUCTS, OMNI_MAINTENANCE, OMNI_PROBLEMS, OMNI_OWNER_TIPS, daysUntilDue, searchOmniProducts } from './lib/omniKnowledge';
import './DeviceProductLibrary.css';

const categories=['all',...new Set(OMNI_PRODUCTS.map(p=>p.category))];
const sourceLink=(url,label)=> <a href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a>;
export default function DeviceProductLibrary(){
 const access=useContext(EmployeeAccessContext);
 const canWrite=['admin','manager','operator'].includes(access?.role);
 const [params]=useSearchParams();
 const [tab,setTab]=useState(params.get('tab')||'products');
 const [search,setSearch]=useState(params.get('q')||'');
 const [category,setCategory]=useState('all');
 const [machine,setMachine]=useState(params.get('machine')||'all');
 const [selected,setSelected]=useState('slate');
 const [setupChecks,setSetupChecks]=useState({});
 const [logs,setLogs]=useState([]);
 const [saved,setSaved]=useState([]);
 const [cloudReady,setCloudReady]=useState(false);
 const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const reload=useCallback(async()=>{
  const [r,s,l]=await Promise.all([
   supabase.from('sc_material_recipes').select('id,machine_type,machine_model,material_name,material_brand,material_sku,operation,status,source_type').order('updated_at',{ascending:false}).limit(600),
   supabase.from('sc_device_setup_checks').select('machine_type,step_key,completed_at').eq('machine_type','xtool_omni'),
   supabase.from('sc_device_maintenance_logs').select('id,machine_type,task_key,performed_at,notes').eq('machine_type','xtool_omni').order('performed_at',{ascending:false}).limit(500),
  ]);
  if(r.error) setNotice('Saved material recipes cannot be loaded: '+r.error.message);
  else setSaved(r.data||[]);
  if(s.error||l.error){
   setCloudReady(false);
   setNotice('Device setup and maintenance history are read-only until the new database migration is applied: '+(s.error||l.error).message);
   return;
  }
  setCloudReady(true);
  setSetupChecks(Object.fromEntries((s.data||[]).map(x=>[x.step_key,x.completed_at])));
  setLogs(l.data||[]);
 },[]);
 useEffect(()=>{reload().catch(e=>setNotice(e.message));},[reload]);
 const products=useMemo(()=>machine!=='all'&&machine!=='xtool_omni'?[]:searchOmniProducts(search,category),[machine,search,category]);
 const matchingSaved=useMemo(()=>saved.filter(r=>(machine==='all'||r.machine_type===machine)&&[r.material_name,r.material_brand,r.material_sku,r.machine_model,r.machine_type,r.operation].join(' ').toLowerCase().includes(search.toLowerCase())),[saved,machine,search]);
 const product=OMNI_PRODUCTS.find(p=>p.id===selected)||OMNI_PRODUCTS[0];
 const lastMaintenance=Object.fromEntries(OMNI_MAINTENANCE.map(t=>[t.id,logs.find(x=>x.task_key===t.id)?.performed_at]));
 async function toggleSetup(key,checked){
  if(!cloudReady||!canWrite||busy)return;
  if(shouldSimulateWrites()){setNotice('Training mode: setup steps are not saved.');return;}
  setBusy(true);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw Error('Sign in to save setup progress.');
   const {error}=await supabase.from('sc_device_setup_checks').upsert({
    machine_type:'xtool_omni',step_key:key,completed_at:checked?new Date().toISOString():null,updated_by:user.id
   },{onConflict:'machine_type,step_key'});
   if(error)throw error;
   setSetupChecks(old=>({...old,[key]:checked?new Date().toISOString():null}));
   setNotice('Setup progress saved for the workshop.');
  }catch(e){setNotice('Setup was not saved: '+e.message);}
  finally{setBusy(false);}
 }
 async function recordMaintenance(taskKey){
  if(!cloudReady||!canWrite||busy)return;
  if(shouldSimulateWrites()){setNotice('Training mode: maintenance not saved.');return;}
  setBusy(true);
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw Error('Sign in to record maintenance.');
   const {error}=await supabase.from('sc_device_maintenance_logs').insert({
    machine_type:'xtool_omni',task_key:taskKey,recorded_by:user.id,notes:notes.trim()
   });
   if(error)throw error;
   setNotes('');
   await reload();
   setNotice('Maintenance action recorded in the shared workshop log.');
  }catch(e){setNotice('Maintenance was not saved: '+e.message);}
  finally{setBusy(false);}
 }
 return <main className="page sc-device-library">
  <header className="sc-device-hero">
   <p className="eyebrow">SKILLED CRAFTING / WORKSHOP KNOWLEDGE</p>
   <h1>Device & Product Library</h1>
   <p>Find a product, its capable machine, setup steps, manufacturer sources, material trials and maintenance history. Suggested methods never count as approved production settings.</p>
   <div className="sc-device-actions"><Link to="/material-settings" className="secondary-button">Approved material settings</Link><Link to="/equipment-center" className="secondary-button">Equipment dashboard</Link><Link to="/uv-studio" className="secondary-button">UV Studio</Link></div>
  </header>
  {notice&&<p role="status" className="sc-device-notice">{notice}</p>}
  <nav className="sc-device-tabs" aria-label="Library sections">
   {[['products','Product search'],['devices','Devices'],['setup','Setup guide'],['maintenance','Maintenance'],['troubleshooting','Troubleshooting']].map(([id,title])=>
    <button type="button" key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}>{title}</button>)}
  </nav>
  {(tab==='products'||tab==='devices')&&<section className="card sc-device-filter">
   <label>Search products and machine settings<input type="search" value={search} placeholder="e.g. golf ball, brass, leather, laser, xTool Omni…" onChange={e=>setSearch(e.target.value)}/></label>
   <label>Device type<select value={machine} onChange={e=>setMachine(e.target.value)}>
    <option value="all">All devices</option>{MACHINE_TYPES.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
   {tab==='products'&&<label>Product category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option value={c} key={c}>{c==='all'?'All product types':c}</option>)}</select></label>}
  </section>}
  {tab==='devices'&&<section className="sc-device-tiles">
   {MACHINE_TYPES.filter(x=>machine==='all'||x.id===machine).filter(x=>(x.label+' '+(x.id==='xtool_omni'?OMNI_DEVICE.name:'')).toLowerCase().includes(search.toLowerCase())||matchingSaved.some(r=>r.machine_type===x.id)).map(x=>
    <article className="card" key={x.id}><p className="eyebrow">{x.id==='xtool_omni'?'DUAL-UV PRINTING':'EQUIPMENT SETTINGS'}</p><h2>{x.id==='xtool_omni'?OMNI_DEVICE.name:x.label}</h2><p>{x.id==='xtool_omni'?OMNI_DEVICE.specs:x.note}</p>
     <p>{saved.filter(r=>r.machine_type===x.id&&r.status==='approved').length} production-approved material recipes</p>
     <div className="sc-device-actions"><button onClick={()=>{setMachine(x.id);setTab('products');}}>Show products and recipes</button>{x.id==='xtool_omni'&&<button onClick={()=>setTab('setup')}>Setup walkthrough</button>}</div>
    </article>)}
  </section>}
  {tab==='products'&&<div className="sc-device-columns">
   <section className="card">
    <h2>Product walkthroughs <small>({products.length})</small></h2>
    <p className="sc-device-muted">Built-in starter workflows are not approved settings. Check the exact blank and current manufacturer guidance.</p>
    <div className="sc-device-list">{products.map(p=><button className={selected===p.id?'selected':''} key={p.id} onClick={()=>setSelected(p.id)}>
      <strong>{p.name}</strong><small>{p.category} · {p.status.replaceAll('-',' ')}</small></button>)}</div>
    {!products.length&&<p>No built-in Omni products match. Try a different machine or term.</p>}
    <h3>Saved workshop recipes ({matchingSaved.length})</h3>
    <p className="sc-device-muted">Only status “approved” has passed the existing physical-test and manager-approval gate.</p>
    <div className="sc-device-saved">{matchingSaved.slice(0,100).map(r=><article key={r.id}>
      <strong>{r.material_name}</strong> · {machineFor(r.machine_type).label}<span className={'sc-recipe-status '+r.status}>{r.status}</span><Link to={'/material-settings?recipe='+encodeURIComponent(r.id)}>Open recipe</Link>
    </article>)}</div>
   </section>
   {(machine==='all'||machine==='xtool_omni')&&<section className="card sc-device-guide">
    <p className="eyebrow">PRODUCT / {product.category.toUpperCase()}</p><h2>{product.name}</h2>
    {product.status==='not-supported-or1'&&<p className="sc-device-warning" role="alert">Not supported by the standard OR1 spherical-size specification. No approved golf-ball printing profile is provided.</p>}
    <dl>
     <dt>Material</dt><dd>{product.material}</dd><dt>Equipment</dt><dd>{OMNI_DEVICE.name}</dd>
     <dt>Fixture / accessory</dt><dd>{product.accessory}</dd><dt>Surface preparation</dt><dd>{product.primer}</dd>
     <dt>Print / ink strategy</dt><dd>{product.ink}</dd><dt>Evidence status</dt><dd>{product.status.replaceAll('-',' ')} — not production approved</dd>
    </dl>
    <h3>Step-by-step process</h3><ol>{product.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
    <p>{sourceLink(product.source,'View original xTool reference')}</p>
    <div className="sc-device-actions"><Link className="primary-button" to={'/material-settings?seed='+encodeURIComponent(product.id)}>Create unapproved test recipe</Link><button onClick={()=>{setSearch('');setCategory('all');setMachine('xtool_omni');setTab('troubleshooting');}}>Troubleshooting</button></div>
   </section>}
  </div>}
  {tab==='setup'&&<section className="card sc-device-guide">
   <h2>Initial setup — {OMNI_DEVICE.name}</h2><p>Manufacturer wizard is authoritative. Setup checkmarks are shared across operators; use only after the physical step is complete.</p>
   {!cloudReady&&<p className="sc-device-warning">The setup checklist is currently read-only; database migration or permissions require verification.</p>}
   <ol className="sc-device-checklist">{OMNI_SETUP.map(([key,step])=><li key={key}><label><input type="checkbox" checked={!!setupChecks[key]} onChange={e=>toggleSetup(key,e.target.checked)} disabled={!cloudReady||!canWrite||busy}/><span>{step}</span></label></li>)}</ol>
   <h3>Manufacturer reference documents</h3><ul>{OMNI_DEVICE.sources.map(x=><li key={x.url}>{sourceLink(x.url,x.label)}</li>)}</ul>
  </section>}
  {tab==='maintenance'&&<section className="card sc-device-guide">
   <h2>Maintenance and service history</h2><p>Tasks are scheduled from actual logged completions where there is a recommended interval. xTool Studio Device Health remains authoritative for printer counters and replacement prompts.</p>
   {!cloudReady&&<p className="sc-device-warning">Maintenance logs are read-only until database setup is complete.</p>}
   <label>Optional service notes (apply to the next logged task)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="Ink lot, observations, replacement confirmation, follow-up…"/></label>
   <div className="sc-device-maint">{OMNI_MAINTENANCE.map(t=>{
    const last=lastMaintenance[t.id];const due=daysUntilDue(last,t.intervalDays);
    return <article key={t.id}><div><h3>{t.title}</h3><p><strong>{t.cadence}</strong> · {last?'Last logged '+new Date(last).toLocaleDateString():'No completion logged'}</p><p>{t.instructions}</p><p>{sourceLink(t.source,'Official procedure')}</p>
     {due!==null&&<p className={due<=0?'sc-device-warning':''}>{due<=0?'Due / not yet recorded':'Next review in '+due+' day(s)'}</p>}</div>
     <button type="button" disabled={!canWrite||!cloudReady||busy} onClick={()=>recordMaintenance(t.id)}>Record completed</button>
    </article>})}</div>
   <h3>Recent maintenance history</h3>{logs.length?<ul>{logs.slice(0,20).map(l=><li key={l.id}>{new Date(l.performed_at).toLocaleString()} — {OMNI_MAINTENANCE.find(t=>t.id===l.task_key)?.title||l.task_key}{l.notes?' · '+l.notes:''}</li>)}</ul>:<p>No recorded maintenance yet.</p>}
  </section>}
  {tab==='troubleshooting'&&<section className="card sc-device-guide">
   <h2>Problem finder</h2><label>Filter symptoms<input type="search" placeholder="e.g. nozzle, ink peeling, rotary" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {OMNI_PROBLEMS.filter(p=>[p.title,p.keywords,...p.checks].join(' ').toLowerCase().includes(search.toLowerCase())).map(p=><article key={p.id} className="sc-device-problem">
    <h3>{p.title}</h3><ol>{p.checks.map((c,i)=><li key={i}>{c}</li>)}</ol><p>{sourceLink(p.source,'Official xTool guidance')}</p>
   </article>)}
   <h3>Public owner reports — unverified</h3>
   <p className="sc-device-muted">Community experiences, including model variants, are presented as reports rather than confirmed fixes. Avoid unsafe DIY cleaning and follow official service procedures.</p>
   {OMNI_OWNER_TIPS.filter(t=>[t.title,t.reported,t.model].join(' ').toLowerCase().includes(search.toLowerCase())).map(t=>
    <article key={t.id} className="sc-device-problem"><h3>{t.title}</h3><p><strong>Edition context:</strong> {t.model}</p><p>{t.reported}</p><p>{sourceLink(t.url,'Original public discussion')}</p></article>)}
  </section>}
  <footer className="sc-device-footer">xTool Studio is the sole printing controller. No remote printer operation or automatic material approval is performed here.</footer>
 </main>;
}