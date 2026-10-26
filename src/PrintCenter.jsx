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
import businessLogo from './assets/logo.png';

const CONFIG_KEY='sc-print-center-prefs-v1';
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
 const [visibleSettings,setVisibleSettings]=useState(false);
 const warnings=useMemo(()=>source?printWarnings(source,job,travelers):[],[source,job,travelers]);
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
 function savePrefs(){
   try{localStorage.setItem(CONFIG_KEY,JSON.stringify(prefs));setMessage('Layout defaults saved on this browser. They do not alter WooCommerce plugin settings.');}
   catch{setError('This browser cannot save local printing preferences.');}
 }
 async function documentAction(which,sendToPrinter=false){
  if(!source||!job||busy)return;
  setBusy(which);setError('');setMessage('');
  try{
   const base={source,job,travelers,prefs,origin:window.location.origin,labelFields,logoData:await readBrandLogo()};
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
 if(!authorized)return <main className="page sc-print-center"><h1>Print Center</h1>
  <p>Manager or admin access is required to print invoices containing customer financial details.</p>
  <Link to="/work-hub">Return to Work Hub</Link></main>;
 if(!jobId)return <QuickBooksConnection />;

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
