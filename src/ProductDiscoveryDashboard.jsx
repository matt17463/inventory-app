import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from './supabaseClient';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {shouldSimulateWrites} from './lib/testingMode';
import {DISCOVERY_FOCUSES,discoveryScore} from './lib/productDiscoveryScoring';
import './ProductDiscoveryDashboard.css';

const money=v=>v==null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
const STATUS_ACTIVE=['queued','running'];
const name=s=>String(s||'').replaceAll('_',' ');
export default function ProductDiscoveryDashboard({opportunities=[],onReview,onReload,canDiscover=false}){
 const [runs,setRuns]=useState([]);
 const [focus,setFocus]=useState('all');
 const [quantity,setQuantity]=useState('12');
 const [filter,setFilter]=useState('all');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [lastRefresh,setLastRefresh]=useState(null);
 const loadRuns=useCallback(async()=>{
  const r=await supabase.from('sc_pdc_discovery_runs').select('*').order('requested_at',{ascending:false}).limit(35);
  if(r.error)throw new Error(r.error.message);
  setRuns(r.data||[]);setLastRefresh(new Date());
 },[]);
 useEffect(()=>{loadRuns().catch(e=>setError('Unable to load discovery history: '+e.message));},[loadRuns]);
 const inProgress=runs.some(r=>STATUS_ACTIVE.includes(r.status));
 useEffect(()=>{
  if(!inProgress)return;
  const interval=setInterval(()=>{
   loadRuns().then(()=>onReload?.()).catch(e=>setError('Refresh failed: '+e.message));
  },6500);
  return()=>clearInterval(interval);
 },[inProgress,loadRuns,onReload]);
 const discovered=useMemo(()=>opportunities.filter(p=>p.discovery_run_id),[opportunities]);
 const filtered=useMemo(()=>[...discovered].filter(p=>{
  if(filter==='all')return true;
  if(filter==='high')return discoveryScore(p)>=60;
  return p.category===filter;
 }).sort((a,b)=>discoveryScore(b)-discoveryScore(a)),[discovered,filter]);
 const totals=useMemo(()=>({
   count:discovered.length,
   withSources:discovered.filter(p=>p.discovery_evidence?.source_count>0).length,
   supplierMatched:discovered.filter(p=>p.discovery_evidence?.matched_supplier_items?.length>0).length,
   crmMatched:discovered.filter(p=>p.discovery_evidence?.crm_matching_segments?.length>0).length
 }),[discovered]);
 async function start(){
  if(!canDiscover){setError('Your user role cannot run discovery.');return;}
  if(shouldSimulateWrites()){setNotice('Guided Training Mode: discovery was not started, and no live records were written.');return;}
  if(inProgress){setError('A discovery run is already queued or running; review its status first.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const created=await supabase.from('sc_pdc_discovery_runs').insert({focus,requested_count:Number(quantity)}).select('id').single();
   if(created.error||!created.data?.id)throw new Error(created.error?.message||'Could not create discovery run.');
   const r=await authenticatedFunctionFetch('/.netlify/functions/product-discovery-run-background',{
    method:'POST',body:JSON.stringify({run_id:created.data.id})
   });
   if(!r.ok)throw new Error('Discovery service did not accept the job (HTTP '+r.status+'). Review the run status.');
   setNotice('Discovery submitted. New evidence-linked candidates appear below when research completes. This page refreshes while the run is active.');
   await loadRuns();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function refresh(){
  setBusy(true);setError('');
  try{await Promise.all([loadRuns(),Promise.resolve(onReload?.())]);}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const latest=runs[0];
 return <section className="pdc-discovery" aria-label="AI Product Discovery Dashboard">
  <div className="pdc-discovery-heading">
   <div><span className="pdc-eyebrow">RESEARCH-ASSISTED PRODUCT DEVELOPMENT</span>
    <h2>AI Product Discovery</h2>
    <p>Generate and save researched product candidates matched against existing CRM segments, supplier catalog items, and your equipment.</p></div>
   <button type="button" onClick={refresh} disabled={busy}>Refresh dashboard</button>
  </div>
  <div className="pdc-note">AI opportunity scores are <strong>provisional estimates</strong>. The engine checks real imported supplier and CRM data when available, but never assumes wholesale pricing, proven demand, approved production settings or confirmed supplier stock.</div>
  <div className="pdc-stat-grid">
   <div className="pdc-stat"><strong>{totals.count}</strong><span>AI-saved candidates</span></div>
   <div className="pdc-stat"><strong>{totals.withSources}</strong><span>With public research links</span></div>
   <div className="pdc-stat"><strong>{totals.supplierMatched}</strong><span>Matches in imported supplier catalog</span></div>
   <div className="pdc-stat"><strong>{totals.crmMatched}</strong><span>CRM segment matches</span></div>
  </div>
  <div className="pdc-discovery-grid">
   <div className="pdc-panel pdc-form">
    <h3>Discover new products</h3>
    <label>Research focus
     <select value={focus} onChange={e=>setFocus(e.target.value)}>{DISCOVERY_FOCUSES.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select>
    </label>
    <label>Number of candidates
     <select value={quantity} onChange={e=>setQuantity(e.target.value)}>{[4,8,12,16,20].map(x=><option key={x} value={x}>{x} products</option>)}</select>
    </label>
    <button className="pdc-primary" type="button" onClick={start} disabled={busy||inProgress||!canDiscover}>
     {inProgress?'Research in progress…':busy?'Submitting…':'Discover and save products'}
    </button>
    <p className="pdc-muted">Research runs use the configured server-side AI and public-search services, store source links and preliminary scores, and save only new candidates. Maximum four discovery runs per account user per day.</p>
    {latest&&<div className="pdc-source">
     <strong>Most recent run</strong>
     <p><span className="pdc-tag">{name(latest.status)}</span> {new Date(latest.requested_at).toLocaleString()}</p>
     <p className="pdc-muted">{latest.message||'Awaiting research start.'}</p>
     <p>Saved {latest.saved_count||0} · Duplicates {latest.duplicate_count||0} · Requested {latest.requested_count}</p>
    </div>}
    {lastRefresh&&<p className="pdc-muted">Last refreshed {lastRefresh.toLocaleTimeString()}</p>}
   </div>
   <div className="pdc-panel">
    <h3>Research run history</h3>
    <div className="pdc-table-wrap">
     <table className="pdc-table">
      <thead><tr><th>Requested</th><th>Focus</th><th>Result</th><th>Saved</th></tr></thead>
      <tbody>{runs.slice(0,12).map(r=><tr key={r.id}>
       <td>{new Date(r.requested_at).toLocaleString()}</td><td>{name(r.focus)}</td>
       <td><span className="pdc-tag">{name(r.status)}</span></td>
       <td>{r.saved_count||0} / {r.requested_count}</td>
      </tr>)}</tbody>
     </table>
    </div>
    {!runs.length&&<p className="pdc-empty">No discovery runs yet. Start one to build your researched shortlist.</p>}
    {latest&&<div className="pdc-section">
     <h3>Connected data used for scoring</h3>
     <p><strong>{latest.crm_signals?.opportunities_considered||0}</strong> open CRM opportunities considered</p>
     <p><strong>{latest.crm_signals?.segments?.length||0}</strong> CRM customer segments available</p>
     <p><strong>{latest.supplier_signals?.imported_rows||0}</strong> imported supplier catalog items considered</p>
     <p><strong>{latest.supplier_signals?.approved_recipe_machine_types?.length||0}</strong> approved material recipe machine matches available</p>
     {latest.supplier_signals?.imported_rows===0&&<p className="pdc-note">Your supplier catalog currently has no imported items for product-level price matching. Import supplier data in Supplier Catalog before relying on that part of the ranking.</p>}
    </div>}
   </div>
  </div>
  {error&&<div className="pdc-error" role="alert">{error}</div>}
  {notice&&<div className="pdc-success" role="status">{notice}</div>}
  <div className="pdc-panel pdc-discovery-results">
   <div className="pdc-discovery-heading"><div><h3>Ranked candidate dashboard</h3>
    <p className="pdc-muted">Select a candidate to inspect sources, adjust scoring, test a blank, and build a sales product.</p></div>
    <select aria-label="Filter discovered products" value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="all">All discovered ({totals.count})</option>
     <option value="high">Provisional 60+ score</option>
     {['Weddings & Events','Sports & Coaches','Business Branding','Personalized Gifts','Other'].map(x=><option key={x}>{x}</option>)}
    </select>
   </div>
   <div className="pdc-discovery-candidates">
    {filtered.map(p=>{
     const a=p.discovery_evidence||{};
     const score=discoveryScore(p);
     const suppliers=a.matched_supplier_items||[],segments=a.crm_matching_segments||[];
     return <article className="pdc-discovery-candidate" key={p.id}>
      <div className="pdc-discovery-heading">
       <div><span className="pdc-tag">{p.category}</span><h3>{p.name}</h3></div>
       <div className="pdc-discovery-score"><strong>{score}<span>/100</span></strong><small>estimated fit</small></div>
      </div>
      <p>{p.description}</p>
      <div className="pdc-discovery-breakdown">
       {[['Customers',p.customer_fit],['Demand',p.demand_score],['Production',p.production_fit],['Differentiation',p.differentiation_score]].map(([label,value])=>
        <div key={label}><span>{label}</span><strong>{Number(value)||0}</strong></div>)}
      </div>
      <div className="pdc-discovery-evidence">
       <p><strong>CRM match:</strong> {segments.length?segments.map(s=>s.segment+' ('+s.count+')').join(', '):'No matching segment in the current CRM'}</p>
       <p><strong>Supplier data:</strong> {suppliers.length?suppliers.map(s=>s.supplier+' / '+s.sku+(s.unit_cost!=null?' · '+money(s.unit_cost):'')).join('; '):'No matching imported catalog item; verify with suppliers'}</p>
       <p><strong>Source links:</strong> {Number(a.source_count)||0} · <strong>Evidence:</strong> {name(a.confidence||'unverified')}</p>
       <p><strong>Equipment:</strong> {(p.equipment||[]).join(', ')}</p>
      </div>
      <div className="pdc-discovery-actions">
       <button type="button" className="pdc-primary" onClick={()=>onReview?.(p.id)}>Review candidate & sources</button>
       {(a.source_urls||[]).slice(0,3).map((url,i)=><a key={url} href={url} target="_blank" rel="noopener noreferrer">Research source {i+1}</a>)}
      </div>
     </article>;
    })}
   </div>
   {!filtered.length&&<p className="pdc-empty">No candidates match this filter. Run AI discovery or change the filter to build the shortlist.</p>}
  </div>
 </section>;
}
