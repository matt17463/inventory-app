import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {EXPANDED_STARTER_PRESETS,EXPANDED_SOURCES} from './lib/expandedProductionPresets';
import './CatalogModernization.css';

async function request(action,values={}){
 const r=await authenticatedFunctionFetch('/.netlify/functions/legacy-catalog-modernization',{
  method:'POST',body:JSON.stringify({action,...values})});
 const b=await r.json().catch(()=>({}));
 if(!r.ok||!b.success)throw Error(b.message||'Operation failed.');
 return b.data;
}
const fmt=v=>Number(v||0).toLocaleString();
const yes=v=>v?'Verified':'Needs review';
const featureLabels={blank:'Linked blank',recipe:'Approved recipe',artwork:'Approved artwork',pricing:'Pricing rule',mockup:'Approved mockup',supplier:'Supplier',machine:'Machine settings'};
const options=['unreviewed','verified','needs_review'];
const label=v=>String(v||'').replaceAll('_',' ');
const sampleClient=()=>({customer_id:'',account_id:'',evidence:'',confirm:false});
function FieldStatus({name,good}){return <span className={good?'sc-mo-good':'sc-mo-warn'}>{good?'✓':'!'} {name}</span>;}
export default function CatalogModernization(){
 const access=useContext(EmployeeAccessContext);
 const editor=['admin','manager'].includes(access?.role);
 const [tab,setTab]=useState('score');
 const [state,setState]=useState(null);
 const [clients,setClients]=useState(null);
 const [reorders,setReorders]=useState(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState('');
 const [selected,setSelected]=useState('');
 const [pricing,setPricing]=useState('unreviewed'),[mockup,setMockup]=useState('unreviewed'),[supplier,setSupplier]=useState('unreviewed');
 const [reviewNotes,setReviewNotes]=useState(''),[checkConfirm,setCheckConfirm]=useState(false);
 const [client,setClient]=useState(sampleClient);
 const [assetId,setAssetId]=useState(''),[artEvidence,setArtEvidence]=useState(''),[artConfirm,setArtConfirm]=useState(false);
 const [flagNotes,setFlagNotes]=useState('');
 const [reorderItem,setReorderItem]=useState(''),[reorderNotes,setReorderNotes]=useState(''),[reorderConfirm,setReorderConfirm]=useState(false);
 const load=useCallback(async()=>{
  setBusy(true);try{setState(await request('dashboard'));setNotice('Live catalog readiness audit refreshed.');}
  catch(e){setNotice(e.message);}finally{setBusy(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const product=(state?.scores||[]).find(x=>String(x.woocommerce_product_id)===String(selected));
 const choice=(clients?.rows||[]).find(x=>String(x.customer_id)===String(client.customer_id));
 const activeReorder=(reorders||[]).find(x=>String(x.job_item_id)===String(reorderItem));
 const currentArtwork=state?.artwork_links?.find(x=>String(x.woocommerce_product_id)===String(selected));
 const list=useMemo(()=>(state?.scores||[]).filter(x=>[x.product_name,x.woocommerce_product_id,x.example_sku].join(' ').toLowerCase().includes(filter.toLowerCase()))
  .sort((a,b)=>a.score-b.score),[state,filter]);
 async function execute(action,values,format){
  setBusy(true);setNotice('');
  try{const data=await request(action,values);await load();setNotice(format?format(data):'Review saved.');return true;}
  catch(e){setNotice(e.message);return false;}finally{setBusy(false);}
 }
 async function selectTab(value){
  setTab(value);setFilter('');setNotice('');
  if(value==='clients'&&!clients){setBusy(true);try{setClients(await request('client_candidates'));}catch(e){setNotice(e.message);}finally{setBusy(false);}}
  if(value==='reorders'){setBusy(true);try{setReorders(await request('reorder_preview'));}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 }
 function pickProduct(row){
  setSelected(String(row.woocommerce_product_id));
  const review=row.review||{};
  setPricing(review.pricing_status||'unreviewed');setMockup(review.mockup_status||'unreviewed');
  setSupplier(review.supplier_status||'unreviewed');setReviewNotes(review.review_notes||'');
  setCheckConfirm(false);setAssetId(row.artwork?.artwork_asset_id||'');setArtEvidence('');
  setArtConfirm(false);
 }
 async function commitClient(create){
  const query={...client,customer_id:Number(client.customer_id)};
  if(!window.confirm(create?'Create a new CRM account for this verified legacy customer?':'Link this legacy customer to the selected existing CRM account?'))return;
  const ok=await execute(create?'create_client':'link_client',query,r=>'Client '+r.customer_id+' '+r.action+' with CRM account '+r.account_id+'.');
  if(ok){setClients(await request('client_candidates'));setClient(sampleClient());}
 }
 const chosenClients=(clients?.rows||[]).filter(c=>!c.linked_account_id&&[c.name,c.billing_company,c.customer_id].join(' ').toLowerCase().includes(filter.toLowerCase()));
 return <main className="page sc-modernization">
  <header className="page-header"><div><p className="eyebrow">Production · Catalog modernization</p>
   <h1>Product, Artwork & Client Modernization</h1>
   <p>Extend existing products and customers into the latest Skilled Crafting features. No historical orders, inventory, payment information, artwork files or approved recipe snapshots are overwritten.</p>
  </div><button disabled={busy} onClick={load}>{busy?'Working…':'Refresh audit'}</button></header>
  {notice&&<p className="sc-mo-message" role="status">{notice}</p>}
  <section className="sc-mo-kpis">
   <div><small>Existing product families</small><strong>{fmt(state?.totals?.products)}</strong></div>
   <div><small>Fully reviewed products</small><strong>{fmt(state?.totals?.readiness_100)}</strong></div>
   <div><small>Artwork revision flags</small><strong>{fmt(state?.totals?.artwork_review)}</strong></div>
   <div><small>WooCommerce customers</small><strong>{fmt(state?.totals?.customers)}</strong></div>
   <div><small>CRM accounts</small><strong>{fmt(state?.totals?.crm_accounts)}</strong></div>
  </section>
  <nav className="sc-mo-tabs" aria-label="Modernization workspaces">
   {[['score','Readiness scoring'],['artwork','Shared artwork'],['clients','Client migration'],['reorders','Reorder comparison'],['recipes','Expanded recipe starters']].map(([k,v])=>
    <button key={k} aria-pressed={tab===k} className={tab===k?'active':''} onClick={()=>selectTab(k)}>{v}</button>)}
  </nav>
  {(tab==='score'||tab==='artwork')&&<>
   <div className="sc-mo-filter"><label>Find a WooCommerce product family<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Product name, ID or SKU"/></label>
    <p>Evidence-based scores: seven required checks. A green check means documented verification, not that all business details have been re-audited today.</p></div>
   <div className="sc-mo-layout"><section className="sc-mo-list" aria-label="Catalog families">
    {list.map(p=><button key={p.woocommerce_product_id} className={selected===String(p.woocommerce_product_id)?'active':''} onClick={()=>pickProduct(p)}>
     <strong>{p.product_name||'Untitled product'}</strong>
     <span>Woo #{p.woocommerce_product_id} · {fmt(p.row_count)} catalog rows · <b>{p.score}%</b> ready</span>
     <span>{Object.values(p.flags||{}).filter(Boolean).length}/7 evidence checks</span>
    </button>)}
   </section>
   <section className="card elevated-card sc-mo-detail">
    {!product?<p>Choose a product family for the current score and actionable review controls.</p>:<>
     <h2>{product.product_name||'Product'} <small>#{product.woocommerce_product_id}</small></h2>
     <p><strong>Readiness: {product.score}%</strong>. Evidence is checked per parent family; verify variations individually when decoration or pricing differs.</p>
     <div className="sc-mo-flags">{Object.entries(featureLabels).map(([k,v])=><FieldStatus key={k} name={v} good={product.flags?.[k]}/>)}</div>
     {tab==='score'&&<>
      <p>Blank, recipe, artwork and machine checks are derived from existing links. Pricing, mockup and supplier signoffs are deliberately manual because merely having a product image or supplier name does not prove approval.</p>
      {editor?<form onSubmit={e=>{e.preventDefault();execute('save_checklist',{
       woocommerce_product_id:product.woocommerce_product_id,pricing_status:pricing,mockup_status:mockup,
       supplier_status:supplier,review_notes:reviewNotes,confirm:checkConfirm
      },()=> 'Feature review saved and score recalculated.');}}>
       <div className="sc-mo-form-grid">{[['Pricing rules',pricing,setPricing],['Mockup and visual approval',mockup,setMockup],['Supplier verification',supplier,setSupplier]].map(([name,value,change])=>
        <label key={name}>{name}<select value={value} onChange={e=>{change(e.target.value);setCheckConfirm(false);}}>
         {options.map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label>)}</div>
       <label>What did you verify?<textarea value={reviewNotes} rows="3" onChange={e=>setReviewNotes(e.target.value)} placeholder="Approved quote version, mockup/client proof reference, verified supplier SKU/pricing..."/></label>
       <label className="sc-mo-check"><input type="checkbox" checked={checkConfirm} onChange={e=>setCheckConfirm(e.target.checked)}/> I reviewed the underlying source evidence.</label>
       <button disabled={busy||!checkConfirm}>Save readiness review</button>
      </form>:<p>Manager access required to change verification states.</p>}
      <p><Link to="/pricing-rules">Pricing Rules</Link> · <Link to="/mockup-studio">Mockup Studio</Link> · <Link to="/supplier-catalog">Supplier Catalog</Link> · <Link to="/catalog-production-readiness">Recipe assignments</Link></p>
     </>}
     {tab==='artwork'&&<>
      <p>Share one exact locked, preflight-passed artwork file across multiple product families. Each link requires explicit proof of client approval. A changed linked artwork asset automatically flags those families for re-review.</p>
      {currentArtwork&&<div className="sc-mo-current"><b>Linked asset:</b> {currentArtwork.artwork_asset_id}
       <p><FieldStatus name={currentArtwork.review_required?'Revision / proof review required':'Artwork link reviewed'} good={!currentArtwork.review_required}/></p>
       {currentArtwork.review_reason&&<p>{currentArtwork.review_reason}</p>}</div>}
      <p>{fmt(state?.assets?.length)} technically preflight-passed, exact-locked artwork assets available.</p>
      {editor?<form onSubmit={async e=>{e.preventDefault();
       if(!window.confirm('Confirm you personally verified the exact locked file and customer approval for this product?'))return;
       await execute('link_artwork',{woocommerce_product_id:product.woocommerce_product_id,
        artwork_asset_id:assetId,approval_evidence:artEvidence,confirm:artConfirm},r=> 'Artwork linked to Woo product '+r.woocommerce_product_id+'.');
      }}>
       <label>Shared artwork asset<select required value={assetId} onChange={e=>setAssetId(e.target.value)}>
        <option value="">Select locked production artwork</option>
        {(state?.assets||[]).map(a=><option key={a.id} value={a.id}>{a.artwork_name||'Artwork'} · {a.id.slice(0,8)}</option>)}
       </select></label>
       <label>Client approval evidence<textarea rows="3" value={artEvidence} onChange={e=>setArtEvidence(e.target.value)}
        placeholder="Approval date, who approved, proof reference / review event"/></label>
       <label className="sc-mo-check"><input type="checkbox" checked={artConfirm} onChange={e=>setArtConfirm(e.target.checked)}/> I checked approval rights, exact artwork, printing size and the linked product.</label>
       <button disabled={busy||!assetId||!artConfirm}>Link / reapprove exact artwork</button>
      </form>:<p>Artwork changes require manager access.</p>}
      {editor&&currentArtwork&&<div className="sc-mo-secondary">
       <h3>Report an updated source artwork</h3>
       <label>Change note<input value={flagNotes} onChange={e=>setFlagNotes(e.target.value)} placeholder="New team colors, revised crest, replacement file..."/></label>
       <button disabled={busy} onClick={()=>{
        if(window.confirm('Flag every product linked to this source asset for fresh approval?'))
         execute('flag_artwork_revision',{artwork_asset_id:currentArtwork.artwork_asset_id,notes:flagNotes},
          r=>r.flagged+' linked product families flagged for re-review.');
       }}>Flag linked products for artwork reapproval</button>
      </div>}
      <p><Link to="/artwork-preflight">Artwork Preflight</Link> · <Link to="/mockup-studio">Customer proofs</Link></p>
     </>}
    </>}
   </section></div>
  </>}
  {tab==='clients'&&<section className="card elevated-card sc-mo-wide">
   <h2>Existing client migration assistant</h2>
   <p>Possible matches use exact organization names and exact contact emails. Multiple matches are labeled ambiguous, and there is no automatic merging. Historical WooCommerce customer records and orders are never rewritten.</p>
   <div className="sc-mo-actions"><button disabled={busy} onClick={async()=>{setBusy(true);try{setClients(await request('client_candidates'));setNotice('Potential links refreshed.');}catch(e){setNotice(e.message)}finally{setBusy(false)}}}>Refresh client matches</button>
    <label>Filter clients<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Customer name or ID"/></label></div>
   {clients&&<p>{fmt(clients.summary?.unlinked)} unlinked of {fmt(clients.summary?.total)} existing clients; {fmt(clients.summary?.ambiguous)} ambiguous candidates.</p>}
   <div className="sc-mo-layout">
    <div className="sc-mo-list">{chosenClients.slice(0,350).map(c=><button key={c.customer_id} className={String(client.customer_id)===String(c.customer_id)?'active':''}
     onClick={()=>setClient({customer_id:c.customer_id,account_id:c.candidates[0]?.id||'',evidence:'',confirm:false})}>
      <strong>{c.billing_company||c.name||'Unnamed customer'}</strong><span>Legacy #{c.customer_id} · {c.candidates.length} possible CRM matches {c.ambiguous?'· AMBIGUOUS':''}</span>
     </button>)}</div>
    <div className="sc-mo-detail">
     {!choice?<p>Select an unlinked customer to review possible existing CRM matches.</p>:<>
      <h3>{choice.billing_company||choice.name} · legacy #{choice.customer_id}</h3>
      <p>{choice.candidates.length} suggestions. Review identities directly; an email or name match alone is not ownership proof.</p>
      {choice.candidates.map(a=><p key={a.id}>Possible match: <strong>{a.organization}</strong> ({a.signals.join(' + ')}) {a.customer_id?'· already linked':'· unlinked'}</p>)}
      {editor?<div className="sc-mo-form-grid">
       <label>Existing CRM account<select value={client.account_id} onChange={e=>setClient(x=>({...x,account_id:e.target.value,confirm:false}))}>
        <option value="">Choose CRM account</option>
        {(clients.accounts||[]).filter(a=>!a.customer_id).map(a=><option value={a.id} key={a.id}>{a.organization}</option>)}
       </select></label>
       <label>Identity / duplicate review evidence<textarea rows="4" value={client.evidence} onChange={e=>setClient(x=>({...x,evidence:e.target.value}))}
        placeholder="Matched school/company and primary contact; reviewed similar names; verified that they are the same business"/></label>
       <label className="sc-mo-check"><input type="checkbox" checked={client.confirm} onChange={e=>setClient(x=>({...x,confirm:e.target.checked}))}/> I checked for duplicates, confirmed the organization identity and have permission to link the records.</label>
       <div className="sc-mo-actions"><button disabled={busy||!client.confirm||!client.account_id} onClick={()=>commitClient(false)}>Link reviewed existing CRM account</button>
        <button disabled={busy||!client.confirm||Boolean(choice.candidates.length)} onClick={()=>commitClient(true)}>Create reviewed CRM account</button></div>
       {choice.candidates.length>0&&<small>New-account creation is blocked while candidates exist. Resolve possible duplicates by linking or manual review.</small>}
      </div>:<p>Only managers can link client records.</p>}
     </>}
    </div>
   </div><p><Link to="/marketing">Open Marketing CRM →</Link></p>
  </section>}
  {tab==='reorders'&&<section className="card elevated-card sc-mo-wide">
   <h2>Safe reorder comparison</h2>
   <p>Matches must have a previously issued traveler for the same customer and SKU. It compares garment, placement, artwork, material-setting evidence, and available finished stock. Matching is advisory only; no automatic production, billing or inventory action follows.</p>
   <button disabled={busy} onClick={async()=>{setBusy(true);try{setReorders(await request('reorder_preview'));setNotice('Open reorder candidates refreshed.');}catch(e){setNotice(e.message)}finally{setBusy(false)}}}>Refresh open-order comparisons</button>
   <div className="sc-mo-layout"><div className="sc-mo-list">
    {(reorders||[]).map(row=><button key={row.job_item_id} className={String(row.job_item_id)===String(reorderItem)?'active':''}
     onClick={()=>{setReorderItem(String(row.job_item_id));setReorderNotes('');setReorderConfirm(false)}}>
     <strong>{row.customer_name||'Customer'} · Job #{row.job_id}</strong>
     <span>Line #{row.job_item_id} · {row.status} · {row.differences.length} exception(s)</span>
    </button>)}
    {reorders?.length===0&&<p>No active job items. Historical records are unchanged.</p>}
   </div><div className="sc-mo-detail">
    {activeReorder?<><h3>Reorder line #{activeReorder.job_item_id}</h3>
     <p>{activeReorder.status}. Historical verified traveler: {activeReorder.source_traveler_id||'Not found'}.</p>
     <ul>{activeReorder.differences.map(x=><li key={x}>{x}</li>)}</ul>
     {editor&&activeReorder.source_traveler_id&&<>
      <label>Reorder review and approval evidence<textarea rows="3" value={reorderNotes} onChange={e=>setReorderNotes(e.target.value)} /></label>
      <label className="sc-mo-check"><input type="checkbox" checked={reorderConfirm} onChange={e=>setReorderConfirm(e.target.checked)}/> I compared customer specifications, artwork, garment and machine requirements and will resolve exceptions before production.</label>
      <div className="sc-mo-actions">{[['confirmed','Confirm reviewed specification'],['rejected','Reject reuse / new specification required']].map(([k,t])=>
       <button key={k} disabled={busy||!reorderConfirm||reorderNotes.trim().length<12}
        onClick={async()=>{const ok=await execute('save_reorder',{job_item_id:activeReorder.job_item_id,source_traveler_id:activeReorder.source_traveler_id,
         decision:k,review_notes:reorderNotes,confirm:true},r=>'Review recorded for line '+r.job_item_id+'.');
         if(ok)setReorders(await request('reorder_preview'));}}>
        {t}</button>)}</div>
      {activeReorder.decision==='confirmed'&&activeReorder.differences.length===0&&
       <button disabled={busy} onClick={async()=>{
        if(!window.confirm('Generate a new immutable traveler using the approved recipe, only after verifying the current job artwork handoff?'))return;
        const ok=await execute('create_reorder_traveler',{job_item_id:activeReorder.job_item_id,confirm:true},
         r=>'Reorder traveler created: '+r.traveler_id+'. No inventory or billing changed.');
        if(ok)setReorders(await request('reorder_preview'));
       }}>Create traveler from reviewed approved recipe</button>}
     </>}
    </>:<p>Choose a job line to inspect the exact historical manufacturing evidence.</p>}
   </div></div><p><Link to="/customer-reorders">Historical reorder signals →</Link> · <Link to="/production-travelers">Travelers →</Link></p>
  </section>}
  {tab==='recipes'&&<section className="card elevated-card sc-mo-wide">
   <h2>17 new substrate-specific, unapproved starter recipes</h2>
   <p>These supplement the original 24 DTF garment placement presets. They cover sublimation, HTV, UV/patches, metal and wood laser processes, and Roland BN2-30 print/cut. Equipment settings are intentionally blank pending calibration.</p>
   <div className="sc-mo-template-grid">{EXPANDED_STARTER_PRESETS.map(t=><div key={t.key}><strong>{t.name}</strong>
    <small>{t.production_notes}</small></div>)}</div>
   {editor&&<button disabled={busy} onClick={()=>execute('seed_expanded_recipes',{},
    r=>'Created '+r.created+' draft recipes; '+r.reused+' already existed. Physical sample approval remains required.')}>Generate missing expanded draft recipes</button>}
   <p><Link to="/manufacturing-recipes">Review and approve physical test samples in Recipe Library →</Link></p>
   <h3>Supplier and manufacturer references</h3>
   <ul>{EXPANDED_SOURCES.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>)}</ul>
  </section>}
 </main>;
}
