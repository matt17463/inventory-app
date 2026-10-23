import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from './supabaseClient';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {signedAssetUrl} from './lib/mockupStudioApi';
import {DEFAULT_PRINT_PREFS,normalizePrintPrefs,printWarnings,canPrintCustomerCopy} from './lib/printModel';
import {createInvoicePdf,createInvoicePairPdf,createDistributionLabelsPdf,createProductionPacketPdf} from './lib/printPacketPdf';
import './PrintCenter.css';

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
 const [visibleSettings,setVisibleSettings]=useState(false);
 const warnings=useMemo(()=>source?printWarnings(source,job,travelers):[],[source,job,travelers]);
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
 async function download(which){
  if(!source||!job||busy)return;
  setBusy(which);setError('');setMessage('');
  try{
   const base={source,job,travelers,prefs,origin:window.location.origin};
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
   pdf.save(name.replace(/[^a-zA-Z0-9._-]/g,'-'));
   setMessage('PDF generated. Select the correct printer and paper in the print dialog. This is not confirmation of physical printing.');
  }catch(e){setError(e.message||'Could not generate document.');}
  finally{setBusy('');}
 }
 if(!authorized)return <main className="page sc-print-center"><h1>Print Center</h1>
  <p>Manager or admin access is required to print invoices containing customer financial details.</p>
  <Link to="/work-hub">Return to Work Hub</Link></main>;
 if(!jobId)return <main className="page sc-print-center"><h1>Print Center</h1>
  <p>Select an existing job in Work Hub to generate its customer and shop print documents.</p>
  <Link to="/work-hub">Choose a job →</Link></main>;
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
    <p><strong>Financial verification:</strong> {source.financialVerified?'Original WooCommerce order fetched':'QuickBooks reconciliation NOT confirmed'}</p>
    {!!warnings.length&&<div className="sc-print-alert"><strong>Review before printing</strong><ul>{warnings.map(x=><li key={x}>{x}</li>)}</ul></div>}
   </section>
   <section className="card elevated-card">
    <h2>Documents</h2>
    <p>Print invoice pair on Epson letter paper; print distribution labels on Munbyn 4 × 6 stock. Physical one-click routing requires a separately configured local print bridge.</p>
    <div className="sc-print-cards">
     <div><h3>Customer + Shop Invoices</h3>
      <p>One letter-size PDF contains both copies. Shop copy includes an authenticated job QR and item traveler references.</p>
      <button type="button" disabled={Boolean(busy)||!canPrintCustomerCopy(source)} onClick={()=>download('invoices')}>Download invoice pair</button>
      {!canPrintCustomerCopy(source)&&<small>Customer invoice blocked: verify QuickBooks financial source first.</small>}
      <button type="button" disabled={Boolean(busy)||!canPrintCustomerCopy(source)} onClick={()=>download('customer')}>Customer copy only</button>
      <button type="button" disabled={Boolean(busy)} onClick={()=>download('shop')}>Shop copy only{!source.financialVerified?' (DRAFT)':''}</button>
     </div>
     <div><h3>4 × 6 Distribution Labels</h3><p>{prefs.packageCount} label(s), black-and-white thermal layout. No postage is purchased.</p>
      <button type="button" disabled={Boolean(busy)} onClick={()=>download('labels')}>Download Munbyn label PDF</button>
     </div>
     <div><h3>Production Packet</h3><p>One or more letter-size pages per approved traveler, including graphic previews when accessible, measured placement and saved settings.</p>
      <button type="button" disabled={Boolean(busy)||!travelers.length} onClick={()=>download('production')}>Download production PDF</button>
      {!travelers.length&&<Link to={'/production-travelers?job='+job.id}>Add approved traveler →</Link>}
     </div>
    </div>
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
      ['labelShowItems','Label: Show items'],['labelShowQR','Label: Include staff-only QR (internal bags only)']
     ].map(([key,label])=><label key={key} className="sc-print-check">
       <input type="checkbox" checked={prefs[key]}
         onChange={e=>setPref(key,e.target.checked)}/>{label}</label>)}
     {prefs.labelShowQR&&<p className="sc-print-alert">Staff QR requires authentication. Do not expose internal production links on customer-facing external labels.</p>}
     <button type="button" onClick={savePrefs}>Save my workstation defaults</button>
     <small>These layout settings are local to this browser for the first release; shared template management and silent print routing are later phases.</small>
    </div>}
   </section>
  </>}
 </main>;
