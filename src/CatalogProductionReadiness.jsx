import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {PLACEMENT_SOURCES} from './lib/catalogProductionPresets';
import './CatalogProductionReadiness.css';

async function action(payload){
 const response=await authenticatedFunctionFetch('/.netlify/functions/catalog-production-readiness',{
  method:'POST',body:JSON.stringify(payload)
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.success)throw Error(data.message||'Catalog readiness request failed.');
 return data.data;
}
const fmt=x=>Number(x||0).toLocaleString();
const titleFor=f=>(f.product_name||'Unnamed WooCommerce family')+' · #'+f.woocommerce_product_id;
const labels={review:'Needs assignment',awaiting_approval:'Awaiting physical approval',approved:'Approved recipe linked',fulfillment_only:'Fulfillment only'};
function errorMessage(err){return err?.message||'Operation unsuccessful.';}
const clientNeeds=c=>Number(c.crm_account_count||0)===0;
export default function CatalogProductionReadiness(){
 const access=useContext(EmployeeAccessContext);
 const canManage=['admin','manager'].includes(access?.role);
 const [state,setState]=useState(null);
 const [tab,setTab]=useState('products');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('all');
 const [sortMode,setSortMode]=useState('attention');
 const [activeOrderDemand,setActiveOrderDemand]=useState([]);
 const [familyId,setFamilyId]=useState(null);
 const [selectedRecipe,setSelectedRecipe]=useState('');
 const [disposition,setDisposition]=useState('assigned');
 const [notes,setNotes]=useState('');
 const [clientFilter,setClientFilter]=useState('unlinked');
 const [preview,setPreview]=useState([]);
 const [selectedLines,setSelectedLines]=useState([]);
 const [confirmArtwork,setConfirmArtwork]=useState(false);
 const [previewLoaded,setPreviewLoaded]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);try{const [overview,open] = await Promise.all([action({action:'overview'}), action({action:'preview_open'}).catch(()=>[])]);setState(overview);setActiveOrderDemand(Array.isArray(open)?open:[]);setMessage('Catalog readiness and current open-order demand refreshed.');}
  catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const assignments=useMemo(()=>new Map((state?.assignments||[]).map(a=>[Number(a.woocommerce_product_id),a])),[state]);
 const families=state?.families||[];
 const demand=useMemo(()=>{const m=new Map();for(const item of activeOrderDemand){const id=Number(item.woocommerce_product_id);if(id>0)m.set(id,(m.get(id)||0)+Number(item.quantity||0));}return m;},[activeOrderDemand]);
 const blockers=useMemo(()=>new Set(activeOrderDemand.filter(x=>!x.eligible && x.status!=='Traveler already exists').map(x=>Number(x.woocommerce_product_id))),[activeOrderDemand]);
 const filtered=useMemo(()=>families.filter(f=>{
  const hit=[f.product_name,f.example_sku,f.woocommerce_product_id,f.classification?.garment].join(' ').toLowerCase().includes(search.toLowerCase());
  return hit&&(status==='all'||f.readiness===status);
 }).sort((a,b)=>{if(sortMode==='name')return String(a.product_name||'').localeCompare(String(b.product_name||''));const demandDiff=(demand.get(Number(b.woocommerce_product_id))||0)-(demand.get(Number(a.woocommerce_product_id))||0);if(sortMode==='demand')return demandDiff;const urgent=(f)=>Number(blockers.has(Number(f.woocommerce_product_id))&&demand.has(Number(f.woocommerce_product_id)))*100000+(demand.get(Number(f.woocommerce_product_id))||0)*100+Number(f.missing_blank_rows||0);return urgent(b)-urgent(a);}),[families,search,status,sortMode,demand,blockers]);
 const selected=families.find(x=>Number(x.woocommerce_product_id)===Number(familyId));
 const ready=(state?.versions||[]).filter(v=>v.status==='approved');
 const approvedRecipeIds=new Set(ready.map(v=>v.recipe_id));
 async function run(input,done){
  setBusy(true);setMessage('');
  try{
   const result=await action(input);
   await load();
   setMessage(done?done(result):'Update completed.');
  }catch(e){setMessage(errorMessage(e));}
  finally{setBusy(false);}
 }
 async function installStarterLibrary(){
  if(!canManage||busy)return;
  setBusy(true);setMessage('');
  const result=[];
  try{
   const dtf=await action({action:'seed_drafts'});
   result.push('DTF: '+dtf.created+' created, '+dtf.reused+' already present');
   const response=await authenticatedFunctionFetch('/.netlify/functions/legacy-catalog-modernization',{
    method:'POST',body:JSON.stringify({action:'seed_expanded_recipes'})
   });
   const body=await response.json().catch(()=>({}));
   if(!response.ok||!body.success)throw Error(body.message||'Expanded recipe initialization failed.');
   const expanded=body.data;
   result.push('Other methods: '+expanded.created+' created, '+expanded.reused+' already present');
   setState(await action({action:'overview'}));
   setMessage('Starter library initialized. '+result.join('; ')+'. All recipes are drafts pending physical testing.');
  }catch(e){
   try{setState(await action({action:'overview'}));}catch{}
   setMessage('Library setup incomplete. '+result.join('; ')+'. '+errorMessage(e)+' — retry to add only missing recipes.');
  }finally{setBusy(false);}
 }
 function choose(f){
  const row=assignments.get(Number(f.woocommerce_product_id));
  setFamilyId(f.woocommerce_product_id);
  setDisposition(row?.disposition==='fulfillment_only'?'fulfillment_only':'assigned');
  setSelectedRecipe(row?.recipe_id||'');setNotes(row?.notes||'');
 }
 async function previewJobs(){
  setBusy(true);setMessage('');
  try{const rows=await action({action:'preview_open'});setPreview(rows);setPreviewLoaded(true);setSelectedLines([]);
   setConfirmArtwork(false);setMessage('Read-only job eligibility preview refreshed.');}
  catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
 }
 function downloadCsv(){
  const selectedRows=(state?.clients||[]).filter(c=>clientFilter!=='unlinked'||clientNeeds(c));
  const safe=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  const csv=['customer_id,customer_name,crm_accounts,has_email,has_phone,last_order_at',
   ...selectedRows.map(c=>[c.customer_id,c.customer_name,c.crm_account_count,c.has_email,c.has_phone,c.last_order_at].map(safe).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='skilled-crafting-legacy-client-readiness.csv';a.click();URL.revokeObjectURL(url);
 }
 const legacy=(state?.clients||[]).filter(c=>(clientFilter==='all'||clientNeeds(c))&&
  [c.customer_name,c.customer_id].join(' ').toLowerCase().includes(search.toLowerCase())).slice(0,300);
 const eligible=preview.filter(x=>x.eligible);
 return <main className="page sc-catalog-readiness">
  <header className="page-header"><div>
   <p className="eyebrow">Catalog · Legacy adoption · Production</p>
   <h1>Catalog Production Readiness</h1>
   <p>Bring existing WooCommerce products and customers into newer shop workflows without re-creating orders or changing stock. Review all measured and artistic instructions before production.</p>
  </div><button type="button" onClick={load} disabled={busy}>{busy?'Working…':'Refresh live audit'}</button></header>
  {message&&<p className="sc-cr-message" role="status">{message}</p>}
  {!state?<section className="card"><p>{busy?'Auditing existing products…':'Readiness data unavailable. Refresh or verify the database migration.'}</p></section>:<>
   <section className="sc-cr-kpis" aria-label="Catalog readiness totals">
    <div><span>Woo product families</span><strong>{fmt(state.totals.families)}</strong></div>
    <div><span>Needs recipe assignment</span><strong>{fmt(state.totals.review)}</strong></div>
    <div><span>Needs physical approval</span><strong>{fmt(state.totals.awaiting_approval)}</strong></div>
    <div><span>Approved family recipes</span><strong>{fmt(state.totals.approved)}</strong></div>
    <div><span>Legacy clients not linked to CRM</span><strong>{fmt(state.totals.crm_unlinked)}</strong></div>
    <div><span>Existing job travelers</span><strong>{fmt(state.totals.existing_travelers)}</strong></div>
   </section>
   <nav className="sc-cr-tabs" aria-label="Readiness views">
    {[['products','Product families'],['recipes','Recipe starter library'],['jobs','Open job travelers'],['clients','Existing clients']].map(([id,label])=>
     <button key={id} type="button" className={tab===id?'active':''} aria-pressed={tab===id} onClick={()=>{setTab(id);setSearch('');}}>{label}</button>)}
   </nav>
   {tab==='products'&&<>
    <section className="card elevated-card sc-cr-info">
     <h2>Bring existing WooCommerce products into the new production process</h2>
     <p><strong>How to use this screen:</strong> 1. Start with products used by open orders. 2. Verify blank-product mapping. 3. Link the right artwork and approved production instructions. 4. Check the result with a real product variation. 5. Review the production work order before releasing production.</p>
     <p><strong>Important:</strong> Open-order counts below are current job demand, not historical WooCommerce sales rankings. Products with no linked jobs or incomplete sync may be missing from those counts. Do not interpret an approved recipe alone as fully production ready.</p>
     <p><Link to="/client-graphics">Review client graphics</Link> · <Link to="/manufacturing-recipes">Production instructions</Link> · <Link to="/work-hub">Work Hub</Link></p>
     <p>Parent-level assignments cover their variations; color, SKU and size remain on the original WooCommerce lines. A family can be flagged for fulfillment only or mapped to a reusable production recipe. No product or inventory record is rewritten.</p>
     {canManage&&<button type="button" disabled={busy} onClick={()=>run({action:'seed_candidates'},r=>`Added ${r.created} review queue records; ${r.existing} already existed.`)}>Generate missing family review assignments</button>}
     <p><small>Classification is inferred from descriptions only. It is not verified decoration-method data.</small></p>
    </section>
    <div className="sc-cr-toolbar">
     <label>Search product, SKU or Woo ID<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search existing product families" /></label>
     <label>Review order<select value={sortMode} onChange={e=>setSortMode(e.target.value)}><option value="attention">Open orders and blockers first</option><option value="demand">Most open units first</option><option value="name">Product name</option></select></label>
     <label>Readiness<select value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="all">All families</option><option value="review">Needs assignment</option>
      <option value="awaiting_approval">Awaiting sample approval</option>
      <option value="approved">Approved recipe linked</option>
      <option value="fulfillment_only">Fulfillment only</option>
     </select></label>
    </div>
    <p className="sc-cr-count">Showing {fmt(filtered.length)} of {fmt(families.length)} WooCommerce parent product families, including unpublished/legacy rows.</p>
    <div className="sc-cr-split"><div className="sc-cr-scroll">
     {filtered.map(f=><button type="button" key={f.woocommerce_product_id} className={'sc-cr-family '+(Number(familyId)===Number(f.woocommerce_product_id)?'chosen':'')} onClick={()=>choose(f)}>
      <strong>{f.product_name||'Unnamed family'} <small>#{f.woocommerce_product_id}</small></strong>
      <span>{fmt(f.row_count)} rows · {fmt(f.variation_count)} variations · {fmt(f.published_rows)} published · {fmt(demand.get(Number(f.woocommerce_product_id))||0)} units in open jobs</span>
      {blockers.has(Number(f.woocommerce_product_id))&&demand.has(Number(f.woocommerce_product_id))&&<em>Open-order production setup needs review</em>}
      <span>{f.classification?.garment||'other'} · Process {f.classification?.method||'Needs review'} · {labels[f.readiness]}</span>
      {Number(f.missing_blank_rows)>0&&<em>{fmt(f.missing_blank_rows)} rows need blank mapping review</em>}
     </button>)}
    </div>
    <section className="card elevated-card sc-cr-detail">
     {!selected?<p>Choose a product family on the left to review its production routing.</p>:<>
      <h2>{titleFor(selected)}</h2>
      <p><strong>Next steps:</strong> Check mappings → verify exact customer artwork → choose approved production instructions → inspect an open-order traveler. This page only links a recipe, it does not certify all artwork and variations.</p>
      <p>In catalog: {fmt(selected.row_count)} rows; {fmt(selected.finished_rows)} marked finished; {fmt(selected.missing_blank_rows)} blank mappings missing.</p>
      <p>Suggested garment: <strong>{selected.classification?.garment}</strong>. Decoration method: <strong>{selected.classification?.method}</strong> (unverified).</p>
      {canManage?<form onSubmit={e=>{e.preventDefault();run({action:'assign',woocommerce_product_id:selected.woocommerce_product_id,disposition,recipe_id:selectedRecipe,notes},()=>`Saved routing for Woo parent #${selected.woocommerce_product_id}.`);}}>
       <label>Handling<select value={disposition} onChange={e=>setDisposition(e.target.value)}>
        <option value="assigned">Needs production recipe</option><option value="fulfillment_only">Fulfillment only — no new manufacturing</option><option value="review">Hold for review</option>
       </select></label>
       {disposition==='assigned'&&<label>Reusable production recipe<select required value={selectedRecipe} onChange={e=>setSelectedRecipe(e.target.value)}>
        <option value="">Select recipe</option>
        {(state.recipes||[]).map(r=><option key={r.id} value={r.id}>{r.name}{approvedRecipeIds.has(r.id)?' ✓ approved':' · pending approval'}</option>)}
       </select></label>}
       <label>Review notes<textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Customer-specific process, exceptions, packaging or missing data" /></label>
       <button disabled={busy} type="submit">Save reviewed assignment</button>
      </form>:<p>Manager role is required to edit routing.</p>}
      <p><Link to="/manufacturing-recipes">Open recipe editor and approve measured sample →</Link></p>
      <p><Link to="/product-blank-mappings">Review product-to-blank mappings →</Link></p>
     </>}
    </section></div>
   </>}
   {tab==='recipes'&&<section className="card elevated-card sc-cr-info">
    <h2>Source-backed DTF placement starters</h2>
    <p>Generate 24 draft recipes across tees, hoodies, sweatshirts and polos, with Adult and Youth sizing and full front, left chest and full back placement. Dimensions are from published DTF examples; no heat-press temperatures or materials are automatically approved.</p>
    <ul>{PLACEMENT_SOURCES.map(s=><li key={s.url}><a href={s.url} rel="noreferrer" target="_blank">{s.name} ↗</a></li>)}</ul>
    <p>Typical starting points: adult full front 10–12 inches wide, top 3–4 inches below the collar seam; youth front 7–9 inches wide, top roughly 2–3 inches below; adult left chest 3–4 inches wide. Actual location changes with garment cut, pockets, seams and artwork proportion.</p>
    {canManage&&<button type="button" disabled={busy} onClick={installStarterLibrary}>{busy?'Initializing starter library…':'Install missing starter library (41 draft recipes)'}</button>}
    <p><small>This installs the 24 DTF placement starters and 17 expanded production starters. Existing names are reused; no recipe is approved, no equipment settings are validated, and existing manufacturing records are left unchanged.</small></p>
    <p><Link to="/manufacturing-recipes">Open Production Recipe Library →</Link></p>
    <h3>Existing recipes ({fmt(state.recipes?.length)})</h3>
    <div className="sc-cr-scroll sc-cr-short">{(state.recipes||[]).map(r=><div className="sc-cr-listline" key={r.id}>
     <span>{r.name}</span><small>{approvedRecipeIds.has(r.id)?'Approved version available':'Draft / needs sample approval'}</small>
    </div>)}{!state.recipes?.length&&<p>No manufacturing templates have been created yet.</p>}</div>
   </section>}
   {tab==='jobs'&&<section className="card elevated-card sc-cr-info">
    <h2>Existing open production jobs</h2>
    <p>Preview uses real open job lines and does not change production state. Only explicitly selected lines with an approved recipe, production artwork reference and linked artwork handoff can be created. Duplicate travelers are blocked by the existing job-line uniqueness constraint.</p>
    <button type="button" disabled={busy} onClick={previewJobs}>{busy?'Checking…':'Preview open jobs (read only)'}</button>
    {previewLoaded&&<><p>{fmt(preview.length)} open lines inspected · {fmt(eligible.length)} potentially eligible.</p>
     <div className="sc-cr-scroll sc-cr-short">{preview.map(row=><label className="sc-cr-job" key={row.job_item_id}>
      <input type="checkbox" disabled={!row.eligible||!canManage} checked={selectedLines.includes(row.job_item_id)}
       onChange={e=>setSelectedLines(old=>e.target.checked?[...old,row.job_item_id]:old.filter(x=>x!==row.job_item_id))}/>
      <span><strong>Job #{row.job_id} · line #{row.job_item_id}</strong> {row.name} · Qty {row.quantity}<small>{row.status}</small></span>
     </label>)}</div>
     {canManage&&<><label className="sc-cr-attest"><input type="checkbox" checked={confirmArtwork} onChange={e=>setConfirmArtwork(e.target.checked)}/>
      I reviewed the selected job lines and verified that the approved artwork, recipe, materials and garment assignments are correct for these customers.
     </label>
     <button type="button" disabled={busy||!confirmArtwork||!selectedLines.length} onClick={async()=>{
       if(!window.confirm(`Generate travelers for ${selectedLines.length} reviewed job lines? This will not change inventory or billing.`))return;
       await run({action:'create_open',job_item_ids:selectedLines,confirm_artwork_verified:true},r=>`Created ${r.created} travelers; ${r.conflicts} duplicates skipped; ${r.errors?.length||0} errors. Refresh preview.`);
       await previewJobs();
     }}>Generate {fmt(selectedLines.length)} reviewed travelers</button></>}
    </>}
    <p><Link to="/production-travelers">Open QR Job Travelers →</Link> · <Link to="/work-hub">Work Hub →</Link></p>
   </section>}
   {tab==='clients'&&<section className="card elevated-card sc-cr-info">
    <h2>Existing client adoption queue</h2>
    <p>This is a read-only reconciliation of existing customer records against CRM accounts linked by customer ID. Name-only similarities are not treated as confirmed matches. No new CRM accounts, customer emails, pricing arrangements or campaigns are created automatically.</p>
    <div className="sc-cr-toolbar">
     <label>Client name or ID<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search existing clients"/></label>
     <label>Status<select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}>
      <option value="unlinked">Not linked to active CRM</option><option value="all">All existing clients</option>
     </select></label>
    </div>
    <button type="button" onClick={downloadCsv}>Export client review CSV</button>
    <p><Link to="/marketing">Review and link an existing client in Marketing CRM →</Link></p>
    <div className="sc-cr-scroll sc-cr-short">{legacy.map(c=><div className="sc-cr-listline" key={c.customer_id}>
     <span><strong>{c.customer_name||'Unnamed customer'}</strong> · #{c.customer_id}<small>{c.has_email?'Email recorded':'Missing email'} · {c.has_phone?'Phone recorded':'Missing phone'} · Last order {c.last_order_at?new Date(c.last_order_at).toLocaleDateString():'unknown'}</small></span>
     <small>{clientNeeds(c)?'CRM linkage needed':c.crm_account_count+' active CRM account(s)'}</small>
    </div>)}{!legacy.length&&<p>No clients in the current filter.</p>}</div>
    <p><small>Limited to first 2,500 customer records returned by the audit, and 300 rows shown here. Export uses the loaded result. Historical customers remain unchanged.</small></p>
   </section>}
  </>}
 </main>;
}
