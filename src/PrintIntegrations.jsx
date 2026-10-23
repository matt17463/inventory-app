import {useEffect,useState} from 'react';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {normalizePrintPrefs} from './lib/printModel';

async function request(endpoint,body){
 const r=await authenticatedFunctionFetch('/.netlify/functions/'+endpoint,{
  method:'POST',body:JSON.stringify(body),
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.success)throw Error(data.error||'Integration request failed.');
 return data;
}
export default function PrintIntegrations({source,job,prefs,setPrefs,onRefresh}){
 const [config,setConfig]=useState(null),[layout,setLayout]=useState(null);
 const [queue,setQueue]=useState([]);
 const [sku,setSku]=useState(''),[recipe,setRecipe]=useState('');
 const [busy,setBusy]=useState(''),[message,setMessage]=useState('');
 const isManual=source?.source==='quickbooks_manual';
 const skus=[...new Set((source?.lines||[]).map(v=>String(v.sku||'').trim()).filter(Boolean))];
 async function refresh(){
  setBusy('refresh');
  try{
   const [q,l,p]=await Promise.all([
    request('qbo-print-connect',{action:'status'}),
    request('print-workflow-settings',{action:'get',source:source?.source||'default'}),
    request('print-dispatch',{action:'status',jobId:job.id}),
   ]);
   setConfig(q);setLayout(l);setQueue(p.jobs||[]);
   setPrefs(normalizePrintPrefs(l.settings));
  }catch(e){setMessage(e.message);}
  finally{setBusy('');}
 }
 useEffect(()=>{
  let active=true;
  if(!source||!job)return;
  Promise.all([
   request('qbo-print-connect',{action:'status'}),
   request('print-workflow-settings',{action:'get',source:source.source}),
   request('print-dispatch',{action:'status',jobId:job.id}),
  ]).then(([q,l,p])=>{if(active){setConfig(q);setLayout(l);setQueue(p.jobs||[]);setPrefs(normalizePrintPrefs(l.settings));}})
    .catch(e=>{if(active)setMessage(e.message);});
  return()=>{active=false;};
 },[job?.id,source?.source]); // eslint-disable-line react-hooks/exhaustive-deps
 async function invoke(action,body,notice){
  setBusy(action);setMessage('');
  try{
   const res=await request('print-workflow-settings',{action,source:source.source,...body});
   setMessage(notice||res.notice||'Saved.');
   if(action==='apply_profiles_to_job')await onRefresh?.();
   else if(action==='map_sku'||action==='save_layout'){
    const l=await request('print-workflow-settings',{action:'get',source:source.source});
    setLayout(l);
   }
  }catch(e){setMessage(e.message);}finally{setBusy('');}
 }
 async function connectQuickBooks(){
  setBusy('oauth');setMessage('');
  try{
   const v=await request('qbo-print-connect',{action:'start'});
   if(!v.authorize_url?.startsWith('https://appcenter.intuit.com/connect/oauth2?'))
    throw Error('Untrusted QuickBooks authorization destination.');
   window.location.assign(v.authorize_url);
  }catch(e){setMessage(e.message);setBusy('');}
 }
 return <section className="card elevated-card sc-print-integrations">
  <h2>Shared settings, QuickBooks and production setup</h2>
  {message&&<p role="status">{message}</p>}
  <div className="sc-print-cards">
   <div>
    <h3>QuickBooks Online verification</h3>
    <p>{config?.connected?'Account connected.':'Not connected.'} {config?.configured?'OAuth integration configured.':'Netlify OAuth credentials need configuration.'}</p>
    <p>QuickBooks order printing is only finalized after the original invoice number and totals are checked.</p>
    <button type="button" disabled={Boolean(busy)||!config?.configured} onClick={connectQuickBooks}>
     {config?.connected?'Reconnect QuickBooks':'Connect QuickBooks'}</button>
    {isManual&&<button type="button" disabled={Boolean(busy)} onClick={onRefresh}>Recheck original invoice</button>}
   </div>
   <div>
    <h3>Shared document template</h3>
    <p>Save the current font sizes, labels and field visibility for all workstations using {isManual?'QuickBooks/manual':'WooCommerce'} orders.</p>
    <button type="button" disabled={Boolean(busy)} onClick={()=>invoke('save_layout',{settings:prefs},
      'Shared template saved for this order source.')}>Save shared defaults</button>
    <small>{layout?'Shared settings loaded. Version '+layout.version+'.':'Shared settings are not yet loaded.'}</small>
   </div>
   <div>
    <h3>Epson print queue history</h3>
    <p>Queued jobs are collected by the Raspberry Pi print agent, which sends them to CUPS.</p>
    <button type="button" disabled={Boolean(busy)} onClick={refresh}>Refresh print queue</button>
    {queue.slice(0,6).map(q=><small key={q.id}>{q.document_kind}: {q.status}
      {q.cups_job_reference?' · '+q.cups_job_reference:''}{q.error_text?' · '+q.error_text:''}</small>)}
    {!queue.length&&<small>No print jobs submitted for this order.</small>}
   </div>
  </div>
  <div className="sc-print-mapping">
   <h3>Approved artwork and manufacturing recipe mapping</h3>
   <p>Assign an approved recipe to an exact SKU. Apply it deliberately to unmapped job lines; existing travelers, stock and Woo/QuickBooks invoices are not modified.</p>
   {!skus.length?<p>These order lines have no usable SKU. Link product identifiers before using SKU-based automatic mapping.</p>:<>
    <label>Product SKU<select value={sku} onChange={e=>setSku(e.target.value)}>
     <option value="">Choose SKU</option>{skus.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Approved recipe revision<select value={recipe} onChange={e=>setRecipe(e.target.value)}>
     <option value="">Choose approved revision</option>
     {(layout?.approvedVersions||[]).map(v=><option key={v.id} value={v.id}>Recipe {String(v.recipe_id).slice(0,8)} · Rev {v.revision}{v.artwork_asset_id?' · Artwork linked':''}</option>)}
    </select></label>
    <button type="button" disabled={Boolean(busy)||!sku||!recipe} onClick={()=>invoke('map_sku',{sku,recipeVersionId:recipe},
      'Approved recipe linked to SKU '+sku+'.')}>Save product recipe assignment</button>
    {(layout?.profiles||[]).filter(p=>skus.includes(p.source_key)).map(p=><small key={p.source_key}>
     {p.source_key} → Recipe {String(p.recipe_version_id).slice(0,8)}</small>)}
    <button type="button" disabled={Boolean(busy)} onClick={()=>invoke('apply_profiles_to_job',{jobId:job.id})}>
     Attach mapped recipes to unassigned job lines</button>
   </>}
  </div>
 </section>;
}
