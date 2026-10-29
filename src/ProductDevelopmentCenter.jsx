import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from './supabaseClient';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {shouldSimulateWrites} from './lib/testingMode';
import {STARTER_PRODUCTS,PACKAGE_TEMPLATES,EQUIPMENT,STAGES,
 opportunityScore,productEconomics,packageTotals,packageTemplate,readyForProduction,
 normalizeGuestNames,normalizeSourceUrl,currency} from './lib/productDevelopment';
import './ProductDevelopmentCenter.css';

const initialModel={units:24,sell_price:32,blank_cost:8,consumables:1,packaging:2,labor_minutes:10,labor_hourly_rate:24,machine_minutes:7,machine_hourly_rate:8,other_variable_cost:1,spoilage_rate_percent:5,channel_fee_percent:0,setup_cost:0};
const clean=o=>String(o??'').trim();
const month=()=>new Date().toISOString().slice(0,7)+'-01';
const tabs=[['radar','01 · Opportunity Radar'],['recipes','02 · Recipe & Test Lab'],['economics','03 · Economics'],['events','04 · Event Packages'],['launch','05 · Launch & Performance']];
function Field({label,value,onChange,type='text',min,step,choices,required=false,rows}) {
 return <label>{label}{choices?
  <select value={value??''} onChange={e=>onChange(e.target.value)}>{choices.map(o=>Array.isArray(o)?<option key={o[0]} value={o[0]}>{o[1]}</option>:<option key={o} value={o}>{o}</option>)}</select>:
  rows?<textarea rows={rows} value={value??''} onChange={e=>onChange(e.target.value)}/>:
  <input type={type} value={value??''} min={min} step={step} required={required} onChange={e=>onChange(e.target.value)}/>}</label>;
}
function Badge({children}){return <span className="pdc-tag">{children}</span>;}
export default function ProductDevelopmentCenter(){
 const access=useContext(EmployeeAccessContext);
 const role=access?.role;
 const canEdit=['admin','manager','marketing'].includes(role);
 const canTest=['admin','manager','operator'].includes(role);
 const canApprove=['admin','manager'].includes(role);
 const [tab,setTab]=useState('radar');
 const [opportunities,setOpportunities]=useState([]);
 const [recipes,setRecipes]=useState([]);
 const [sources,setSources]=useState([]);
 const [trials,setTrials]=useState([]);
 const [events,setEvents]=useState([]);
 const [eventItems,setEventItems]=useState([]);
 const [launches,setLaunches]=useState([]);
 const [metrics,setMetrics]=useState([]);
 const [selectedId,setSelectedId]=useState(null);
 const [eventId,setEventId]=useState(null);
 const [filter,setFilter]=useState('');
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [draft,setDraft]=useState({name:'',category:'Weddings & Events',audience:'',description:'',equipment:[]});
 const [sourceDraft,setSourceDraft]=useState({title:'',source_url:'',source_type:'manufacturer',summary:''});
 const [trialDraft,setTrialDraft]=useState({result:'needs_adjustment',material_lot:'',observations:'',photo_url:''});
 const [newEvent,setNewEvent]=useState({template_id:'wedding-essential',name:'',event_type:'wedding',event_date:'',client_name:'',guest_count:50,table_count:10,theme_name:'',theme_colors:''});
 const [newItem,setNewItem]=useState({label:'',quantity:1});
 const [names,setNames]=useState('');
 const [research,setResearch]=useState(null);
 const [sourceBusy,setSourceBusy]=useState(false);
 const [launchChannel,setLaunchChannel]=useState('woocommerce');
 const [listingRef,setListingRef]=useState('');
 const [automate,setAutomate]=useState({woo_product_id:'',qbo_customer_id:'',qbo_item_ids:'',invoice_number:'',expected_total:'',opportunity_id:'',job_item_ids:'',recipe_version_id:''});
 const [automationResult,setAutomationResult]=useState(null);
 const [existingJob,setExistingJob]=useState('');
 const [imports,setImports]=useState([]);
 const [performance,setPerformance]=useState({period_month:month(),units_sold:0,sales_revenue:0,total_variable_cost:0,scrapped_units:0,active_labor_minutes:0,machine_minutes:0,notes:''});
 const [costDraft,setCostDraft]=useState(initialModel);

 const selected=useMemo(()=>opportunities.find(x=>x.id===selectedId)||null,[opportunities,selectedId]);
 const currentEvent=useMemo(()=>events.find(x=>x.id===eventId)||null,[events,eventId]);
 const currentItems=useMemo(()=>eventItems.filter(x=>x.event_id===eventId),[eventItems,eventId]);
 const currentSources=useMemo(()=>sources.filter(x=>x.opportunity_id===selectedId),[sources,selectedId]);
 const currentTrials=useMemo(()=>trials.filter(x=>x.opportunity_id===selectedId),[trials,selectedId]);
 const currentLaunches=useMemo(()=>launches.filter(x=>x.opportunity_id===selectedId),[launches,selectedId]);
 const currentMetrics=useMemo(()=>metrics.filter(x=>x.opportunity_id===selectedId),[metrics,selectedId]);
 const currentRecipe=recipes.find(x=>x.id===selected?.material_recipe_id);
 const eco=productEconomics(costDraft);
 const total=packageTotals(currentItems);
 const filtered=useMemo(()=>opportunities.filter(p=>[p.name,p.category,p.audience,p.description,...(p.equipment||[])].join(' ').toLowerCase().includes(filter.toLowerCase()))
  .sort((a,b)=>opportunityScore(b)-opportunityScore(a)),[opportunities,filter]);
 const run=useCallback(async fn=>{setBusy(true);setError('');setMessage('');try{
    if(shouldSimulateWrites()){setMessage('Training mode is active: no records were changed.');return;}
    await fn();
   }catch(e){setError(e.message||'Unable to save changes.');}finally{setBusy(false);}},[]);
 const load=useCallback(async()=>{
   const specs=[
    ['sc_pdc_opportunities',setOpportunities],['sc_pdc_sources',setSources],['sc_pdc_trials',setTrials],
    ['sc_pdc_events',setEvents],['sc_pdc_event_items',setEventItems],['sc_pdc_launches',setLaunches],
    ['sc_pdc_performance',setMetrics],['sc_pdc_sales_imports',setImports],['sc_material_recipes',setRecipes]
   ];
   const out=await Promise.all(specs.map(async ([table,setter])=>{
     const result=await supabase.from(table).select('*').limit(1000);
     if(result.error)throw Error(table+': '+result.error.message);
     setter(result.data||[]);
   }));
   return out;
 },[]);
 useEffect(()=>{let active=true;load().catch(e=>{if(active)setError('Database setup incomplete or your employee role cannot access this module. '+e.message);});return()=>{active=false;};},[load]);
 useEffect(()=>{
   if(selected){setCostDraft({...initialModel,...(selected.cost_model||{})});setDraft({name:selected.name,category:selected.category,audience:selected.audience,description:selected.description,equipment:selected.equipment||[]});}
   else{setDraft({name:'',category:'Weddings & Events',audience:'',description:'',equipment:[]});setCostDraft(initialModel);}
   setResearch(null);
 },[selectedId,selected?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
 async function saveOpportunity(){
   await run(async()=>{
     if(!canEdit)throw Error('Your role is read-only.');
     if(clean(draft.name).length<3)throw Error('Enter a product name of at least three characters.');
     const payload={name:clean(draft.name),category:draft.category,audience:clean(draft.audience),description:clean(draft.description),equipment:draft.equipment};
     const q=selected?supabase.from('sc_pdc_opportunities').update(payload).eq('id',selected.id).select().single():
       supabase.from('sc_pdc_opportunities').insert(payload).select().single();
     const {data,error:dbError}=await q;if(dbError)throw dbError;
     await load();setSelectedId(data.id);setMessage('Product opportunity saved; market demand is not assumed.');
   });
 }
 async function addStarter(s){
   await run(async()=>{
     if(!canEdit)throw Error('Your role cannot create candidates.');
     const {data,error:dbError}=await supabase.from('sc_pdc_opportunities').insert({name:s.name,category:s.category,audience:s.category,description:s.notes,equipment:s.equipment}).select().single();
     if(dbError)throw dbError;await load();setSelectedId(data.id);setMessage('Starter candidate added; research, costs and physical tests still required.');
   });
 }
 async function patchOpportunity(updates){
  await run(async()=>{if(!canEdit)throw Error('Read-only role.');if(!selected)throw Error('Select a product.');
   const {error:dbError}=await supabase.from('sc_pdc_opportunities').update(updates).eq('id',selected.id);if(dbError)throw dbError;await load();setMessage('Opportunity updated.');});
 }
 async function addSource(){
  await run(async()=>{if(!selected||!canEdit)throw Error('Select a saved product and use an editor role.');
   const url=normalizeSourceUrl(sourceDraft.source_url);if(!url)throw Error('Provide an HTTPS source URL.');
   if(clean(sourceDraft.title).length<3)throw Error('Add a descriptive source title.');
   const {error:dbError}=await supabase.from('sc_pdc_sources').insert({opportunity_id:selected.id,...sourceDraft,source_url:url,verified:false});
   if(dbError)throw dbError;setSourceDraft({title:'',source_url:'',source_type:'manufacturer',summary:''});await load();setMessage('Source recorded as unverified until independently checked.');
  });
 }
 async function researchProduct(){
   if(!selected)return;setSourceBusy(true);setError('');setResearch(null);
   try{const r=await authenticatedFunctionFetch('/.netlify/functions/product-opportunity-research',{method:'POST',body:JSON.stringify({name:selected.name,category:selected.category,audience:selected.audience,equipment:selected.equipment})});
     const result=await r.json();if(!r.ok)throw Error(result.message||'Research unavailable.');
     setResearch(result);
   }catch(e){setError(e.message);}finally{setSourceBusy(false);}
 }
 async function trialSave(){
  await run(async()=>{
   if(!selected||!canTest)throw Error('A technician role and saved product are required.');
   if(!currentRecipe)throw Error('Choose an existing exact-material recipe for this product.');
   if(!clean(trialDraft.material_lot))throw Error('Record an identifiable material batch or lot.');
   const url=trialDraft.photo_url?normalizeSourceUrl(trialDraft.photo_url):null;
   if(trialDraft.photo_url&&!url)throw Error('Test photo must be an HTTPS URL or left blank.');
   const {error:dbError}=await supabase.from('sc_pdc_trials').insert({opportunity_id:selected.id,recipe_id:currentRecipe.id,
    recipe_version:currentRecipe.version,result:trialDraft.result,material_lot:clean(trialDraft.material_lot),
    observations:clean(trialDraft.observations),observed_settings:currentRecipe.settings||{},photo_url:url});
   if(dbError)throw dbError;await load();setMessage('Physical test recorded against recipe version '+currentRecipe.version+'.');
   setTrialDraft({result:'needs_adjustment',material_lot:'',observations:'',photo_url:''});
  });
 }
 async function saveEconomics(){await patchOpportunity({cost_model:costDraft});}
 async function createEvent(){
  await run(async()=>{
   if(!canEdit)throw Error('Read-only role.');
   const template=packageTemplate(newEvent.template_id,Number(newEvent.guest_count),Number(newEvent.table_count));
   if(!template)throw Error('Select a package template.');
   if(clean(newEvent.name).length<3)throw Error('Name the event or customer project.');
   const eventPayload={name:clean(newEvent.name),event_type:template.event_type,event_date:newEvent.event_date||null,
    client_name:clean(newEvent.client_name),guest_count:Number(newEvent.guest_count)||0,
    table_count:Number(newEvent.table_count)||0,
    theme:{name:newEvent.theme_name,colors:newEvent.theme_colors}};
   const {data,error:dbError}=await supabase.from('sc_pdc_events').insert(eventPayload).select().single();
   if(dbError)throw dbError;
   const {error:itemError}=await supabase.from('sc_pdc_event_items').insert(template.items.map(i=>({...i,event_id:data.id})));
   if(itemError){await load();setEventId(data.id);throw Error('Event created but template items did not save: '+itemError.message+'. Open the draft event and repair it.');}
   await load();setEventId(data.id);setTab('events');setMessage('Event package created as draft. Review pricing, exact recipes, and customer proofs.');
  });
 }
 async function addEventItem(){
  await run(async()=>{if(!currentEvent||!canEdit)throw Error('Select an editable event.');
   if(['production','fulfilled'].includes(currentEvent.status))throw Error('Reopen production event before making changes.');
   const {error:dbError}=await supabase.from('sc_pdc_event_items').insert({event_id:currentEvent.id,label:clean(newItem.label),quantity:Math.max(1,Number(newItem.quantity)||1)});
   if(dbError)throw dbError;await load();setNewItem({label:'',quantity:1});setMessage('Custom package item added.');
  });
 }
 function localItem(id,key,value){setEventItems(old=>old.map(i=>i.id===id?{...i,[key]:value}:i));}
 async function saveEventItem(item){
  await run(async()=>{
   if(!canEdit)throw Error('Read-only role.');
   if(['production','fulfilled'].includes(currentEvent?.status))throw Error('Cannot edit items in an active production package.');
   const fields={label:clean(item.label),quantity:Number(item.quantity),unit_price:Number(item.unit_price)||0,
     unit_cost:Number(item.unit_cost)||0,opportunity_id:item.opportunity_id||null,material_recipe_id:item.material_recipe_id||null,
     proof_status:item.proof_status,approved_artwork_revision:clean(item.approved_artwork_revision),notes:item.notes||'',
     job_reference:item.job_reference||''};
   if(fields.proof_status==='approved'&&(!fields.approved_artwork_revision||!fields.material_recipe_id))
     throw Error('Approved proofs require an exact artwork revision and selected recipe.');
   const {error:dbError}=await supabase.from('sc_pdc_event_items').update(fields).eq('id',item.id);
   if(dbError)throw dbError;await load();setMessage('Item saved. Production readiness is re-evaluated.');
  });
 }
 async function applyNames(item){
  await run(async()=>{if(!canEdit)throw Error('Read-only role.');
   if(['production','fulfilled'].includes(currentEvent?.status))throw Error('Cannot change approved production personalization.');
   const values=normalizeGuestNames(names,2000);
   if(!values.length)throw Error('Enter one name per line.');
   if(values.length>Number(item.quantity))throw Error('There are more names than item quantity. Update the quantity first.');
   const {error:dbError}=await supabase.from('sc_pdc_event_items').update({
    personalization:values.map(name=>({name})),proof_status:'draft',approved_artwork_revision:''
   }).eq('id',item.id);
   if(dbError)throw dbError;await load();setNames('');setMessage(values.length+' names assigned to draft personalization. Request new customer proof.');
  });
 }

 async function linkExistingJob(){
  await run(async()=>{
   if(!canApprove||!currentEvent)throw Error('Admin/manager and a saved event are required.');
   const job=Number(existingJob);
   if(!Number.isSafeInteger(job)||job<=0)throw Error('Enter an existing positive numeric job ID.');
   const {data,error:jobError}=await supabase.from('jobs').select('id,status,customer_name').eq('id',job).single();
   if(jobError||!data)throw Error('Job not found.');
   if(['completed','closed','cancelled','delivered'].includes(String(data.status).toLowerCase()))throw Error('Cannot link a closed job.');
   const {error:dbError}=await supabase.from('sc_pdc_events').update({production_job_id:job}).eq('id',currentEvent.id);
   if(dbError)throw dbError;await load();setMessage('Existing production job linked after verifying job ID. Confirm customer and line mappings before traveler creation.');
  });
 }
 async function changeEventStatus(status){
  await run(async()=>{if(!canEdit||!currentEvent)throw Error('Editor access and an event are required.');
   const {error:dbError}=await supabase.from('sc_pdc_events').update({status}).eq('id',currentEvent.id);
   if(dbError)throw dbError;await load();setMessage('Event status updated to '+status+'.');
  });
 }
 async function upsertLaunch(state){
  await run(async()=>{if(!canApprove||!selected)throw Error('An admin or manager must approve product launches.');
   const {error:dbError}=await supabase.from('sc_pdc_launches').upsert({opportunity_id:selected.id,channel:launchChannel,
    state,listing_reference:clean(listingRef)}, {onConflict:'opportunity_id,channel'});
   if(dbError)throw dbError;await load();setMessage(state==='published'?'External listing reference saved (not automatically published).':'Launch stage saved. No external storefront changes were made.');
  });
 }

 async function callAutomation(action,commit=false,extra={}){
  if(!canApprove){setError('Admin or manager authorization is required.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const body={action,commit,...extra};
   const response=await authenticatedFunctionFetch('/.netlify/functions/product-event-automation',{method:'POST',body:JSON.stringify(body)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.success)throw Error(result.message||'Automation failed.');
   setAutomationResult(result);
   setMessage((commit?'Action completed: ':'Validated: ')+(result.status||action)+'. Review the result below.');
   if(commit)await load();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function automationField(key,label,placeholder=''){
  return <label>{label}<input value={automate[key]||''} placeholder={placeholder} onChange={e=>setAutomate(o=>({...o,[key]:e.target.value}))}/></label>;
 }
 function actionButtons(action,values){
  return <div className="pdc-actions"><button disabled={busy||!canApprove} onClick={()=>callAutomation(action,false,values)}>Check without changes</button>
   <button className="pdc-primary" disabled={busy||!canApprove} onClick={()=>callAutomation(action,true,values)}>Execute verified action</button></div>;
 }
 async function savePerformance(){
   await run(async()=>{if(!canApprove||!selected)throw Error('Admin or manager only.');
    const {error:dbError}=await supabase.from('sc_pdc_performance').upsert({opportunity_id:selected.id,...performance},{onConflict:'opportunity_id,period_month'});
    if(dbError)throw dbError;await load();setMessage('Actual sales/quality metrics recorded. No data was imported from WooCommerce or QuickBooks.');
   });
 }
 function downloadPackage(){
  if(!currentEvent)return;
  const data={event:currentEvent,items:currentItems.map(i=>({...i,readiness:readyForProduction({recipe_id:i.material_recipe_id,proof_status:i.proof_status,approved_artwork_revision:i.approved_artwork_revision},recipes)})),
    totals:total,exported_at:new Date().toISOString(),notice:'Planning packet only; production job/travelers not created automatically.'};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download='sc-event-'+currentEvent.id+'.json';a.click();URL.revokeObjectURL(url);
 }
 const performanceSum=currentMetrics.reduce((r,m)=>({units:r.units+Number(m.units_sold||0),sales:r.sales+Number(m.sales_revenue||0),
  cost:r.cost+Number(m.total_variable_cost||0),waste:r.waste+Number(m.scrapped_units||0)}),{units:0,sales:0,cost:0,waste:0});
 return <main className="pdc-page">
  <header className="pdc-hero"><div><span className="pdc-eyebrow">SKILLED CRAFTING / BUSINESS DEVELOPMENT</span>
   <h1>Product & Event Center</h1><p>Research products, test real materials, calculate costs, assemble wedding and recognition packages, approve launches, and measure results.</p></div>
   <div className="pdc-hero-links"><Link className="pdc-link" to="/device-product-library">Devices</Link>
    <Link className="pdc-link" to="/material-settings">Machine recipes</Link><Link className="pdc-link" to="/marketing">Marketing CRM</Link></div>
  </header>
  <div className="pdc-stat-grid">
   <div className="pdc-stat"><strong>{opportunities.length}</strong><span>Saved opportunities</span></div>
   <div className="pdc-stat"><strong>{opportunities.filter(o=>o.status==='validated'||o.status==='live').length}</strong><span>Validated / active</span></div>
   <div className="pdc-stat"><strong>{events.length}</strong><span>Event packages</span></div>
   <div className="pdc-stat"><strong>{trials.filter(t=>t.result==='pass').length}</strong><span>Passing test records</span></div>
   <div className="pdc-stat"><strong>{launches.filter(l=>l.state==='published').length}</strong><span>Externally recorded listings</span></div>
  </div>
  <nav className="pdc-tabs" aria-label="Product development phases">{tabs.map(([id,label])=>
   <button key={id} type="button" aria-selected={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  {error&&<div className="pdc-error" role="alert">{error}</div>}
  {message&&<div className="pdc-success" role="status">{message}</div>}
  {tab!=='events'&&<div className="pdc-layout">
   <aside className="pdc-panel"><h2>Product opportunities</h2>
    <div className="pdc-toolbar"><input aria-label="Search products, equipment and audiences" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search product or device"/></div>
    <div className="pdc-list">{filtered.map(p=><button key={p.id} type="button" aria-current={selectedId===p.id} onClick={()=>setSelectedId(p.id)}>
     <span><strong>{p.name}</strong><br/><small>{p.category} · {p.status}</small></span><Badge>{opportunityScore(p)}/100</Badge></button>)}
    {!filtered.length&&<p className="pdc-muted">No saved matches. Add a candidate from the starter library.</p>}</div>
    {canEdit&&<div className="pdc-section"><h3>Starter candidates (not tested)</h3><div className="pdc-list">{STARTER_PRODUCTS.map((s,i)=>
      <button key={i} type="button" disabled={busy} onClick={()=>addStarter(s)} title={s.notes}><span>{s.name}<br/><small>{s.category}</small></span><span>＋</span></button>)}</div></div>}
   </aside>
   <div className="pdc-panel">
    {tab==='radar'&&<><h2>01 · Product Opportunity Radar</h2>
     <p className="pdc-note">Scores are manually entered evaluations, not verified search-volume or competitor statistics. Manufacturer and community research must have a source link.</p>
     <div className="pdc-form pdc-section"><h3>{selected?'Edit product candidate':'Create new product candidate'}</h3>
      <div className="pdc-grid"><Field label="Product name" value={draft.name} onChange={v=>setDraft(x=>({...x,name:v}))}/>
       <Field label="Category" value={draft.category} choices={['Weddings & Events','Sports & Coaches','Business Branding','Personalized Gifts','Other']} onChange={v=>setDraft(x=>({...x,category:v}))}/></div>
      <Field label="Target buyers" value={draft.audience} onChange={v=>setDraft(x=>({...x,audience:v}))}/>
      <Field label="Description / opportunity hypothesis" rows={3} value={draft.description} onChange={v=>setDraft(x=>({...x,description:v}))}/>
      <label>Compatible machines (candidate only)<div className="pdc-grid">{EQUIPMENT.map(([id,label])=><label key={id} style={{display:'block',fontWeight:400}}>
       <input type="checkbox" style={{width:'auto',marginRight:8}} checked={(draft.equipment||[]).includes(id)} onChange={e=>setDraft(d=>({...d,equipment:e.target.checked?[...d.equipment,id]:d.equipment.filter(x=>x!==id)}))}/>{label}
      </label>)}</div></label>
      <div className="pdc-actions"><button className="pdc-primary" disabled={busy||!canEdit} onClick={saveOpportunity}>{selected?'Save candidate':'Create candidate'}</button>
       {selected&&<button onClick={()=>setSelectedId(null)}>New candidate</button>}</div>
     </div>
     {selected&&<div className="pdc-section"><h3>Opportunity evaluation</h3><div className="pdc-grid pdc-form">
      {[['customer_fit','Fit with existing customers'],['demand_score','Demand evidence'],['production_fit','Equipment/production fit'],['differentiation_score','Differentiation']].map(([key,label])=>
       <Field key={key} label={label+' (0–100)'} type="number" min="0" value={selected[key]} onChange={v=>setOpportunities(o=>o.map(x=>x.id===selected.id?{...x,[key]:Math.max(0,Math.min(100,Number(v)||0))}:x))}/>)}
     </div><div className="pdc-progress"><div style={{width:opportunityScore(selected)+'%'}}/></div><p>Weighted candidate score: <strong>{opportunityScore(selected)}/100</strong></p>
     <div className="pdc-actions"><button disabled={busy||!canEdit} onClick={()=>patchOpportunity({customer_fit:selected.customer_fit,demand_score:selected.demand_score,production_fit:selected.production_fit,differentiation_score:selected.differentiation_score})}>Save scoring</button>
      <select aria-label="Research stage" value={selected.status} onChange={e=>patchOpportunity({status:e.target.value})} disabled={!canEdit||busy}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div></div>}
     {selected&&<div className="pdc-section"><h3>Evidence and research sources</h3>
      <div className="pdc-actions"><button disabled={sourceBusy} onClick={researchProduct}>{sourceBusy?'Researching…':'Research this product (web sources)'}</button></div>
      {research&&<section className="pdc-source"><p className="pdc-note">Machine-assisted research. References require independent verification; no production settings are approved.</p><p style={{whiteSpace:'pre-wrap'}}>{research.research}</p>
       {(research.references||[]).map((s,i)=><p key={i}><a href={s.url} rel="noreferrer" target="_blank">{s.label||s.url}</a> · unverified reference</p>)}</section>}
      <div className="pdc-form pdc-grid">
       <Field label="Source title" value={sourceDraft.title} onChange={v=>setSourceDraft(x=>({...x,title:v}))}/>
       <Field label="Source classification" value={sourceDraft.source_type} onChange={v=>setSourceDraft(x=>({...x,source_type:v}))}
        choices={['manufacturer','supplier','public_community','marketplace','shop_observation','other']}/>
       <Field label="HTTPS source link" value={sourceDraft.source_url} onChange={v=>setSourceDraft(x=>({...x,source_url:v}))}/>
       <Field label="Summary / relevant claims" value={sourceDraft.summary} onChange={v=>setSourceDraft(x=>({...x,summary:v}))}/>
      </div><button disabled={busy||!canEdit} onClick={addSource}>Save source as unverified</button>
      {currentSources.map(s=><div className="pdc-source" key={s.id}>
       <strong>{s.title}</strong> <Badge>{s.source_type}</Badge><br/>
       <a href={s.source_url} target="_blank" rel="noreferrer">{s.source_url}</a><p>{s.summary}</p>
       <small>{s.verified?'Human-verified':'Not independently verified'} · {new Date(s.created_at).toLocaleDateString()}</small>
      </div>)}
     </div>}
    </>}
    {tab==='recipes'&&<><h2>02 · Recipe & Physical Test Lab</h2>
     <p className="pdc-note">Existing machine recipes remain authoritative. This lab associates exact product/blank tests with immutable recipe-version references. An online recommendation is never a passing physical test.</p>
     {!selected?<p className="pdc-empty">Choose a saved opportunity from the left.</p>:<>
      <div className="pdc-form"><Field label="Exact existing material recipe" value={selected.material_recipe_id||''}
       choices={[['','Select existing recipe'],...recipes.filter(r=>(selected.equipment||[]).length===0||selected.equipment.includes(r.machine_type)).map(r=>[r.id,r.machine_model+' · '+r.material_name+' · v'+r.version+' · '+r.status])]}
       onChange={v=>patchOpportunity({material_recipe_id:v||null})}/>
      </div>
      <div className="pdc-actions"><Link className="pdc-link" to="/material-settings">Create / improve machine settings</Link>
       {selected.material_recipe_id&&<Link className="pdc-link" to={'/material-settings?recipe='+encodeURIComponent(selected.material_recipe_id)}>Open linked recipe</Link>}</div>
      <div className="pdc-section"><h3>Record physical test</h3>
       <p className="pdc-muted">Recipe: {currentRecipe?currentRecipe.machine_model+' / '+currentRecipe.material_name+' · v'+currentRecipe.version+' · '+currentRecipe.status:'Not selected'}</p>
       <div className="pdc-form pdc-grid">
        <Field label="Test outcome" value={trialDraft.result} choices={['needs_adjustment','pass','fail']} onChange={v=>setTrialDraft(x=>({...x,result:v}))}/>
        <Field label="Exact blank material lot/batch" value={trialDraft.material_lot} onChange={v=>setTrialDraft(x=>({...x,material_lot:v}))}/>
        <Field label="Test photograph HTTPS URL" value={trialDraft.photo_url} onChange={v=>setTrialDraft(x=>({...x,photo_url:v}))}/>
       </div>
       <div className="pdc-form"><Field rows={3} label="What was tested and what happened?" value={trialDraft.observations} onChange={v=>setTrialDraft(x=>({...x,observations:v}))}/></div>
       <button className="pdc-primary" disabled={busy||!canTest||!currentRecipe} onClick={trialSave}>Save test record</button>
      </div>
      <div className="pdc-section"><h3>Recorded test history</h3>{currentTrials.length===0&&<p className="pdc-muted">No physical tests yet.</p>}
       <div className="pdc-table-wrap"><table className="pdc-table"><thead><tr><th>Date</th><th>Version / lot</th><th>Result</th><th>Observations</th></tr></thead><tbody>
        {currentTrials.map(t=><tr key={t.id}><td>{new Date(t.created_at).toLocaleDateString()}</td><td>v{t.recipe_version} / {t.material_lot}</td>
         <td><Badge>{t.result}</Badge></td><td>{t.observations}{t.photo_url&&<p><a href={t.photo_url} rel="noreferrer" target="_blank">Test photo</a></p>}</td></tr>)}
       </tbody></table></div>
      </div></>}
    </>}
    {tab==='economics'&&<><h2>03 · True Production Economics</h2><p className="pdc-note">A planning model based on inputs you supply. No supplier prices or sales were imported; verify actual blanks, labor, channel fees, failure rate and tax separately.</p>
     {!selected?<p className="pdc-empty">Choose a saved product.</p>:<>
      <div className="pdc-form pdc-grid">
       {[['units','Quantity'],['sell_price','Selling price'],['blank_cost','Blank unit cost'],['consumables','Ink / consumables'],['packaging','Packaging / unit'],
       ['labor_minutes','Active labor minutes / unit'],['labor_hourly_rate','Labor rate / hour'],['machine_minutes','Machine minutes / unit'],
       ['machine_hourly_rate','Machine rate / hour'],['other_variable_cost','Other per unit'],['spoilage_rate_percent','Expected failures (%)'],
       ['channel_fee_percent','Channel fees (%)'],['setup_cost','Fixed order setup']].map(([key,label])=>
         <Field key={key} label={label} type="number" min="0" step="0.01" value={costDraft[key]} onChange={v=>setCostDraft(x=>({...x,[key]:v}))}/>)}
      </div>
      <div className="pdc-stat-grid">
       {[['Revenue',eco.revenue],['Total contribution',eco.totalContribution],['Contribution per item',eco.contribution],['Cost per unit',eco.perUnitCost],
        ['Contribution per labor hour',eco.contributionPerLaborHour],['Contribution per machine hour',eco.contributionPerMachineHour]]
         .map(([label,value])=><div className="pdc-stat" key={label}><strong>{value===null?'N/A':currency(value)}</strong><span>{label}</span></div>)}
       <div className="pdc-stat"><strong>{eco.marginPercent.toFixed(1)}%</strong><span>Contribution margin (not net profit)</span></div>
      </div>
      <button className="pdc-primary" disabled={!canEdit||busy} onClick={saveEconomics}>Save product cost model</button>
     </>}
    </>}
    {tab==='launch'&&<><h2>05 · Sales Launch & Performance</h2>
      <p className="pdc-note">Ready/published stage requires the current approved material recipe and a passing physical product trial. External listing creation, actual WooCommerce publishing and traveler generation remain in their established application workflows.</p>
      {!selected?<p className="pdc-empty">Choose a saved product.</p>:<>
       <div className="pdc-grid">
        <div className="pdc-stat"><strong>{currentRecipe?.status||'none'}</strong><span>Linked material recipe approval</span></div>
        <div className="pdc-stat"><strong>{currentTrials.some(t=>t.recipe_id===currentRecipe?.id&&t.recipe_version===currentRecipe?.version&&t.result==='pass')?'Pass':'Missing'}</strong><span>Passing test for current version</span></div>
        <div className="pdc-stat"><strong>{selected.status}</strong><span>Product stage</span></div>
       </div>
       <div className="pdc-section"><h3>Launch checklist / external reference</h3><div className="pdc-form pdc-grid">
        <Field label="Sales channel" value={launchChannel} choices={['woocommerce','quote','manual','crm']} onChange={setLaunchChannel}/>
        <Field label="Existing external product / quote reference" value={listingRef} onChange={setListingRef}/></div>
        <div className="pdc-actions"><button disabled={!canApprove||busy} onClick={()=>upsertLaunch('draft')}>Save launch draft</button>
         <button disabled={!canApprove||busy} onClick={()=>upsertLaunch('ready')}>Approve ready</button>
         <button disabled={!canApprove||busy||!clean(listingRef)} onClick={()=>upsertLaunch('published')}>Record external listing</button></div>
        {currentLaunches.map(l=><div className="pdc-source" key={l.id}><strong>{l.channel}</strong> · <Badge>{l.state}</Badge>
         <p className="pdc-muted">{l.listing_reference||'No external reference yet'} {l.approved_at&&'· Approved '+new Date(l.approved_at).toLocaleDateString()}</p></div>)}
        <p>Use the existing tools for actual execution:</p><div className="pdc-actions">
         <Link className="pdc-link" to="/mockup-studio">Mockups</Link><Link className="pdc-link" to="/marketing">Marketing CRM</Link>
         <Link className="pdc-link" to="/quote-builder">Quotes</Link><Link className="pdc-link" to="/catalog-workbench">Catalog / WooCommerce</Link>
         <Link className="pdc-link" to="/work-hub">Work Hub</Link><Link className="pdc-link" to="/production-travelers">Travelers</Link>
        </div>
       </div>

       {canApprove&&<div className="pdc-section pdc-form">
        <h3>Publish an existing configured WooCommerce product</h3>
        <p className="pdc-note">Requires a validated launch and an existing complete WooCommerce draft with images, shipping class, and product category. No product, variation or blank SKU is fabricated.</p>
        {automationField('woo_product_id','Existing WooCommerce draft product ID')}
        <div className="pdc-actions"><button disabled={busy||!currentLaunches.find(x=>x.channel==='woocommerce')} onClick={()=>callAutomation('publish_existing_woo_product',false,{launch_id:currentLaunches.find(x=>x.channel==='woocommerce')?.id,woo_product_id:automate.woo_product_id})}>Preview publish</button>
        <button className="pdc-primary" disabled={busy||!currentLaunches.find(x=>x.channel==='woocommerce')} onClick={()=>callAutomation('publish_existing_woo_product',true,{launch_id:currentLaunches.find(x=>x.channel==='woocommerce')?.id,woo_product_id:automate.woo_product_id})}>Publish approved WooCommerce draft</button></div>
       </div>}
       {canApprove&&<div className="pdc-section pdc-form"><h3>Import actual sales from verified QuickBooks invoices</h3>
        <p className="pdc-note">Only event package lines explicitly associated with this product can be attributed. Import is deduplicated by QuickBooks invoice ID and product ID.</p>
        {automationField('invoice_number','Exact QBO invoice number')}
        {automationField('expected_total','Verified QBO invoice total')}
        <label>Event associated with this product<select value={automate.opportunity_id} onChange={e=>setAutomate(o=>({...o,opportunity_id:e.target.value}))}>
         <option value="">Select event</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        {actionButtons('import_verified_qbo_sales',{event_id:automate.opportunity_id,opportunity_id:selected.id,
          invoice_number:automate.invoice_number,expected_total:automate.expected_total})}
        <h3>Imported, verified sales</h3>
        {imports.filter(x=>x.opportunity_id===selected.id).map(x=><p key={x.id}>{x.invoice_number} · {x.invoice_date} · {x.units} units · {currency(x.gross_sales)}</p>)}
       </div>}
       <div className="pdc-section"><h3>Actual monthly results</h3><div className="pdc-form pdc-grid">
        {[['period_month','Month'],['units_sold','Units sold'],['sales_revenue','Revenue'],['total_variable_cost','Variable costs'],
         ['scrapped_units','Spoiled units'],['active_labor_minutes','Labor minutes'],['machine_minutes','Machine minutes']].map(([key,label])=>
          <Field key={key} label={label} type={key==='period_month'?'month':'number'} min="0" step="0.01"
           value={key==='period_month'?performance.period_month.slice(0,7):performance[key]}
           onChange={v=>setPerformance(x=>({...x,[key]:key==='period_month'?v+'-01':Number(v)||0}))}/>)}
        <Field label="Notes / source of actuals" rows={2} value={performance.notes} onChange={v=>setPerformance(x=>({...x,notes:v}))}/></div>
        <button disabled={!canApprove||busy} onClick={savePerformance}>Save actual results</button>
       </div>
       <div className="pdc-stat-grid">
        <div className="pdc-stat"><strong>{performanceSum.units}</strong><span>Units recorded</span></div>
        <div className="pdc-stat"><strong>{currency(performanceSum.sales)}</strong><span>Recorded revenue</span></div>
        <div className="pdc-stat"><strong>{currency(performanceSum.sales-performanceSum.cost)}</strong><span>Recorded contribution</span></div>
        <div className="pdc-stat"><strong>{performanceSum.waste}</strong><span>Recorded spoiled units</span></div>
       </div>
       <div className="pdc-table-wrap"><table className="pdc-table"><thead><tr><th>Month</th><th>Units</th><th>Revenue</th><th>Variable costs</th><th>Scrap</th></tr></thead>
        <tbody>{currentMetrics.sort((a,b)=>b.period_month.localeCompare(a.period_month)).map(m=><tr key={m.id}><td>{m.period_month}</td><td>{m.units_sold}</td>
         <td>{currency(m.sales_revenue)}</td><td>{currency(m.total_variable_cost)}</td><td>{m.scrapped_units}</td></tr>)}</tbody></table></div>
      </>}
     </>}
   </div>
  </div>}
  {tab==='events'&&<div className="pdc-layout">
   <aside className="pdc-panel"><h2>Event & recognition packages</h2>
    <div className="pdc-list">{events.map(e=><button key={e.id} aria-current={eventId===e.id} onClick={()=>setEventId(e.id)}>
      <span><strong>{e.name}</strong><br/><small>{e.event_type.replaceAll('_',' ')} · {e.event_date||'date TBD'}</small></span><Badge>{e.status}</Badge></button>)}</div>
    {canEdit&&<div className="pdc-section pdc-form"><h3>Create a package from a reusable template</h3>
     <Field label="Package design" value={newEvent.template_id} choices={PACKAGE_TEMPLATES.map(t=>[t.id,t.name])}
      onChange={v=>setNewEvent(x=>({...x,template_id:v,event_type:PACKAGE_TEMPLATES.find(t=>t.id===v)?.event_type||'other'}))}/>
     <Field label="Event / project name" value={newEvent.name} onChange={v=>setNewEvent(x=>({...x,name:v}))}/>
     <Field label="Client or couple name" value={newEvent.client_name} onChange={v=>setNewEvent(x=>({...x,client_name:v}))}/>
     <Field label="Event date" type="date" value={newEvent.event_date} onChange={v=>setNewEvent(x=>({...x,event_date:v}))}/>
     <div className="pdc-grid"><Field label="Guests / favors" type="number" min="0" value={newEvent.guest_count} onChange={v=>setNewEvent(x=>({...x,guest_count:v}))}/>
     <Field label="Tables" type="number" min="0" value={newEvent.table_count} onChange={v=>setNewEvent(x=>({...x,table_count:v}))}/></div>
     <Field label="Design collection / theme" value={newEvent.theme_name} onChange={v=>setNewEvent(x=>({...x,theme_name:v}))}/>
     <Field label="Colors / design tokens" value={newEvent.theme_colors} onChange={v=>setNewEvent(x=>({...x,theme_colors:v}))}/>
     <button className="pdc-primary" disabled={busy} onClick={createEvent}>Create complete draft package</button>
    </div>}
   </aside>
   <div className="pdc-panel">{!currentEvent?<><h2>04 · Package & Event Builder</h2><p className="pdc-note">Wedding collections, coach recognition gifts, sports banquets and business appreciation packages share design tokens, line items, quantity, costs and approval gates. Create a draft package to begin.</p>
    <div className="pdc-grid">{PACKAGE_TEMPLATES.map(t=><div key={t.id} className="pdc-source"><h3>{t.name}</h3><ul>{t.items.map(([name,qty])=><li key={name}>{qty} × {name}</li>)}</ul></div>)}</div></>:
    <><h2>{currentEvent.name}</h2><p className="pdc-muted">{currentEvent.event_type.replaceAll('_',' ')} · {currentEvent.event_date||'Date not set'} · {currentEvent.guest_count} guests · {currentEvent.table_count} tables · {currentEvent.client_name}</p>
     <p className="pdc-note">Customer proofs are manually recorded, not automatically accepted. A production status change is blocked until every item has an approved artwork revision, a customer-approved proof, and an approved material recipe.</p>
     <div className="pdc-stat-grid">
      <div className="pdc-stat"><strong>{currentItems.length}</strong><span>Package product lines</span></div>
      <div className="pdc-stat"><strong>{total.units}</strong><span>Total units</span></div>
      <div className="pdc-stat"><strong>{currency(total.price)}</strong><span>Draft retail total</span></div>
      <div className="pdc-stat"><strong>{currency(total.price-total.cost)}</strong><span>Estimated contribution before unallocated costs</span></div>
     </div>
     <div className="pdc-actions">
      {['draft','quoted','approved','production','fulfilled'].map(status=><button key={status} disabled={!canEdit||busy||currentEvent.status===status}
       onClick={()=>changeEventStatus(status)}>{status}</button>)}
      <button onClick={downloadPackage}>Export planning packet</button>
      <Link className="pdc-link" to="/quote-builder">Prepare quote</Link><Link className="pdc-link" to="/work-hub">Work Hub</Link>
     </div>
     <div className="pdc-section pdc-table-wrap"><h3>Items / proofs / recipes</h3>
       <table className="pdc-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit cost</th><th>Unit price</th><th>Product opportunity</th><th>Recipe</th><th>Proof</th><th>Artwork revision</th><th>Action</th></tr></thead><tbody>
        {currentItems.map(i=><tr key={i.id}>
         <td><input aria-label="Product label" value={i.label} onChange={e=>localItem(i.id,'label',e.target.value)}/><small>{(i.personalization||[]).length} personalized names</small></td>
         <td><input type="number" min="1" aria-label="Quantity" value={i.quantity} onChange={e=>localItem(i.id,'quantity',e.target.value)}/></td>
         <td><input type="number" min="0" step="0.01" aria-label="Unit cost" value={i.unit_cost} onChange={e=>localItem(i.id,'unit_cost',e.target.value)}/></td>
         <td><input type="number" min="0" step="0.01" aria-label="Unit price" value={i.unit_price} onChange={e=>localItem(i.id,'unit_price',e.target.value)}/></td>
         <td><select aria-label="Linked product opportunity" value={i.opportunity_id||''} onChange={e=>localItem(i.id,'opportunity_id',e.target.value)}>
          <option value="">No product attribution</option>{opportunities.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
         <td><select aria-label="Production material recipe" value={i.material_recipe_id||''} onChange={e=>localItem(i.id,'material_recipe_id',e.target.value)}>
          <option value="">Select approved</option>{recipes.filter(r=>r.status==='approved').map(r=><option key={r.id} value={r.id}>{r.material_name} · {r.machine_model}</option>)}</select></td>
         <td><select aria-label="Proof status" value={i.proof_status} onChange={e=>localItem(i.id,'proof_status',e.target.value)}>{['draft','pending','revision_requested','approved'].map(s=><option key={s}>{s}</option>)}</select></td>
         <td><input aria-label="Artwork revision identifier" value={i.approved_artwork_revision} onChange={e=>localItem(i.id,'approved_artwork_revision',e.target.value)}/></td>
         <td><Badge>{readyForProduction({recipe_id:i.material_recipe_id,proof_status:i.proof_status},recipes).ok?'Ready':'Review'}</Badge>
          <button disabled={!canEdit||busy||['production','fulfilled'].includes(currentEvent.status)} onClick={()=>saveEventItem(i)}>Save</button></td>
        </tr>)}</tbody></table>
     </div>
     <div className="pdc-section pdc-grid">
      <div className="pdc-form"><h3>Add custom line</h3><Field label="Item description" value={newItem.label} onChange={v=>setNewItem(x=>({...x,label:v}))}/>
       <Field label="Quantity" type="number" min="1" value={newItem.quantity} onChange={v=>setNewItem(x=>({...x,quantity:v}))}/>
       <button disabled={!canEdit||busy} onClick={addEventItem}>Add item</button></div>
      <div className="pdc-form"><h3>Guest names / batch personalization</h3>
       <p className="pdc-muted">One name per line; import is saved only after choosing an item. Do not import private guest details that are not needed for production.</p>
       <textarea aria-label="One guest name per line" value={names} onChange={e=>setNames(e.target.value)} rows={6}/>
       <select aria-label="Item to personalize" id="pdc-personalize-item" defaultValue=""><option value="">Select a package item</option>{currentItems.map(i=><option value={i.id} key={i.id}>{i.label}</option>)}</select>
       <button disabled={!canEdit||busy} onClick={()=>{const id=document.getElementById('pdc-personalize-item')?.value;
        const item=currentItems.find(i=>i.id===id);if(item)applyNames(item);else setError('Choose an item for personalization.');}}>Attach draft personalization (reset proof)</button>
      </div>
     </div>

     {canApprove&&<div className="pdc-section pdc-form">
       <h3>Event production & QuickBooks automation</h3>
       <p className="pdc-note">All operations require exact mapped identifiers. Preview first. No invoice emails are sent automatically. Travelers use the existing production-artwork verification endpoint.</p>
       <h3>Create unsent QuickBooks invoice</h3>
       <div className="pdc-grid">{automationField('qbo_customer_id','Existing QuickBooks customer ID')}
        {automationField('qbo_item_ids','QuickBooks item mapping JSON','{"event-item-uuid": 123}')}
       </div>
       {actionButtons('create_qbo_event_invoice',{event_id:currentEvent.id,qbo_customer_id:automate.qbo_customer_id,
        qbo_item_ids:(()=>{try{return JSON.parse(automate.qbo_item_ids||'{}');}catch{return {};}})()})}
       <h3>Link existing production job</h3>
       <p className="pdc-muted">Current linked job: {currentEvent.production_job_id||'none'}</p>
       <input aria-label="Existing production job ID" value={existingJob} onChange={e=>setExistingJob(e.target.value)} placeholder="Existing job number"/>
       <button disabled={busy} onClick={linkExistingJob}>Link verified existing job</button>
       <h3>Create certified production traveler</h3>
       <p className="pdc-muted">Link a real job to the event via the existing Work Hub before attempting traveler generation. Use the job's existing item IDs and an approved manufacturing recipe revision.</p>
       <div className="pdc-grid">{automationField('job_item_ids','Existing job item IDs','123,124')}
        {automationField('recipe_version_id','Approved manufacturing recipe version UUID')}</div>
       {actionButtons('create_verified_traveler',{event_id:currentEvent.id,job_item_ids:automate.job_item_ids.split(',').map(x=>Number(x.trim())),
        recipe_version_id:automate.recipe_version_id})}
       <h3>Verify existing QuickBooks invoice</h3>
       <div className="pdc-grid">{automationField('invoice_number','Exact invoice number')}{automationField('expected_total','Expected invoice total')}</div>
       <button disabled={busy} onClick={()=>callAutomation('verify_qbo_event_invoice',false,{event_id:currentEvent.id,
        invoice_number:automate.invoice_number,expected_total:automate.expected_total})}>Verify exact invoice in QuickBooks</button>
      </div>}
     <div className="pdc-section"><h3>Production readiness checks</h3>{currentItems.map(i=>{
      const result=readyForProduction({recipe_id:i.material_recipe_id,proof_status:i.proof_status},recipes);
      return <p key={i.id}><Badge>{result.ok?'Ready':'Blocked'}</Badge> {i.label}: {result.reason} {!i.approved_artwork_revision&&'Artwork revision missing.'}</p>;
     })}</div>
    </>}
   </div>
  </div>}
  {automationResult&&<div className="pdc-panel pdc-section"><h3>Latest verified operation</h3><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(automationResult,null,2)}</pre></div>}
  <p className="pdc-muted" style={{marginTop:22}}>All research and example product templates are candidates only. Publishing, billing, and manufacturing remain gated by exact-material testing, customer approval and your existing work processes. No automatic external sale or printer operation occurs in this workspace.</p>
 </main>;
}
