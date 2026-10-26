import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import GarmentPlacementGuide from './components/GarmentPlacementGuide';
import LocalQrCode from './components/LocalQrCode';
import './ProductionTravelers.css';
import { signedAssetUrl } from './lib/mockupStudioApi';
import {validateTravelerGraphicReadiness} from './lib/travelerGraphicReadiness';
import {graphicCompatibilityState} from './lib/graphicCompatibility';

const eventKinds=[
  ['note','Work note'],['placement_checked','Placement measured / checked'],
  ['batch_started','Production batch started'],['batch_finished','Batch finished'],
  ['packing_checked','Packing instructions checked'],['exception','Blocker / problem reported'],
];
const display=(value)=>String(value||'').replaceAll('_',' ');
const itemLabel=(item)=>item?.ordered_product_name||item?.item_name||item?.name||item?.order_sku||('Line '+item?.id);
const safeError=(err)=>err?.message||'Could not load production traveler.';
export default function ProductionTravelers() {
  const {travelerId}=useParams();
  const [params]=useSearchParams();
  const navigate=useNavigate();
  const access=useContext(EmployeeAccessContext);
  const editable=['admin','manager','operator'].includes(access?.role);
  const [jobs,setJobs]=useState([]);
  const [jobId,setJobId]=useState(()=>/^\d+$/.test(params.get('job')||'')?params.get('job'):'');
  const [items,setItems]=useState([]);
  const [travelerList,setTravelerList]=useState([]);
  const [recipeVersions,setRecipeVersions]=useState([]);
  const [readinessAssets,setReadinessAssets]=useState([]);
  const [legacyArtVerified,setLegacyArtVerified]=useState(false);
  const [orderGraphicCheck,setOrderGraphicCheck]=useState({channel:'manual',loading:false,selections:[],unmapped_line_ids:[],error:''});
  const [recipes,setRecipes]=useState([]);
  const [selectedItemIds,setSelectedItemIds]=useState([]);
  const [travelerLines,setTravelerLines]=useState([]);
  const [claimedItemIds,setClaimedItemIds]=useState([]);
  const [versionId,setVersionId]=useState('');
  const [selected,setSelected]=useState(null);
  const [events,setEvents]=useState([]);
  const [eventKind,setEventKind]=useState('note');
  const [eventText,setEventText]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [savedJob,setSavedJob]=useState(null);
  const [placementArtworks,setPlacementArtworks]=useState({});
  const [artwork,setArtwork]=useState(null);
  const [artworkUrl,setArtworkUrl]=useState('');
  const [assignmentAssets,setAssignmentAssets]=useState([]);
  const [lineAssignments,setLineAssignments]=useState({});
  const [draftAssignments,setDraftAssignments]=useState({});

  const loadIndex=useCallback(async()=>{
    const [a,b,c]=await Promise.all([
      supabase.from('jobs').select('id,customer_name,job_name,woocommerce_order_id,due_date,status').order('created_at',{ascending:false}).limit(250),
      supabase.from('sc_manufacturing_recipes').select('id,name,garment_type,decoration_method').order('created_at',{ascending:false}).limit(250),
      supabase.from('sc_manufacturing_recipe_versions').select('id,recipe_id,revision,status,placements,packaging,artwork_asset_id').eq('status','approved').order('created_at',{ascending:false}).limit(400),
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;
    setJobs(a.data||[]);setRecipes(b.data||[]);setRecipeVersions(c.data||[]);
  },[]);
  const loadForJob=useCallback(async(id)=>{
    if(!id) {setItems([]);setTravelerList([]);return;}
    const [a,b,c]=await Promise.all([
      supabase.from('job_items').select('id,job_id,quantity,order_sku,sku,ordered_product_name,item_name,name,size,color,brand,product_type,placement,status').eq('job_id',id).order('id'),
      supabase.from('sc_job_travelers').select('id,job_item_id,job_id,created_at,recipe_version_id').eq('job_id',id).order('created_at',{ascending:false}),
      supabase.from('sc_job_traveler_lines').select('traveler_id,job_item_id,quantity').order('job_item_id'),
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;
    const groupIds=new Set((b.data||[]).map(t=>t.id));
    const claimed=[...(c.data||[]).filter(x=>groupIds.has(x.traveler_id)).map(x=>Number(x.job_item_id)),...(b.data||[]).map(x=>Number(x.job_item_id))];
    setItems(a.data||[]);setTravelerList(b.data||[]);setClaimedItemIds(claimed);
    setSelectedItemIds([]);
  },[]);
  const loadTraveler=useCallback(async(id)=>{
    if(!id) {setSelected(null);setEvents([]);return;}
    const {data,error}=await supabase.from('sc_job_travelers')
      .select('id,job_id,job_item_id,recipe_version_id,recipe_snapshot,ordered_quantity,created_at').eq('id',id).single();
    if(error)throw error;
    const [ev,job,lines]=await Promise.all([
      supabase.from('sc_job_traveler_events').select('id,kind,details,created_at').eq('traveler_id',id).order('created_at'),
      supabase.from('jobs').select('id,customer_name,job_name,due_date,status,woo_order_number').eq('id',data.job_id).single(),
      supabase.from('sc_job_traveler_lines').select('job_item_id,quantity,item_snapshot').eq('traveler_id',id).order('job_item_id'),
    ]);
    if(ev.error)throw ev.error;if(job.error)throw job.error;if(lines.error)throw lines.error;
    setTravelerLines(lines.data||[]);
    setSelected(data);setEvents(ev.data||[]);setSavedJob(job.data);setJobId(String(data.job_id));
    setArtwork(null);setArtworkUrl('');
    setPlacementArtworks({});
    const locationIds=[...new Set((data.recipe_snapshot?.placements||[]).map(p=>p.artwork_asset_id).filter(Boolean))];
    if(locationIds.length){
      const {data:locationAssets,error:locationError}=await supabase.from('mockup_artwork_assets').select('*').in('id',locationIds);
      if(!locationError&&locationAssets?.length){
        const entries=await Promise.all(locationAssets.map(async asset=>[asset.id,{name:asset.artwork_name,url:await signedAssetUrl(asset,3600,{preferPreview:false}).catch(()=>'')}]));
        setPlacementArtworks(Object.fromEntries(entries));
      }
    }

    const sourceId=data.recipe_snapshot?.artwork_asset_id;
    if(sourceId) {
      const result=await supabase.from('mockup_artwork_assets').select('*').eq('id',sourceId).maybeSingle();
      if(result.data) {
        setArtwork(result.data);
        signedAssetUrl(result.data,3600,{preferPreview:false}).then(setArtworkUrl).catch(()=>setArtworkUrl(''));
      }
    }
  },[]);
  useEffect(()=>{loadIndex().catch(e=>setMessage(safeError(e)));},[loadIndex]);
  useEffect(()=>{if(!jobId||travelerId)return;loadForJob(jobId).catch(e=>setMessage(safeError(e)));},[jobId,travelerId,loadForJob]);
  useEffect(()=>{if(travelerId)loadTraveler(travelerId).catch(e=>setMessage(safeError(e)));else {setSelected(null);setEvents([]);}},[travelerId,loadTraveler]);
  const chosenItems=items.filter(x=>selectedItemIds.includes(Number(x.id)));
  const selectedQuantity=chosenItems.reduce((sum,x)=>sum+Number(x.quantity||0),0);
  const selectableVersions=useMemo(()=>recipeVersions.map(v=>({
    ...v,recipe:recipes.find(r=>r.id===v.recipe_id),
  })),[recipeVersions,recipes]);
  const snap=selected?.recipe_snapshot||{};
  const qr=selected?window.location.origin+'/production-travelers/'+encodeURIComponent(selected.id):'';

  const chosenRecipe=recipeVersions.find(x=>x.id===versionId);
  const needsLineArtwork=(chosenRecipe?.placements||[]).filter(p=>!p.artwork_asset_id&&!chosenRecipe?.artwork_asset_id);
  useEffect(()=>{
    if(!needsLineArtwork.length||!selectedItemIds.length||!versionId){setLineAssignments({});return;}
    let cancelled=false;
    (async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw Error('Sign in to view job artwork approvals');
      const rows=await Promise.all(selectedItemIds.map(async id=>{
        const qs=new URLSearchParams({recipe_version_id:versionId,job_item_id:String(id)});
        const res=await fetch('/.netlify/functions/job-line-placement-artwork?'+qs,{headers:{Authorization:'Bearer '+session.access_token}});
        const body=await res.json();if(!res.ok)throw Error(body.message||'Artwork approvals unavailable');
        return [id,body.assignments||[]];
      }));
      if(!cancelled)setLineAssignments(Object.fromEntries(rows));
    })().catch(e=>{if(!cancelled)setMessage(safeError(e));});
    return ()=>{cancelled=true;};
  },[versionId,selectedItemIds,needsLineArtwork.length]);
  useEffect(()=>{
    if(!needsLineArtwork.length)return;
    supabase.from('mockup_artwork_assets').select('id,artwork_name,preflight_status')
     .in('preflight_status',['passed','approved','ready']).limit(500)
     .then(({data,error})=>{if(!error)setAssignmentAssets(data||[]);});
  },[needsLineArtwork.length]);
  const placementReady=chosenItems.every(item=>needsLineArtwork.every(p=>
    (lineAssignments[item.id]||[]).some(a=>a.placement_name===p.placement_name)));
  async function approveLineArtwork(itemId,placement){
    const key=itemId+':'+placement;
    const assetId=draftAssignments[key];
    if(!assetId)throw Error('Select an approved artwork file');
    setBusy(true);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw Error('Employee sign-in required');
      const res=await fetch('/.netlify/functions/job-line-placement-artwork',{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({job_item_id:Number(itemId),recipe_version_id:versionId,placement_name:placement,artwork_asset_id:assetId})
      });
      const body=await res.json();if(!res.ok)throw Error(body.message||'Could not approve artwork');
      const qs=new URLSearchParams({recipe_version_id:versionId,job_item_id:String(itemId)});
      const fresh=await fetch('/.netlify/functions/job-line-placement-artwork?'+qs,{headers:{Authorization:'Bearer '+session.access_token}});
      const value=await fresh.json();if(!fresh.ok)throw Error(value.message||'Approval lookup failed');
      setLineAssignments(prev=>({...prev,[itemId]:value.assignments||[]}));
      setMessage('Approved placement artwork saved');
    }catch(e){setMessage(safeError(e));}finally{setBusy(false);}
  }
  const readiness=validateTravelerGraphicReadiness({items:chosenItems,recipeVersion:chosenRecipe,artworkAssets:readinessAssets,selections:orderGraphicCheck.selections,lineArtworkByItem:lineAssignments});
  const graphicMode=graphicCompatibilityState(orderGraphicCheck);
  const graphicsBlocked=graphicMode.blocked || (graphicMode.legacy && !legacyArtVerified);
  useEffect(()=>{
    const ids=[...new Set([chosenRecipe?.artwork_asset_id,...(chosenRecipe?.placements||[]).map(p=>p.artwork_asset_id),...Object.values(lineAssignments).flat().map(a=>a.artwork_asset_id)].filter(Boolean))];
    if(!ids.length){setReadinessAssets([]);return;}
    let cancelled=false;
    supabase.from('mockup_artwork_assets').select('id,preflight_status').in('id',ids).then(({data,error})=>{
      if(!cancelled)setReadinessAssets(error?[]:(data||[]));
    });
    return ()=>{cancelled=true;};
  },[chosenRecipe,lineAssignments]);
  useEffect(()=>{
    setLegacyArtVerified(false);
    if(!jobId||!selectedItemIds.length){setOrderGraphicCheck({channel:'manual',loading:false,selections:[],unmapped_line_ids:[],error:''});return;}
    let cancelled=false;
    setOrderGraphicCheck({channel:'manual',loading:true,selections:[],unmapped_line_ids:[],error:''});
    (async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw Error('Employee sign-in required');
      const response=await fetch('/.netlify/functions/traveler-graphic-selections',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({job_id:Number(jobId),job_item_ids:selectedItemIds})});
      const result=await response.json();if(!response.ok)throw Error(result.message||'Order graphic lookup failed');
      if(!cancelled)setOrderGraphicCheck({channel:result.channel||'manual',loading:false,selections:result.selections||[],unmapped_line_ids:result.unmapped_line_ids||[],error:''});
    })().catch(e=>{if(!cancelled)setOrderGraphicCheck({channel:'manual',loading:false,selections:[],unmapped_line_ids:[],error:e.message});});
    return ()=>{cancelled=true};
  },[jobId,selectedItemIds]);
  async function createTraveler(){
    setBusy(true);setMessage('');
    try{
      if(!jobId||!selectedItemIds.length||!versionId)throw Error('Choose at least one job line and an approved recipe version.');
      if(graphicsBlocked)throw Error(graphicMode.legacy?'Confirm the legacy order artwork before creating the traveler.':graphicMode.message);
      if(!readiness.ready)throw Error(readiness.blockers.join('; '));
      const {data:auth,error:e}=await supabase.auth.getUser();
      if(e||!auth.user)throw Error('Sign in to create a traveler.');
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw Error('Sign in again to verify artwork files.');
      const preflightResponse=await fetch('/.netlify/functions/traveler-artwork-preflight',{
        method:'POST',
        headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({recipe_version_id:versionId,job_id:Number(jobId),job_item_ids:selectedItemIds}),
      });
      const preflight=await preflightResponse.json().catch(()=>({}));
      if(!preflightResponse.ok||preflight.verified!==true)
        throw Error(preflight.message||'Production artwork files could not be verified.');
      const {data,error}=await supabase.rpc('sc_create_grouped_traveler',{
        p_job_id:Number(jobId),p_job_item_ids:selectedItemIds,p_recipe_version_id:versionId,
      });
      if(error)throw error;
      navigate('/production-travelers/'+data);
    }catch(e){setMessage(safeError(e));}finally{setBusy(false);}
  }
  async function addEvent(){
    if(!selected||!eventText.trim())return;
    setBusy(true);setMessage('');
    try{
      const {data:auth,error:e}=await supabase.auth.getUser();
      if(e||!auth.user)throw Error('Sign in to save work notes.');
      const {error}=await supabase.from('sc_job_traveler_events').insert({
        traveler_id:selected.id,kind:eventKind,details:eventText.trim(),actor_id:auth.user.id,
      });
      if(error)throw error;
      setEventText('');
      await loadTraveler(selected.id);
      setMessage('Work note recorded. Production Board and stock counts were not changed.');
    }catch(e){setMessage(safeError(e));}finally{setBusy(false);}
  }
  return <main className="page sc-travelers">
    <div className="page-header sc-traveler-no-print"><div><p className="eyebrow">Manufacturing · Scannable production forms</p>
      <h1>Digital Job Travelers</h1>
      <p>Attach an approved recipe revision to one or more lines from the same job. Scan the printed QR to reopen the permanent recipe snapshot.</p></div>
      <div className="sc-traveler-top-actions"><Link to="/work-hub">Work Hub</Link><Link to="/manufacturing-recipes">Recipe Library</Link>{selected&&<button type="button" onClick={()=>window.print()}>Print / Save PDF</button>}</div>
    </div>
    {message&&<p role="status" className="message sc-traveler-no-print">{message}</p>}
    {!travelerId&&<div className="sc-traveler-columns">
      <section className="card elevated-card">
        <h2>Select the existing client job</h2>
        <label>Production job<select value={jobId} onChange={e=>{setJobId(e.target.value);setSelectedItemIds([]);}}>
          <option value="">Choose job</option>
          {jobs.map(j=><option key={j.id} value={j.id}>#{j.id} · {j.customer_name} · {j.job_name}</option>)}
        </select></label>
        {jobId&&<div><h3>Select order lines for this traveler</h3><div className="sc-traveler-items">
          {items.map(item=><label key={item.id} className="sc-traveler-radio">
            <input type="checkbox" value={item.id} checked={selectedItemIds.includes(Number(item.id))}
              onChange={e=>setSelectedItemIds(old=>e.target.checked?[...old,Number(item.id)]:old.filter(x=>x!==Number(item.id)))}
              disabled={claimedItemIds.includes(Number(item.id))} />
            <span>{itemLabel(item)} · {item.color||''} {item.size||''} · Qty {item.quantity}
              {claimedItemIds.includes(Number(item.id))?' — traveler exists':''}</span>
          </label>)}
          {!items.length&&<p>There are no linked production line items for this job.</p>}
        </div></div>}
        {jobId&&<div><h3>Existing travelers</h3>
          {travelerList.map(t=><p key={t.id}><Link to={'/production-travelers/'+t.id}>Open traveler (primary line #{t.job_item_id}) →</Link></p>)}
          {!travelerList.length&&<p>No traveler has been created yet.</p>}
        </div>}
      </section>
      <section className="card elevated-card">
        <h2>Create a QR production form</h2>
        {chosenItems.length?<p><strong>{chosenItems.length} order lines</strong> · {selectedQuantity} total garments selected</p>:<p>Select all compatible job lines that share this exact approved recipe and artwork.</p>}
        <label>Physically approved recipe revision<select value={versionId} onChange={e=>setVersionId(e.target.value)}>
          <option value="">Choose an approved version</option>
          {selectableVersions.map(v=><option key={v.id} value={v.id}>{v.recipe?.name||'Recipe'} — Rev {v.revision}, {v.recipe?.garment_type||''}</option>)}
        </select></label>
        {versionId&&<p>Approval-backed recipe selections are preserved on the traveler, including saved decoration placements, process steps and packaging instructions.</p>}
        {versionId&&readiness.blockers.length>0&&<div role="alert"><strong>Production artwork checks:</strong><ul>{readiness.blockers.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
        {selectedItemIds.length>0&&orderGraphicCheck.loading&&<p>Checking saved customer graphic selections…</p>}
        {selectedItemIds.length>0&&!orderGraphicCheck.loading&&<p role={graphicsBlocked?'alert':'status'}>{graphicMode.message}</p>}
        {selectedItemIds.length>0&&!orderGraphicCheck.loading&&!orderGraphicCheck.error&&graphicMode.legacy&&<label><input type="checkbox" checked={legacyArtVerified} onChange={e=>setLegacyArtVerified(e.target.checked)}/> I verified the legacy customer artwork and approved recipe against the original order. This is not an automatic graphic mapping.</label>}
        {needsLineArtwork.length>0&&<section aria-label="Job-specific artwork approvals">
          <h3>Approved artwork for this job</h3>
          <p>Generic recipes use these exact files for each decoration position. A manager must approve each required position before a traveler can be created.</p>
          {chosenItems.map(item=><div key={item.id}>
            <strong>{itemLabel(item)}</strong>
            {needsLineArtwork.map(p=>{
              const key=item.id+':'+p.placement_name;
              const current=(lineAssignments[item.id]||[]).find(a=>a.placement_name===p.placement_name);
              return <div key={key}>
                <label>{display(p.placement_name)} — {current?'Approved':'Approval needed'}
                  {['admin','manager'].includes(access?.role)&&<select value={draftAssignments[key]||current?.artwork_asset_id||''} onChange={e=>setDraftAssignments(prev=>({...prev,[key]:e.target.value}))}>
                    <option value="">Choose approved artwork</option>
                    {assignmentAssets.map(a=><option key={a.id} value={a.id}>{a.artwork_name||a.id}</option>)}
                  </select>}
                </label>
                {['admin','manager'].includes(access?.role)&&<button type="button" disabled={busy||!draftAssignments[key]} onClick={()=>approveLineArtwork(item.id,p.placement_name)}>Approve position</button>}
              </div>;
            })}
          </div>)}
        </section>}
        {editable?<button type="button" disabled={busy||!jobId||!selectedItemIds.length||!versionId||!readiness.ready||graphicsBlocked||!placementReady}
          onClick={createTraveler}>{busy?'Saving…':'Create grouped traveler'}</button>:<p>Read-only access: an operations user creates travelers.</p>}
        <p><small>Creating a traveler records manufacturing instructions only; it does not move inventory, complete a pull sheet, charge a customer or change WooCommerce status.</small></p>
        <Link to="/manufacturing-recipes">Need a recipe? Create or approve one →</Link>
      </section>
    </div>}
    {travelerId&&(selected?<article className="sc-traveler-paper">
      <header className="sc-traveler-paper-header">
        <div><p className="sc-traveler-brand">SKILLED CRAFTING · PRODUCTION TRAVELER</p>
          <h2>{savedJob?.customer_name||'Customer job'}</h2>
          <p>Job #{selected.job_id} · {travelerLines.length||1} production line(s) · {snap.item_name||'Production'}</p>
          <p><strong>Quantity:</strong> {travelerLines.length?travelerLines.reduce((n,x)=>n+Number(x.quantity||0),0):selected.ordered_quantity} · <strong>Deadline:</strong> {savedJob?.due_date||'Not specified'}</p>
          <p><strong>Saved recipe revision:</strong> #{snap.revision} · <strong>Source approved:</strong> {snap.approved_at?new Date(snap.approved_at).toLocaleString():'Not recorded'}</p></div>
        <div className="sc-traveler-qr"><LocalQrCode size={176} value={qr} label="Scannable authenticated job traveler" /><small>Scan to reopen recipe</small></div>
      </header>
      <section>
        <h3>Garment and decoration</h3>
        <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Order line</th><th>Item / SKU</th><th>Color</th><th>Size</th><th>Qty</th></tr></thead><tbody>{(travelerLines.length?travelerLines:[{job_item_id:selected.job_item_id,quantity:selected.ordered_quantity,item_snapshot:{name:snap.item_name,sku:snap.blank?.sku,color:snap.blank?.color,size:snap.blank?.size}}]).map(line=><tr key={line.job_item_id}><td>#{line.job_item_id}</td><td>{line.item_snapshot?.name||'Item'} · {line.item_snapshot?.sku||''}</td><td>{line.item_snapshot?.color||''}</td><td>{line.item_snapshot?.size||''}</td><td>{line.quantity}</td></tr>)}</tbody></table>
        {travelerLines.some(line=>(line.item_snapshot?.approved_placement_artwork||[]).length>0)&&<div className="sc-traveler-machine">
          <h4>Approved per-line artwork and saved placement measurements</h4>
          {travelerLines.map(line=>(line.item_snapshot?.approved_placement_artwork||[]).length>0&&<div key={line.job_item_id}>
            <strong>Order line #{line.job_item_id}</strong>
            <ul>{line.item_snapshot.approved_placement_artwork.map(approval=>{
              const placement=(snap.placements||[]).find(p=>p.placement_name===approval.placement_name)||{};
              return <li key={approval.placement_name}>
                {display(approval.placement_name)} — artwork {approval.artwork_asset_id}
                {placement.print_width_inches&&placement.print_height_inches?(' · '+placement.print_width_inches+' × '+placement.print_height_inches+' in'):''}
                {placement.top_offset_inches!==undefined?(' · top offset '+placement.top_offset_inches+' in'):''}
                {placement.reference_landmark?(' · '+placement.reference_landmark):''}
              </li>;
            })}</ul>
          </div>)}
          <p>These approved artwork references and recipe dimensions are saved with the traveler; later assignment changes do not replace them.</p>
        </div>}
        {snap.placement&&<p>Order placement instruction: {snap.placement}</p>}
        <p><strong>Decoration method:</strong> {snap.decoration_method||'Confirm approved method'} · <strong>Recipe:</strong> {snap.recipe_name||'Saved revision'}</p>
        <p><strong>Artwork:</strong> {artwork?.artwork_name||snap.artwork_asset_id||'Not attached — verify before production'}</p>
        {artworkUrl&&artwork?.mime_type?.startsWith('image/')&&<div className="sc-traveler-approved-art"><img src={artworkUrl} alt={artwork.artwork_name||'Linked production artwork'} /><small>Linked source artwork preview; verify the exact prepared production file and print dimensions before output.</small></div>}
        {artworkUrl&&<p><a href={artworkUrl} rel="noreferrer" target="_blank">Open linked artwork file ↗</a></p>}
        {snap.machine_settings?<div className="sc-traveler-machine">
          <h4>Material / machine settings snapshot</h4>
          <p><strong>{snap.machine_settings.machine_model}</strong> · {snap.machine_settings.material_name} · {snap.machine_settings.operation} · approved revision {snap.machine_settings.version||'unspecified'}</p>
          <dl>{Object.entries(snap.machine_settings.settings||{}).map(([k,v])=><div key={k}><dt>{display(k)}</dt><dd>{typeof v==='object'?JSON.stringify(v):String(v)}</dd></div>)}</dl>
          <p>{snap.machine_settings.safety_notes||'Use machine and material manufacturer safety procedures.'}</p>
        </div>:<p><strong>Material settings:</strong> Not linked — consult approved machine/material instructions before manufacturing.</p>}
        {snap.production_notes&&<p><strong>Special production notes:</strong> {snap.production_notes}</p>}
      </section>
      <section><h3>Measured decoration placements</h3>
        <div className="sc-traveler-visuals">{(snap.placements||[]).map((p,i)=><div key={i}>
          <GarmentPlacementGuide blank={{asset_name:snap.blank?.style||snap.blank?.brand||'tee',product_view:p.placement_name}}
            placement={p} />
          <p><strong>Measured:</strong> {p.top_offset_inches} in top-edge offset from {p.reference_landmark||'approved physical landmark'}; horizontal {p.center_offset_inches} in relative to placement centerline; size group {p.size_group||'unspecified'}.</p>
          {p.artwork_asset_id&&<div className="sc-traveler-approved-art"><strong>Exact graphic for this location:</strong> {placementArtworks[p.artwork_asset_id]?.name||p.artwork_asset_id}
            {placementArtworks[p.artwork_asset_id]?.url&&<><img src={placementArtworks[p.artwork_asset_id].url} alt={'Production file for '+p.placement_name}/><a href={placementArtworks[p.artwork_asset_id].url} target="_blank" rel="noreferrer">Open exact production graphic</a></>}
          </div>}
          <p>{p.instructions}</p>
        </div>)}</div>
      </section>
      <section><h3>Work instructions</h3>
        <ol>{(snap.process_steps||[]).map((step,i)=><li key={i}><strong>{step.label}</strong> — {step.instruction}</li>)}</ol>
      </section>
      <section><h3>Packaging / pickup instructions</h3>
        <p><strong>Pack:</strong> {snap.packaging?.method||'Confirm order specifications'}</p>
        <p><strong>Label:</strong> {snap.packaging?.labeling||'Confirm labeling'}</p>
        <p>{snap.packaging?.customer_notes||'No additional customer packaging directions saved.'}</p>
      </section>
      <section><h3>Manufacturing activity / exception notes</h3>
        <p className="sc-traveler-footnote">Recorded notes supplement, but do not replace, official QC, inventory movement or order status.</p>
        {events.length?<ul>{events.map(e=><li key={e.id}><strong>{display(e.kind)}</strong> · {new Date(e.created_at).toLocaleString()} — {e.details}</li>)}</ul>:<p>No recorded traveler events yet.</p>}
      </section>
      {editable&&<section className="sc-traveler-no-print sc-traveler-event-form">
        <h3>Record production progress</h3>
        <label>Event<select value={eventKind} onChange={e=>setEventKind(e.target.value)}>
          {eventKinds.map(([k,label])=><option key={k} value={k}>{label}</option>)}
        </select></label>
        <label>What happened?<textarea rows="3" value={eventText} onChange={e=>setEventText(e.target.value)}
          placeholder="Record measured placement confirmation, items completed or an exception." /></label>
        <button type="button" disabled={busy||!eventText.trim()} onClick={addEvent}>{busy?'Saving…':'Save activity note'}</button>
        <p><Link to="/qc-checklist">Complete official QC →</Link> · <Link to="/production-board">Update job status →</Link></p>
      </section>}
      <footer className="sc-traveler-paper-footer"><span>Internal manufacturing instructions · Scan requires authenticated app access</span>
        <span>Traveler ID {selected.id}</span></footer>
    </article>:<section className="card"><p>Opening traveler… {message}</p></section>)}
  </main>;
}
