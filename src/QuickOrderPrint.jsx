import {useEffect,useState} from 'react';
import {supabase} from './supabaseClient';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {canPrintCustomerCopy} from './lib/printModel';
import {createInvoicePdf,createDistributionLabelsPdf,createProductionPacketPdf} from './lib/printPacketPdf';
import {LABEL_PRESETS,normalizeLabelDesign,presetLabelDesign} from './lib/labelDesigner';
import businessLogo from './assets/logo.png';
import './QuickOrderPrint.css';

const DEFAULT_DOCUMENTS=['customer','shop','labels'];
const TYPES=[
 ['customer','Customer invoice','Letter · Epson'],
 ['shop','Shop invoice / internal copy','Letter · Epson'],
 ['labels','4×6 distribution labels','Thermal · D530 Pro'],
 ['production','Production travelers','Letter · Epson'],
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
 const [selected,setSelected]=useState(DEFAULT_DOCUMENTS);
 const [template,setTemplate]=useState('saved');
 const [packages,setPackages]=useState(1);
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
    const {data,error:trError}=await supabase.from('sc_job_travelers').select('id,job_id,job_item_id,recipe_snapshot,ordered_quantity').eq('job_id',jobId).limit(500);
    if(trError)throw trError;
    if((data||[]).length===500)throw Error('Traveler count exceeds safe print limit.');
    if(active){setSource(payload.source);setJob(payload.job);setTravelers(data||[]);}
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
 const currentSelected=TYPES.filter(([key])=>selected.includes(key)).map(([key])=>key);
 const blocked=(key)=>{
  if(key==='customer'&&!invoiceAllowed)return 'Customer invoice needs verified billing totals; shop copy is still available as DRAFT.';
  if(key==='production'&&!travelers.length)return 'Approved production traveler missing.';
  if(key==='labels'&&prefs.packageCount>1)return null; // PDF explicitly warns when allocation is unknown.
  return null;
 };
 const printerFor=key=>key==='labels'?'thermal':'letter';
 const routeReady=key=>Boolean(capabilities?.enabled&&capabilities?.[printerFor(key)]);
 async function makeDocument(key){
  const args={source,job,travelers,origin:window.location.origin,prefs,labelDesign:design(),logoData:await logoData()};
  if(key==='customer')return createInvoicePdf({...args,kind:'customer'});
  if(key==='shop')return createInvoicePdf({...args,kind:'shop'});
  if(key==='labels')return createDistributionLabelsPdf(args);
  if(key==='production')return createProductionPacketPdf(args);
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
    const documentKind={customer:'customer_invoice',shop:'shop_invoice',labels:'packing_labels',production:'production_packet'}[key];
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
  {source&&job&&<><div className="sc-quick-print-options">
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
