import {useEffect,useState} from 'react';
import {supabase} from './supabaseClient';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {canPrintCustomerCopy} from './lib/printModel';
import {createInvoicePdf,createDistributionLabelsPdf,createProductionPacketPdf} from './lib/printPacketPdf';
import {signedAssetUrl} from './lib/mockupStudioApi';
import {LABEL_DESIGN_FIELDS,LABEL_PRESETS,normalizeLabelDesign,presetLabelDesign} from './lib/labelDesigner';
import businessLogo from './assets/logo.png';
import './QuickOrderPrint.css';

const DEFAULT_DOCUMENTS=['customer','shop','labels'];
const TYPES=[
 ['customer','Customer invoice','Letter · Epson'],
 ['shop','Shop invoice / internal copy','Letter · Epson'],
 ['labels','4×6 distribution labels','Thermal · D530 Pro'],
];
const cacheKey='sc-print-center-prefs-v1',designKey='sc-label-designer-v1',savedDesignKey='sc-label-designer-presets-v1',builtinsKey='sc-label-designer-builtins-v1';
const readSaved=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}};
const pdfBase64=pdf=>pdf.output('datauristring').split(',')[1];
const fileName=value=>String(value||'order').replace(/[^a-zA-Z0-9_-]/g,'-');
async function logoData(){
 try{const response=await fetch(businessLogo);if(!response.ok)return '';
 const blob=await response.blob();if(blob.size>2000000)return '';
 return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Logo unavailable'));reader.readAsDataURL(blob);});
 }catch{return '';}
}
export default function QuickOrderPrint({jobId,onClose}){
 const [source,setSource]=useState(null);
 const [job,setJob]=useState(null);
 const [travelers,setTravelers]=useState([]);
 const [travelerLines,setTravelerLines]=useState([]);
 const [selected,setSelected]=useState(DEFAULT_DOCUMENTS);
 const [template,setTemplate]=useState('saved');
 const [packages,setPackages]=useState(1);
 const [labelFields,setLabelFields]=useState({});
 const [preview,setPreview]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [capabilities,setCapabilities]=useState(null);
 const [savedNames]=useState(()=>Object.keys(readSaved(savedDesignKey,{})));
 useEffect(()=>{
  let active=true;
  (async()=>{
   setBusy(true);setError('');setSource(null);
   try{
    const response=await authenticatedFunctionFetch('/.netlify/functions/print-order-source',{method:'POST',body:JSON.stringify({jobId:Number(jobId)})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.success)throw Error(payload.error||'Order source cannot be verified.');
    const {data,error:trError}=await supabase.from('sc_job_travelers').select('id,job_id,job_item_id,recipe_snapshot,ordered_quantity,superseded_at').eq('job_id',jobId).is('superseded_at',null).limit(500);
    if(trError)throw trError;
    if((data||[]).length===500)throw Error('Traveler count exceeds safe print limit.');
    const ids=(data||[]).map(t=>t.id);
    const lines=ids.length?await supabase.from('sc_job_traveler_lines').select('traveler_id,job_item_id,quantity,item_snapshot').in('traveler_id',ids).is('superseded_at',null).limit(1000):{data:[],error:null};
    if(lines.error)throw lines.error;
    if(lines.data?.length===1000)throw Error('Traveler line count exceeds safe print limit.');
    if(active){setSource(payload.source);setJob(payload.job);setTravelers(data||[]);setTravelerLines(lines.data||[]);}
   }catch(e){if(active)setError(e.message||'Unable to load order.');}
   finally{if(active)setBusy(false);}
  })();
  return()=>{active=false;};
 },[jobId]);
 useEffect(()=>{
  let active=true;
  authenticatedFunctionFetch('/.netlify/functions/print-dispatch',{method:'POST',body:JSON.stringify({action:'capabilities'})})
   .then(r=>r.json()).then(data=>{if(active)setCapabilities(data);}).catch(()=>{if(active)setCapabilities({enabled:false});});
  return()=>{active=false;};
 },[]);
 function design(){
  if(template==='saved')return normalizeLabelDesign(readSaved(designKey,presetLabelDesign('general')));
  if(template.startsWith('custom:'))return normalizeLabelDesign(readSaved(savedDesignKey,{})[template.slice(7)]||presetLabelDesign('general'));
  const customized=readSaved(builtinsKey,{})[template];
  return normalizeLabelDesign(customized||presetLabelDesign(template));
 }
 const prefs={...readSaved(cacheKey,{}),packageCount:Math.max(1,Math.min(100,Number(packages)||1))};
 const invoiceAllowed=source&&canPrintCustomerCopy(source);
 const currentSelected=[...TYPES.filter(([key])=>selected.includes(key)).map(([key])=>key),...travelers.filter(t=>selected.includes('traveler:'+t.id)).map(t=>'traveler:'+t.id)];
 const blocked=(key)=>{
  if(key==='customer'&&!invoiceAllowed)return 'Customer invoice not verified. Review billing verification details below; shop copy is available as DRAFT.';
  if(key.startsWith('traveler:')&&!travelers.some(t=>'traveler:'+t.id===key))return 'Saved traveler unavailable.';
  if(key==='labels'&&prefs.packageCount>1)return null; // PDF explicitly warns when allocation is unknown.
  return null;
 };
 const printerFor=key=>key==='labels'?'thermal':'letter';
 const routeReady=key=>Boolean(capabilities?.enabled&&capabilities?.[printerFor(key)]);
 async function imageForAsset(id){
  if(!id)return '';
  const {data,error}=await supabase.from('mockup_artwork_assets').select('*').eq('id',id).maybeSingle();
  if(error||!data)throw Error('Approved traveler artwork cannot be retrieved.');
  const url=await signedAssetUrl(data,300,{preferPreview:true});
  const response=await fetch(url);
  if(!response.ok)throw Error('Traveler artwork preview download failed.');
  const blob=await response.blob();
  if(!['image/png','image/jpeg'].includes(blob.type)||blob.size>6000000)throw Error('Traveler image must be a PNG/JPEG under 6 MB for PDF printing.');
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Artwork preview conversion failed.'));reader.readAsDataURL(blob);});
 }
 async function makeDocument(key){
  const args={source,job,travelers,origin:window.location.origin,prefs,labelDesign:design(),labelFields,logoData:await logoData()};
  if(key==='customer')return createInvoicePdf({...args,kind:'customer'});
  if(key==='shop')return createInvoicePdf({...args,kind:'shop'});
  if(key==='labels')return createDistributionLabelsPdf(args);
  if(key.startsWith('traveler:')){
    const t=travelers.find(v=>'traveler:'+v.id===key);
    if(!t)throw Error('Traveler no longer available.');
    const lines=travelerLines.filter(line=>String(line.traveler_id)===String(t.id));
    if(!lines.length)throw Error('Cannot print incomplete traveler: grouped order lines missing.');
    const ids=[t.recipe_snapshot?.artwork_asset_id,...(t.recipe_snapshot?.placements||[]).map(p=>p.artwork_asset_id),...lines.flatMap(l=>(l.item_snapshot?.approved_placement_artwork||[]).map(a=>a.artwork_asset_id))].filter(Boolean);
    const artworkImages={};
    for(const id of [...new Set(ids)])artworkImages[String(id)]=await imageForAsset(id);
    return createProductionPacketPdf({...args,travelers:[{...t,lines}],artworkImages});
  }
  throw Error('Unknown print document.');
 }
 async function previewSelection(){
  if(!source||!job||!currentSelected.length)return;
  setBusy(true);setError('');setMessage('');setPreview(null);
  try{
   const allowed=currentSelected.filter(key=>!blocked(key));
   if(!allowed.length)throw Error('No selected document can be previewed.');
   // Browser preview is a PDF per document because invoice and thermal media have different page dimensions.
   const files=[];
   for(const key of allowed){const pdf=await makeDocument(key);files.push({key,url:pdf.output('datauristring')});}
   setPreview(files);
   if(allowed.length<currentSelected.length)setMessage('Preview excludes documents with safety blockers.');
  }catch(e){setError(e.message||'Unable to preview the selected documents.');}
  finally{setBusy(false);}
 }
 async function printSelected(){
  if(!source||!job||!currentSelected.length||busy)return;
  setBusy(true);setError('');setMessage('');
  const sent=[];
  try{
   const unavailable=currentSelected.filter(key=>blocked(key)||!routeReady(key));
   if(unavailable.length)throw Error('Cannot queue: '+unavailable.map(key=>key+(blocked(key)?' — '+blocked(key):' — printer queue unavailable')).join('; ')+'. Use preview or configure printer routing.');
   for(const key of currentSelected){
    const pdf=await makeDocument(key);
    if(key==='labels'){
     const count=pdf.getNumberOfPages();
     const args={source,job,travelers,origin:window.location.origin,prefs,labelDesign:design(),labelFields,logoData:await logoData()};
     for(let index=0;index<count;index++){
      const one=createDistributionLabelsPdf({...args,pageIndex:index});
      if(one.getNumberOfPages()!==1)throw Error('Label page '+(index+1)+' could not be separated.');
      const response=await authenticatedFunctionFetch('/.netlify/functions/print-dispatch',{method:'POST',body:JSON.stringify({
       action:'enqueue',jobId:job.id,documentKind:'packing_labels',idempotencyKey:crypto.randomUUID(),pdfBase64:pdfBase64(one)
      })});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error('Label '+(index+1)+'/'+count+' not queued: '+(data.error||'Thermal queue rejected label'));
      sent.push('label '+(index+1)+'/'+count+' (queue '+data.id+')');
     }
     continue;
    }
    const documentKind=key.startsWith('traveler:')?'production_packet':{customer:'customer_invoice',shop:'shop_invoice',labels:'packing_labels'}[key];
    const response=await authenticatedFunctionFetch('/.netlify/functions/print-dispatch',{method:'POST',body:JSON.stringify({
     action:'enqueue',jobId:job.id,documentKind,idempotencyKey:crypto.randomUUID(),pdfBase64:pdfBase64(pdf)
    })});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success)throw Error(data.error||'Queue rejected '+key);
    sent.push(key+' (queue '+data.id+')');
   }
   setMessage('Queued '+sent.length+' document(s): '+sent.join(', ')+'. Physical printing still requires CUPS/printer confirmation.');
  }catch(e){setError((sent.length?sent.length+' document(s) already queued; check print history before retrying. ':'')+(e.message||'Print failed.'));}
  finally{setBusy(false);}
 }
 return <section className="sc-quick-print" aria-label="Print order documents">
  <div className="sc-quick-print-head"><div><h3>Print Order {source?.reference?'#'+source.reference:''}</h3>
   <p>{source?.customerName||'Loading order…'} · Select the documents and print.</p></div>
   <button type="button" onClick={onClose}>Close</button></div>
  {error&&<p role="alert" className="sc-quick-print-error">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {source?.warnings?.length>0&&<div role="status" className="sc-quick-print-error"><strong>Billing verification details:</strong><ul>{source.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></div>}
  {source&&job&&<><section className="sc-quick-print-travelers" aria-label="Print complete production travelers">
    <h4>Complete production travelers</h4>
    <p>Print each saved traveler from its authoritative detailed view. Select the travelers to include with your other documents. The print PDF uses each saved recipe snapshot, grouped order lines and approved artwork previews.</p>
    {travelers.map(t=><label key={t.id} className="sc-quick-print-item" style={{display:'flex',gap:12,alignItems:'center'}}><input type="checkbox" checked={selected.includes('traveler:'+t.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,'traveler:'+t.id]:v.filter(k=>k!=='traveler:'+t.id))}/><span><strong>Production traveler {String(t.id).slice(0,8)}…</strong><small>{travelerLines.filter(l=>String(l.traveler_id)===String(t.id)).length} grouped order lines · Letter · Epson</small><a href={'/production-travelers/'+encodeURIComponent(t.id)} target="_blank" rel="noopener noreferrer">View full traveler</a></span></label>)}
    {!travelers.length&&<p>No saved traveler yet for this order.</p>}
   </section><div className="sc-quick-print-options">
   {TYPES.map(([key,label,printer])=><label key={key} className="sc-quick-print-item">
    <input type="checkbox" checked={selected.includes(key)} onChange={e=>setSelected(before=>e.target.checked?[...before,key]:before.filter(v=>v!==key))}/>
    <span><strong>{label}</strong><small>{blocked(key)||printer}</small></span>
    <span className={routeReady(key)?'ready':'offline'}>{routeReady(key)?'Queue ready':'Preview only'}</span>
   </label>)}
  </div>
  {selected.includes('labels')&&<div className="sc-quick-print-settings">
   <label>Label template<select value={template} onChange={e=>setTemplate(e.target.value)}>
    <option value="saved">My saved default</option>
    {Object.entries(LABEL_PRESETS).map(([key,v])=><option key={key} value={key}>{v.name}{readSaved(builtinsKey,{})[key]?' (Customized)':''}</option>)}
    {savedNames.map(name=><option key={name} value={'custom:'+name}>{name}</option>)}
   </select></label>
   <label>Number of packages<input type="number" min="1" max="100" value={packages} onChange={e=>setPackages(e.target.value)}/></label>
   <p>Saved edits to built-in templates are used automatically. Edit and save designs in Print Center on this browser.</p>
   <details className="sc-quick-print-details"><summary>Student / teacher / team details (optional)</summary><p>Order personalization fills fields when available. Add missing details below for this print session; missing values are labeled NOT PROVIDED instead of hiding template fields.</p>
    <div className="sc-quick-print-field-grid">{design().order.filter(key=>design().visible.includes(key)).map(key=><label key={key}>{design().labels[key]||LABEL_DESIGN_FIELDS.find(([id])=>id===key)?.[1]}
     <input type="text" maxLength={120} value={labelFields[key]||""} onChange={e=>setLabelFields(v=>({...v,[key]:e.target.value}))} placeholder="Auto from order or enter"/>
    </label>)}</div>
   </details>
   <p>Multiple-package labels do not assert which items are in each bag unless a verified allocation exists.</p>
  </div>}
  <div className="sc-quick-print-actions">
   <button type="button" disabled={busy||!currentSelected.length} onClick={previewSelection}>Preview selected documents</button>
   <button type="button" disabled={busy||!currentSelected.length} onClick={printSelected}>Print selected to shop printers</button>
   <a href={'/print-center?job='+encodeURIComponent(jobId)}>Advanced layouts / printer settings</a>
  </div>
  {preview&&<div className="sc-quick-print-previews">{preview.map(file=><div key={file.key}>
   <h4>{TYPES.find(([key])=>key===file.key)?.[1]}</h4>
   <iframe title={'Preview '+file.key} src={file.url}/>
   <a href={file.url} download={fileName(source.reference)+'-'+file.key+'.pdf'}>Download this PDF</a>
  </div>)}</div>}
  </>}
 </section>;
}
