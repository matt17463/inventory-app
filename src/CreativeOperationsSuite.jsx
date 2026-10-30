import { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './CreativeOperationsSuite.css';
import CreativeKnowledgeHub from './CreativeKnowledgeHub';
import CreativeDesignWorkbench from './CreativeDesignWorkbench';
import CreativeLocalAi from './CreativeLocalAi';
import DailyCommandCenter from './DailyCommandCenter';
import { computeDraftPackage } from './lib/creativePackageMath';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { supabase } from './supabaseClient';
import { localAiCall,localAiConfigured } from './lib/localAiGateway';
import { shouldSimulateWrites } from './lib/testingMode';

const MODULES = [
  { id: 'command', name: 'Command Center', eyebrow: '01 · Operations', summary: 'Prioritize active work from existing production, purchasing, and equipment data.', links: [['Daily Command Center', '/command-center'], ['Work Hub', '/work-hub'], ['Equipment Center', '/equipment-center'], ['Order Risks', '/order-risk'], ['Print Center', '/print-center']] },
  { id: 'artwork', name: 'Local Artwork Engineer', eyebrow: '02 · No paid APIs', summary: 'Inspect artwork locally in your browser, then edit and export through DTF Prep Studio.', links: [['DTF Prep Studio', '/dtf-studio'], ['Artwork Preflight', '/artwork-preflight'], ['Mockup Studio', '/mockup-studio'], ['Client Graphics', '/client-graphics']] },
  { id: 'design', name: 'Customer Design Studio', eyebrow: '03 · Customer experience', summary: 'Connect customer intake, mockups, proof approval, and order conversion.', links: [['Customer Orders', '/client-orders'], ['Mockup Studio', '/mockup-studio'], ['Customer Portal Preview', '/customer-portal-preview'], ['Artwork Requests', '/artwork-requests'], ['Quote Builder', '/quote-builder']] },
  { id: 'packages', name: 'AI Product & Package Creator', eyebrow: '04 · Proposals', summary: 'Build and price event packages with transparent local math, then continue in Product Development.', links: [['Product & Event Center', '/product-event-center'], ['Production Estimator', '/production-estimator'], ['Quote Builder', '/quote-builder'], ['Manufacturing Recipes', '/manufacturing-recipes']] },
  { id: 'knowledge', name: 'Knowledge Assistant', eyebrow: '05 · Searchable resources', summary: 'Search the curated starting index of existing manuals and workspaces. Answers link to sources.', links: [['Application Guide', '/application-guide'], ['Device Product Library', '/device-product-library'], ['Material Settings', '/material-settings'], ['Equipment Center', '/equipment-center'], ['Manufacturing Recipes', '/manufacturing-recipes']] },
];
const CATALOG = {
  wedding: [{name:'Personalized glassware',qty:50,cost:5,price:14},{name:'Table markers',qty:10,cost:4,price:16},{name:'Keepsake sign',qty:1,cost:19,price:65}],
  coach: [{name:'Engraved plaque',qty:1,cost:16,price:55},{name:'Custom hoodie',qty:1,cost:22,price:52},{name:'Team keychains',qty:15,cost:2.5,price:8}],
  business: [{name:'Branded tumbler',qty:24,cost:10,price:28},{name:'Logo polo',qty:12,cost:21,price:49},{name:'Desk awards',qty:3,cost:13,price:39}],
};
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const clamp = (n,max=10000) => Number.isFinite(Number(n)) ? Math.min(max,Math.max(0,Number(n))) : 0;

function ArtworkInspect() {
  const [report,setReport]=useState(null);
  const [error,setError]=useState('');
  async function onFile(event) {
    const file=event.target.files?.[0];if(!file)return;
    setError('');setReport(null);
    if(!file.type.startsWith('image/')){setError('Select a PNG, JPEG, or WebP image.');return;}
    if(file.size>24*1024*1024){setError('File exceeds the 24 MB browser inspection limit.');return;}
    let url;
    try {
      url=URL.createObjectURL(file);
      const img = new Image();img.src=url;await img.decode();
      if(img.width*img.height>24000000)throw Error('Artwork exceeds 24 megapixels.');
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,1024/Math.max(img.width,img.height));
      canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let transparent=0,partial=0,opaque=0,whiteEdge=0;
      const w=canvas.width,h=canvas.height;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p=(y*w+x)*4,a=data[p+3];
        if(a===0)transparent++;else if(a<255)partial++;else opaque++;
        if((x===0||y===0||x===w-1||y===h-1)&&a>240&&data[p]>245&&data[p+1]>245&&data[p+2]>245)whiteEdge++;
      }
      setReport({name:file.name,width:img.width,height:img.height,transparent,partial,opaque,pixels:w*h,whiteEdge,preview:canvas.toDataURL('image/png'),inchesAt300:[(img.width/300).toFixed(2),(img.height/300).toFixed(2)]});
    }catch(e){setError(e.message||'Could not inspect this image.');}finally{if(url)URL.revokeObjectURL(url);}
  }
  return <section className="cos-card">
    <h3>On-device artwork inspection</h3>
    <p>Analysis runs entirely in your browser. Your image is not uploaded by this inspection tool.</p>
    <label className="cos-field">Select artwork<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile}/></label>
    {error&&<p role="alert">{error}</p>}
    {report&&<div className="cos-inspection"><img src={report.preview} alt="Artwork analysis preview"/><div>
      <strong>{report.name}</strong>
      <p>{report.width} × {report.height} pixels · {report.inchesAt300[0]} × {report.inchesAt300[1]} inches at 300 PPI</p>
      <p>Transparent pixels: {(100*report.transparent/report.pixels).toFixed(1)}% · Partial alpha: {(100*report.partial/report.pixels).toFixed(1)}%</p>
      {report.whiteEdge>0&&<p className="cos-warning">White pixels touch the canvas edge. Check for an unwanted white background.</p>}
      {report.partial>0&&<p className="cos-warning">Partially transparent pixels exist. Inspect edges for potential DTF halos.</p>}
      {report.width<1050&&<p className="cos-warning">Width is below 3.5 inches at 300 PPI. Upscaling may be necessary.</p>}
      <p>Inspection is heuristic, not AI segmentation, and does not certify print quality.</p>
    </div></div>}
  </section>;
}
function PackageBuilder() {
  const access=useContext(EmployeeAccessContext);
  const maySave=['admin','manager','marketing'].includes(access?.role);
  const [packageName,setPackageName]=useState(''),[customerName,setCustomerName]=useState('');
  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[savedId,setSavedId]=useState('');
  const [copyBusy,setCopyBusy]=useState(false),[copyDraft,setCopyDraft]=useState('');
  const [type,setType]=useState('wedding');
  const [items,setItems]=useState(CATALOG.wedding);
  const [setup,setSetup]=useState(30);
  const [margin,setMargin]=useState(0);
  const totals=useMemo(()=>computeDraftPackage(items,setup,margin),[items,setup,margin]);
  const revenue=totals.revenue,profit=totals.contribution;
  function switchType(v){setType(v);setItems(CATALOG[v].map(x=>({...x})));setMargin(0);}
  function update(i,key,value){setItems(current=>current.map((v,index)=>index===i?{...v,[key]:clamp(value)}:v));}
  async function requestLocalCopy(){
    setCopyBusy(true);setSaveError('');setCopyDraft('');
    try{
      const result=await localAiCall('/package-copy',{name:packageName||'Custom '+type+' collection',
       audience:customerName,occasion:type,products:items.filter(x=>clamp(x.qty)>0).map(x=>x.name)});
      setCopyDraft(result.draft||'');
    }catch(err){setSaveError(err.message||'Local AI unavailable.');}
    finally{setCopyBusy(false);}
  }
  async function saveEventDraft(){
    setSaveError('');setSavedId('');
    if(!maySave){setSaveError('An admin, manager, or marketing role is required to save a package.');return;}
    if(shouldSimulateWrites()){setSaveError('Training mode is active. Switch out of testing mode before saving live draft records.');return;}
    const name=packageName.trim();
    if(name.length<3||name.length>180){setSaveError('Give the event or package a name of 3–180 characters.');return;}
    if(!items.length||items.some(x=>!x.name||Math.trunc(Number(x.qty))<1)){setSaveError('Each package item must have a quantity of at least one.');return;}
    setSaving(true);let saved=null;
    try{
      const types={wedding:'wedding',coach:'coach_recognition',business:'corporate'};
      const event={name,event_type:types[type],client_name:customerName.trim().slice(0,250),
        status:'draft',instructions:'CREATIVE OPERATIONS DRAFT · Estimated costs only. Validate stock, labor, material tests, taxes, proofs and customer approvals before quoting or manufacturing.',
        theme:{origin:'creative_operations_suite',template:type}};
      const created=await supabase.from('sc_pdc_events').insert(event).select('id').single();
      if(created.error)throw created.error;saved=created.data.id;
      const payload=items.map(x=>({event_id:saved,label:x.name,quantity:Math.trunc(clamp(x.qty)),unit_cost:clamp(x.cost),unit_price:clamp(x.price),proof_status:'draft',notes:'Template estimate. Verify exact materials and approved artwork before production.'}));
      if(clamp(setup)||clamp(margin))payload.push({event_id:saved,label:'Setup and customization allowance',quantity:1,unit_cost:clamp(setup),unit_price:clamp(margin),proof_status:'draft',notes:'Estimated setup cost and customer charge. Review for actual quote.'});
      const result=await supabase.from('sc_pdc_event_items').insert(payload);
      if(result.error)throw result.error;
      setSavedId(saved);
    }catch(err){
      setSaveError('Save incomplete: '+(err.message||'Database error')+(saved?' The draft event exists; open Product & Event Center to repair its items.':''));
      if(saved)setSavedId(saved);
    }finally{setSaving(false);}
  }
  return <section className="cos-card">
    <h3>Local package economics</h3>
    <p>Starter assumptions only. Adjust quantities, unit costs, and selling prices before creating a quote. No invoice or order is generated here.</p>
    <label className="cos-field">Package template<select value={type} onChange={e=>switchType(e.target.value)}><option value="wedding">Wedding & event</option><option value="coach">Coach recognition</option><option value="business">Corporate gifts</option></select></label>
    <div className="cos-table-scroll"><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit cost ($)</th><th>Unit price ($)</th></tr></thead><tbody>{items.map((v,i)=><tr key={v.name}><td>{v.name}</td>{['qty','cost','price'].map(key=><td key={key}><input aria-label={v.name+' '+key} type="number" min="0" step={key==='qty'?'1':'0.01'} value={v[key]} onChange={e=>update(i,key,e.target.value)}/></td>)}</tr>)}</tbody></table></div>
    <div className="cos-input-row"><label className="cos-field">Setup / overhead cost ($)<input type="number" min="0" value={setup} onChange={e=>setSetup(clamp(e.target.value))}/></label><label className="cos-field">Additional customer charge ($)<input type="number" min="0" value={margin} onChange={e=>setMargin(clamp(e.target.value))}/></label></div>
    <div className="cos-input-row"><label className="cos-field">Package / event name<input value={packageName} maxLength={180} onChange={e=>setPackageName(e.target.value)} placeholder="e.g. Smith wedding favors"/></label><label className="cos-field">Customer or organization<input value={customerName} maxLength={250} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer name"/></label></div>
    <div className="cos-metrics"><div><small>Projected sales</small><strong>{money(revenue)}</strong></div><div><small>Estimated direct + setup cost</small><strong>{money(totals.cost)}</strong></div><div><small>Estimated gross contribution</small><strong>{money(profit)}</strong></div><div><small>Estimated contribution margin</small><strong>{revenue?(totals.contributionMargin.toFixed(1)+'%'):'—'}</strong></div></div>
    <div className="cos-knowledge-editor"><h3>Local AI package description</h3>
      <p>Draft persuasive package copy without sending client data to a paid AI provider. Descriptions are not approved or published automatically.</p>
      <button type="button" disabled={copyBusy||!localAiConfigured()} onClick={requestLocalCopy}>{copyBusy?'Drafting locally…':'Draft with local model'}</button>
      {!localAiConfigured()&&<p className="cos-note">Connect the private shop-hosted model gateway to enable local copywriting.</p>}
      {copyDraft&&<><textarea aria-label="Editable AI package description" rows={6} value={copyDraft} onChange={e=>setCopyDraft(e.target.value)}/><p>Draft only. Check all claims, product availability, and pricing before using this copy.</p></>}
    </div>
    {maySave&&<button type="button" disabled={saving} onClick={saveEventDraft}>{saving?'Saving draft…':'Save draft to Product & Event Center'}</button>}
    {savedId&&<p role="status">Draft record created. <Link to={'/product-event-center?event='+encodeURIComponent(savedId)}>Open saved event package →</Link></p>}
    {saveError&&<p role="alert" className="cos-warning">{saveError}</p>}
    <button type="button" onClick={()=>{const text=['Draft '+type+' package',...items.map(x=>x.qty+' × '+x.name+' @ '+money(x.price)), 'Sales: '+money(revenue), 'Estimated costs: '+money(totals.cost),'Estimated contribution: '+money(profit),'DRAFT — verify labor, taxes, stock, waste, and customer approval.'].join('\n');navigator.clipboard?.writeText(text);}}>Copy draft package summary</button>
  </section>;
}
export default function CreativeOperationsSuite() {
  const access=useContext(EmployeeAccessContext);
  const [active,setActive]=useState(()=>{const initial=new URLSearchParams(window.location.search).get('tab');return MODULES.some(item=>item.id===initial)?initial:'command';});
  const module=MODULES.find(m=>m.id===active)||MODULES[0];
  return <main className="page cos-page">
    <header className="cos-hero"><p className="eyebrow">Skilled Crafting · Unified Development Suite</p><h1>Creative Operations</h1><p>Five connected workspaces built around your current application. Existing workflow approvals, billing verification and production safety checks remain authoritative.</p><div className="cos-hero-pills"><span>Existing data & workflows</span><span>Local-first artwork</span><span>No paid AI required</span></div></header>
    <nav className="cos-tabs" aria-label="Creative operations modules">{MODULES.map(m=><button type="button" key={m.id} className={active===m.id?'active':''} aria-pressed={active===m.id} onClick={()=>setActive(m.id)}>{m.name}</button>)}</nav>
    <section className="cos-card"><p className="eyebrow">{module.eyebrow}</p><h2>{module.name}</h2><p>{module.summary}</p><div className="cos-links">{module.links.map(([label,path])=><Link key={path} to={path}>{label} →</Link>)}</div></section>
    {active==='command'&&(access?.role==='marketing'?<section className="cos-card"><p>Operations job metrics are limited to authorized production staff. Product research and marketing tools remain available through the other tabs.</p></section>:<section className="cos-card"><h3>Live daily operations</h3><p>These metrics are loaded through your existing authorized Command Center queries. Device telemetry is only shown by its verified equipment source, not inferred here.</p><DailyCommandCenter embedded /></section>)}
    {active==='artwork'&&<><CreativeLocalAi/><ArtworkInspect/></>}
    {active==='design'&&<CreativeDesignWorkbench/>}
    {active==='packages'&&<PackageBuilder/>}
    {active==='knowledge'&&<CreativeKnowledgeHub/>}
  </main>;
}
