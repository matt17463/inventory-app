import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from './supabaseClient';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {signedAssetUrl} from './lib/mockupStudioApi';
import {DEFAULT_PRINT_PREFS,normalizePrintPrefs,printWarnings,canPrintCustomerCopy} from './lib/printModel';
import {createInvoicePdf,createInvoicePairPdf,createDistributionLabelsPdf,createProductionPacketPdf} from './lib/printPacketPdf';
import PrintIntegrations from './PrintIntegrations';
import QuickBooksConnection from './QuickBooksConnection';
import './PrintCenter.css';
import {LABEL_DESIGN_FIELDS,LABEL_PRESETS,normalizeLabelDesign,presetLabelDesign,moveLabelField} from './lib/labelDesigner';
import businessLogo from './assets/logo.png';

const CONFIG_KEY='sc-print-center-prefs-v1';
const DESIGN_KEY='sc-label-designer-v1';
const CUSTOM_DESIGN_KEY='sc-label-designer-presets-v1';
const BUILTIN_DESIGN_KEY='sc-label-designer-builtins-v1';
function localJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
function initialPrefs(){
 try{return normalizePrintPrefs(JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}'));}
 catch{return {...DEFAULT_PRINT_PREFS};}
}
function base64Image(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read artwork image.'));
  reader.readAsDataURL(blob);
 });
}
async function readArtwork(travelers){
 const unique=[...new Set(travelers.map(t=>t.recipe_snapshot?.artwork_asset_id).filter(Boolean))].slice(0,20);
 if(!unique.length)return {};
 const {data,error}=await supabase.from('mockup_artwork_assets').select('*').in('id',unique);
 if(error)throw error;
 const images={};
 await Promise.all((data||[]).map(async asset=>{
  if(!asset.mime_type?.startsWith('image/'))return;
  try{
   const url=await signedAssetUrl(asset,3600,{preferPreview:false});
   if(!url)return;
   const response=await fetch(url,{credentials:'omit'});
   if(!response.ok)throw Error('Not accessible');
   const blob=await response.blob();
   if(blob.size>8_000_000||!['image/png','image/jpeg'].includes(blob.type))return;
   images[asset.id]=await base64Image(blob);
  }catch{/* Print an explicit unavailable preview warning rather than substituting artwork. */}
 }));
 return images;
}
async function readBrandLogo(){
 try{
  const response=await fetch(businessLogo);
  if(!response.ok)return '';
  const blob=await response.blob();
  return blob.size<2_000_000?await base64Image(blob):'';
 }catch{return '';}
}
const LABEL_FIELDS=[
 ['student','Student / player name'],['teacher','Teacher name'],['coach','Coach name'],
 ['team','Team / classroom'],['grade','Grade'],['playerNumber','Player / jersey number'],
 ['appliedName','Name applied to garment'],['school','School / organization'],
];
const jobNumber=id=>Number.isSafeInteger(Number(id))&&Number(id)>0?Number(id):null;
export default function PrintCenter(){
 const access=useContext(EmployeeAccessContext);
 const authorized=['admin','manager'].includes(access?.role);
 const [params]=useSearchParams();
 const jobId=jobNumber(params.get('job'));
 const [source,setSource]=useState(null);
 const [job,setJob]=useState(null);
 const [travelers,setTravelers]=useState([]);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [prefs,setPrefs]=useState(initialPrefs);
 const [labelFields,setLabelFields]=useState({});
 const [labelDesign,setLabelDesign]=useState(()=>normalizeLabelDesign(localJson(DESIGN_KEY,presetLabelDesign('general'))));
 const [customDesigns,setCustomDesigns]=useState(()=>localJson(CUSTOM_DESIGN_KEY,{}));
 const [designName,setDesignName]=useState('');
 const [activeBuiltin,setActiveBuiltin]=useState('general');
 const [labelPreview,setLabelPreview]=useState('');
 const [visibleSettings,setVisibleSettings]=useState(false);
 const warnings=useMemo(()=>source?printWarnings(source,job,travelers):[],[source,job,travelers]);
 const setDesignValue=(key,value)=>setLabelDesign(v=>normalizeLabelDesign({...v,[key]:value}));
 const setLabelField=(key,value)=>setLabelFields(v=>({...v,[key]:value}));
 const setPref=(name,value)=>setPrefs(v=>normalizePrintPrefs({...v,[name]:value}));
 const reload=useCallback(async()=>{
   if(!jobId||!authorized)return;
   setBusy('loading');setError('');setMessage('');
   try{
    const response=await authenticatedFunctionFetch('/.netlify/functions/print-order-source',{
      method:'POST',body:JSON.stringify({jobId}),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.success)throw Error(payload.error||'Billing source lookup failed.');
    const {data:tr,error:travelerError}=await supabase.from('sc_job_travelers')
      .select('id,job_id,job_item_id,recipe_version_id,recipe_snapshot,ordered_quantity')
      .eq('job_id',jobId).limit(500);
    if(travelerError)throw travelerError;
    if((tr||[]).length===500)throw Error('Traveler set exceeds 499 items; print in smaller job batches.');
    setJob(payload.job);setSource(payload.source);setTravelers(tr||[]);
   }catch(e){setJob(null);setSource(null);setTravelers([]);setError(e.message||'Could not load this order.');}
   finally{setBusy('');}
 },[jobId,authorized]);
 useEffect(()=>{reload();},[reload]);
 function saveLabelDesign(){
  try{
   localStorage.setItem(DESIGN_KEY,JSON.stringify(labelDesign));
   const presets={...localJson(BUILTIN_DESIGN_KEY,{})};presets[activeBuiltin]=normalizeLabelDesign(labelDesign);
   localStorage.setItem(BUILTIN_DESIGN_KEY,JSON.stringify(presets));
   setMessage('Saved '+LABEL_PRESETS[activeBuiltin].name+' layout for Work Hub printing on this browser.');
  }
  catch{setError('Unable to save label design on this browser.');}
 }
 function saveNamedDesign(){
  const name=designName.trim().slice(0,50);
  if(!name){setError('Enter a preset name first.');return;}
  const next={...customDesigns,[name]:normalizeLabelDesign(labelDesign)};
  try{localStorage.setItem(CUSTOM_DESIGN_KEY,JSON.stringify(next));setCustomDesigns(next);setMessage('Saved named label template on this browser: '+name);}
  catch{setError('Unable to save named template.');}
 }
 async function previewLabel(){
  setError('');
  try{
   const previewSource=source||{shipName:'Sample Recipient',customerName:'Sample Recipient',reference:'SAMPLE',lines:[{name:'Sample team hoodie',quantity:1,metadata:[{label:'Student Name',value:'Sample Student'},{label:'Teacher Name',value:'Sample Teacher'},{label:'Team',value:'Sample Team'},{label:'Coach',value:'Sample Coach'}]}]};
   const previewJob=job||{id:'SAMPLE'};
   const pdf=createDistributionLabelsPdf({source:previewSource,job:previewJob,prefs:{...prefs,packageCount:1},origin:window.location.origin,labelFields,labelDesign,logoData:await readBrandLogo()});
   setLabelPreview(pdf.output('datauristring'));
  }catch(e){setError(e.message||'Label preview failed.');}
 }
 function savePrefs(){
   try{localStorage.setItem(CONFIG_KEY,JSON.stringify(prefs));setMessage('Layout defaults saved on this browser. They do not alter WooCommerce plugin settings.');}
   catch{setError('This browser cannot save local printing preferences.');}
 }
 async function documentAction(which,sendToPrinter=false){
  if(!source||!job||busy)return;
  setBusy(which);setError('');setMessage('');
  try{
   const base={source,job,travelers,prefs,origin:window.location.origin,labelFields,labelDesign,logoData:await readBrandLogo()};
   let pdf,name;
   if(which==='invoices'){
     pdf=createInvoicePairPdf(base);name='SC-'+source.reference+'-Customer-and-Shop-Invoices.pdf';
   }else if(which==='customer'){
     pdf=createInvoicePdf({...base,kind:'customer'});name='SC-'+source.reference+'-Customer-Invoice.pdf';
   }else if(which==='shop'){
     pdf=createInvoicePdf({...base,kind:'shop'});name='SC-'+source.reference+'-SHOP-Internal.pdf';
   }else if(which==='labels'){
     pdf=createDistributionLabelsPdf(base);name='SC-'+source.reference+'-4x6-Labels.pdf';
   }else if(which==='production'){
     const artworkImages=await readArtwork(travelers);
     pdf=createProductionPacketPdf({...base,artworkImages});
     name='SC-'+source.reference+'-Production-Packet.pdf';
   }
   if(!pdf)throw Error('Choose a printable document.');
   if(sendToPrinter){
    const idempotencyKey=crypto.randomUUID();
    const documentKind={invoices:'invoice_pair',customer:'customer_invoice',shop:'shop_invoice',
      labels:'packing_labels',production:'production_packet'}[which];
    const bytes=pdf.output('datauristring').split(',')[1];
    const result=await authenticatedFunctionFetch('/.netlify/functions/print-dispatch',{
      method:'POST',body:JSON.stringify({action:'enqueue',jobId:job.id,documentKind,
        idempotencyKey,pdfBase64:bytes})
    });
    const response=await result.json().catch(()=>({}));
    if(!result.ok||!response.success)throw Error(response.error||'Could not submit to printer.');
    setMessage('Document queued for the shop print agent: '+response.id+'. Await CUPS spool acknowledgment; this does NOT confirm physical printing.');
   }else{
    pdf.save(name.replace(/[^a-zA-Z0-9._-]/g,'-'));
    setMessage('PDF saved. Select the correct paper and printer when opening it. This is not confirmation of physical printing.');
   }
  }catch(e){setError(e.message||'Could not generate document.');}
  finally{setBusy('');}
 }
 async function printStandardPacket(){
  if(!source||!job||busy||!canPrintCustomerCopy(source))return;
  setBusy('standard');setError('');setMessage('');
  const accepted=[];
  try{
   const capabilitiesResponse=await authenticatedFunctionFetch('/.netlify/functions/print-dispatch',{
    method:'POST',body:JSON.stringify({action:'capabilities'})
   });
   const cap=await capabilitiesResponse.json();
   if(!cap?.enabled||!cap?.letter||!cap?.thermal)
    throw Error('Standard packet needs both verified Epson and thermal print queues. Configure/test the print agent first, or use individual PDF downloads.');
   if(prefs.productionPacket&&!travelers.length)throw Error('Attach approved QR travelers before including a production packet.');
   const base={source,job,travelers,prefs,origin:window.location.origin,labelFields,logoData:await readBrandLogo()};
   const docs=[['invoice_pair',createInvoicePairPdf(base)],['packing_labels',createDistributionLabelsPdf(base)]];
   if(prefs.productionPacket){
    const artworkImages=await readArtwork(travelers);
    docs.push(['production_packet',createProductionPacketPdf({...base,artworkImages})]);
   }
   for(const [documentKind,doc] of docs){
    const response=await authenticatedFunctionFetch('/.netlify/functions/print-dispatch',{
      method:'POST',body:JSON.stringify({action:'enqueue',jobId:job.id,documentKind,
       idempotencyKey:crypto.randomUUID(),pdfBase64:doc.output('datauristring').split(',')[1]})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.success)throw Error(result.error||'Queue submission failed.');
    accepted.push(documentKind);
   }
   setMessage(accepted.length+' document job(s) queued for the Pi. Verify their CUPS status; they are not confirmed physically printed.');
  }catch(e){
   setError((accepted.length?accepted.length+' document(s) were queued before an error. Check print history before retrying. ':'')+
     (e.message||'Could not queue standard packet.'));
  }finally{setBusy('');}
 }
 const designerPanel=(
 <section className="card elevated-card">
    <h2>4×6 Label Designer</h2>
    <p>Choose a template, select which recipient details appear, rename their captions, and arrange them in printing order. Changes apply to downloaded and queued label PDFs.</p>
    <div className="sc-print-preferences">
      <label>Quick template
       <select value={activeBuiltin} onChange={e=>{if(e.target.value){setActiveBuiltin(e.target.value);setLabelDesign(normalizeLabelDesign(localJson(BUILTIN_DESIGN_KEY,{})[e.target.value]||presetLabelDesign(e.target.value)));}}}>
        <option value="" disabled>Select template…</option>
        {Object.entries(LABEL_PRESETS).map(([key,item])=><option key={key} value={key}>{item.name}</option>)}
       </select>
      </label>
      <label>Saved templates
       <select defaultValue="" onChange={e=>{if(customDesigns[e.target.value])setLabelDesign(normalizeLabelDesign(customDesigns[e.target.value]));}}>
        <option value="">Load saved design…</option>
        {Object.keys(customDesigns).map(name=><option key={name} value={name}>{name}</option>)}
       </select>
      </label>
      <label>New saved template name<input type="text" maxLength={50} value={designName} onChange={e=>setDesignName(e.target.value)} placeholder="e.g. SKSC Soccer"/></label>
      <label>Field font size (pt)<input type="number" min="8" max="13" value={labelDesign.fontSize} onChange={e=>setDesignValue('fontSize',e.target.value)}/></label>
      <label>Logo size (pt)<input type="number" min="24" max="60" value={labelDesign.logoSize} onChange={e=>setDesignValue('logoSize',e.target.value)}/></label>
      <label className="sc-print-check"><input type="checkbox" checked={labelDesign.showLogo} onChange={e=>setDesignValue('showLogo',e.target.checked)}/>Show business logo</label>
    </div>
    <h3>Field order and display names</h3>
    <div className="sc-label-designer-list">
      {labelDesign.order.map((key,index)=>{
       const defaultName=LABEL_DESIGN_FIELDS.find(([id])=>id===key)?.[1]||key;
       return <div className="sc-label-designer-row" key={key}>
        <label><input type="checkbox" aria-label={'Show '+defaultName} checked={labelDesign.visible.includes(key)}
          onChange={e=>setDesignValue('visible',e.target.checked?[...labelDesign.visible,key]:labelDesign.visible.filter(v=>v!==key))}/> Display</label>
        <label>{defaultName}<input type="text" maxLength={28} value={labelDesign.labels[key]}
          onChange={e=>setDesignValue('labels',{...labelDesign.labels,[key]:e.target.value})}/></label>
        <button type="button" disabled={index===0} onClick={()=>setLabelDesign(v=>moveLabelField(v,key,-1))} aria-label={'Move '+defaultName+' up'}>↑</button>
        <button type="button" disabled={index===labelDesign.order.length-1} onClick={()=>setLabelDesign(v=>moveLabelField(v,key,1))} aria-label={'Move '+defaultName+' down'}>↓</button>
       </div>;
      })}
    </div>
    <div className="sc-label-designer-actions">
     <button type="button" onClick={saveLabelDesign}>Save my label layout</button>
     <button type="button" onClick={saveNamedDesign}>Save named template</button>
     <button type="button" onClick={previewLabel} disabled={Boolean(busy)}>Preview actual 4×6 PDF</button>
    </div>
    {labelPreview&&<div><h3>PDF Preview</h3><iframe className="sc-label-pdf-preview" src={labelPreview} title="4 by 6 label preview" /></div>}
    <small>Saved templates are currently stored in this browser, not shared across shop workstations. Use separate prints for different students until bag-level allocation is recorded.</small>
   </section>
 );
 if(!authorized)return <main className="page sc-print-center"><h1>Print Center</h1>
  <p>Manager or admin access is required to print invoices containing customer financial details.</p>
  <Link to="/work-hub">Return to Work Hub</Link></main>;
 if(!jobId)return <main className="page sc-print-center">
  <header className="page-header"><div><p className="eyebrow">Print Center · Label setup</p>
    <h1>4×6 Label Designer</h1><p>Customize and preview labels without QuickBooks or an order. Printing actual fulfillment labels requires opening a production job.</p></div>
    <Link to="/work-hub">Select a production job</Link></header>
  {error&&<p className="sc-print-alert" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {designerPanel}
  <details className="card elevated-card"><summary>QuickBooks connection settings (optional)</summary><QuickBooksConnection /></details>
 </main>;

 return <main className="page sc-print-center">
  <header className="page-header"><div><p className="eyebrow">Fulfillment · Source-controlled documents</p>
   <h1>Unified Print Center</h1><p>Invoice copies, thermal distribution labels and optional manufacturing instructions for WooCommerce or QuickBooks-linked work.</p></div>
   <Link to={'/work-hub?job='+jobId}>Back to job</Link></header>
  {error&&<p className="sc-print-alert" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  <button type="button" disabled={Boolean(busy)} onClick={reload}>{busy==='loading'?'Loading…':'Refresh original order source'}</button>
  {source&&job&&<>
   <section className="card elevated-card">
    <h2>Order {source.reference} — {source.customerName}</h2>
    <p>Job #{job.id} · Source: {source.source==='woocommerce'?'WooCommerce':'QuickBooks / Manual Invoiced Order'}
    · {source.lines.length} order lines · {travelers.length} QR production travelers</p>
    <p><strong>Financial verification:</strong> {source.financialVerified
     ? (source.source==='woocommerce'?'Original WooCommerce order fetched':'QuickBooks invoice number and total matched')
     : 'QuickBooks reconciliation NOT confirmed'}</p>
    {!!warnings.length&&<div className="sc-print-alert"><strong>Review before printing</strong><ul>{warnings.map(x=><li key={x}>{x}</li>)}</ul></div>}
   </section>
   <section className="card elevated-card">
    <h2>Documents</h2>
    <button type="button" disabled={Boolean(busy)||!canPrintCustomerCopy(source)} onClick={printStandardPacket}>
      Queue Standard Packet (Epson invoice pair + thermal labels{prefs.productionPacket?' + production packet':''})
    </button>
    <p>Print invoice pair on Epson letter paper; print distribution labels on 4 × 6 thermal stock. Direct queueing stays disabled until the Pi agent and physical printers are validated and enabled.</p>
    <div className="sc-print-cards">
     <div><h3>Customer + Shop Invoices</h3>
      <p>One letter-size PDF contains both copies. Shop copy includes an authenticated job QR and item traveler references.</p>
      <button type="button" disabled={Boolean(busy)||!canPrintCustomerCopy(source)} onClick={()=>documentAction('invoices')}>Download invoice pair</button>
      <button type="button" disabled={Boolean(busy)||!canPrintCustomerCopy(source)} onClick={()=>documentAction('invoices',true)}>Queue invoice pair to Epson</button>
      {!canPrintCustomerCopy(source)&&<small>Customer invoice blocked: verify QuickBooks financial source first.</small>}
      <button type="button" disabled={Boolean(busy)||!canPrintCustomerCopy(source)} onClick={()=>documentAction('customer')}>Customer copy only</button>
      <button type="button" disabled={Boolean(busy)} onClick={()=>documentAction('shop')}>Shop copy only{!source.financialVerified?' (DRAFT)':''}</button>
     </div>
     <div><h3>4 × 6 Distribution Labels</h3><p>{prefs.packageCount} label(s), branded black-and-white thermal labels for the configured printer. No postage is purchased.</p>
      <button type="button" disabled={Boolean(busy)} onClick={()=>documentAction('labels')}>Download 4×6 label PDF</button>
      <button type="button" disabled={Boolean(busy)} onClick={()=>documentAction('labels',true)}>Queue 4×6 thermal label</button>
     </div>
     <div><h3>Production Packet</h3><p>One or more letter-size pages per approved traveler, including graphic previews when accessible, measured placement and saved settings.</p>
      <button type="button" disabled={Boolean(busy)||!travelers.length} onClick={()=>documentAction('production')}>Download production PDF</button>
      <button type="button" disabled={Boolean(busy)||!travelers.length} onClick={()=>documentAction('production',true)}>Queue production packet to Epson</button>
      {!travelers.length&&<Link to={'/production-travelers?job='+job.id}>Add approved traveler →</Link>}
     </div>
    </div>
   </section>
   <section className="card elevated-card">
    <h2>Distribution label recipient details</h2>
    <p>Use these fields to identify bags by student, teacher, coach, team or personalized garment. Existing order item personalization is used automatically when available; entries here override it for this print session only.</p>
    <div className="sc-print-preferences">
      {LABEL_FIELDS.map(([key,title])=><label key={key}>{title}
        <input type="text" maxLength={120} value={labelFields[key]||''}
          placeholder="Auto from order, or enter here" onChange={e=>setLabelField(key,e.target.value)}/>
      </label>)}
    </div>
    <small>These details are not saved as global workstation defaults. For different recipients in one order, print separately by recipient until per-bag allocation is verified.</small>
   </section>
   {designerPanel}
   <section className="card elevated-card">
    <button type="button" onClick={()=>setVisibleSettings(v=>!v)}>{visibleSettings?'Hide':'Customize'} print layout</button>
    {visibleSettings&&<div className="sc-print-preferences">
     <label>Invoice font size (pt)<input type="number" min="7" max="15" step="1" value={prefs.invoiceFont} onChange={e=>setPref('invoiceFont',e.target.value)}/></label>
     <label>Invoice heading size (pt)<input type="number" min="13" max="28" step="1" value={prefs.invoiceHeading} onChange={e=>setPref('invoiceHeading',e.target.value)}/></label>
     <label>Thermal label recipient font (pt)<input type="number" min="9" max="22" step="1" value={prefs.labelFont} onChange={e=>setPref('labelFont',e.target.value)}/></label>
     <label>Number of packages (1–100)<input type="number" min="1" max="100" step="1" value={prefs.packageCount} onChange={e=>setPref('packageCount',e.target.value)}/></label>
     {[
      ['showSku','Invoice: Show SKUs'],['showPersonalization','Invoice: Show customer personalization'],
      ['showCustomerPhone','Invoice: Show customer phone'],['labelShowOrder','Label: Show order and job #'],
      ['labelShowItems','Label: Show items'],['productionPacket','Include optional production packet in Standard Packet'],['labelShowQR','Label: Include staff-only QR (internal bags only)']
     ].map(([key,label])=><label key={key} className="sc-print-check">
       <input type="checkbox" checked={prefs[key]}
         onChange={e=>setPref(key,e.target.checked)}/>{label}</label>)}
     {prefs.labelShowQR&&<p className="sc-print-alert">Staff QR requires authentication. Do not expose internal production links on customer-facing external labels.</p>}
     <button type="button" onClick={savePrefs}>Save my workstation defaults</button>
     <small>These layout settings are local to this browser for the first release; shared template management and silent print routing are later phases.</small>
    </div>}
   </section>
   <PrintIntegrations source={source} job={job} prefs={prefs} setPrefs={setPrefs} onRefresh={reload}/>
  </>}
 </main>;
}
