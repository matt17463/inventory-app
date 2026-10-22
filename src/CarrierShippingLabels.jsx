import {useEffect,useMemo,useState} from 'react';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {shouldSimulateWrites} from './lib/testingMode';
import {closeoutReadiness} from './lib/jobCloseout';
import './CarrierShippingLabels.css';

async function callCarrier(body){
 const response=await authenticatedFunctionFetch('/.netlify/functions/carrier-labels',{
  method:'POST',body:JSON.stringify(body),
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.success)throw Error(result.error||'Shipping request failed.');
 return result;
}
const emptyAddress={name:'',company:'',street1:'',street2:'',city:'',state:'WA',zip:'',phone:''};
const blankParcel={length:'12',width:'10',height:'4',weight:'16'};
const usd=x=>Number(x||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
const localDate=s=>s?new Date(s).toLocaleString():'';
const indexIsValid=x=>Number.isSafeInteger(Number(x))&&Number(x)>=1&&Number(x)<=100;
export default function CarrierShippingLabels({evidence,canManage=false}){
 const job=evidence?.job||{},readiness=useMemo(()=>closeoutReadiness(evidence),[evidence]);
 const [cfg,setCfg]=useState(null),[shipments,setShipments]=useState([]),[external,setExternal]=useState([]);
 const [packageIndex,setPackageIndex]=useState('1');
 const [address,setAddress]=useState(emptyAddress),[parcel,setParcel]=useState(blankParcel);
 const [rateId,setRateId]=useState(''),[rateType,setRateType]=useState('all'),[allowBuy,setAllowBuy]=useState(false);
 const [usps,setUsps]=useState({tracking_code:'',label_reference:'',cost_usd:'',note:''});
 const [busy,setBusy]=useState(''),[message,setMessage]=useState('');
 const index=Number(packageIndex),saved=shipments.find(x=>x.package_index===index),uspsSaved=external.find(x=>x.package_index===index);
 const rate=saved?.rate_options?.find(x=>x.id===rateId);
 const visibleRates=(saved?.rate_options||[]).filter(x=>rateType==='all'||/USPS/i.test(x.carrier));
 const readyForNew=canManage&&readiness.readyForRelease&&readiness.channel==='unselected'&&!uspsSaved&&
  !['purchasing','purchase_unknown','purchased'].includes(saved?.state);
 const canQuote=Boolean(readyForNew&&cfg?.configured&&indexIsValid(packageIndex));
 const canPurchase=Boolean(canQuote&&saved?.state==='quoted'&&rate&&allowBuy&&cfg?.purchase_enabled&&
  rate.amount<=cfg.max_purchase_usd&&new Date(saved.quote_expires_at)>new Date());
 async function list(){
  const data=await callCarrier({action:'list',job_id:Number(job.id)});
  setCfg(data.config);setShipments(data.shipments||[]);setExternal(data.external_labels||[]);
 }
 useEffect(()=>{
  let mounted=true;
  if(!canManage||!job.id)return;
  callCarrier({action:'list',job_id:Number(job.id)}).then(data=>{
   if(mounted){setCfg(data.config);setShipments(data.shipments||[]);setExternal(data.external_labels||[]);}
  }).catch(e=>{if(mounted)setMessage(e.message);});
  return()=>{mounted=false;};
 },[canManage,job.id]);
 useEffect(()=>{setRateId('');setAllowBuy(false);},[packageIndex]);
 async function run(action,body={}){
  setBusy(action);setMessage('');
  try{
   if(shouldSimulateWrites()&&['quote','buy','register_click_n_ship'].includes(action))
    throw Error('Testing Mode: postage creation and registration are disabled.');
   const data=await callCarrier({action,job_id:Number(job.id),package_index:index,...body});
   await list();
   if(action==='quote')setRateId('');
   setAllowBuy(false);
   setMessage(data.notice||data.warning||'Carrier record updated successfully.');
  }catch(e){setMessage(e.message);}
  finally{setBusy('');}
 }
 function quote(event){
  event.preventDefault();
  if(!canQuote){setMessage('Finish packing, QC and payment checks before obtaining rates.');return;}
  run('quote',{to_address:address,parcel});
 }
 function buy(){
  if(!canPurchase)return;
  const prompt=(saved.mode==='production'?'REAL POSTAGE CHARGE':'TEST POSTAGE')+
   ': Purchase '+rate.carrier+' '+rate.service+' for '+usd(rate.amount)+
   ' on package '+packageIndex+'?\n\nThis action does not confirm carrier pickup or delivery.';
  if(!window.confirm(prompt))return;
  run('buy',{rate_id:rate.id,confirm_buy:true,confirm_cost:Number(rate.amount).toFixed(2)});
 }
 function logUsps(event){
  event.preventDefault();
  if(!readyForNew||!indexIsValid(packageIndex)){
   setMessage('The job is not ready, or this package already has a carrier label.');return;
  }
  if(!window.confirm('Have you ALREADY purchased the USPS Click-N-Ship label outside Skilled Crafting? No new postage will be charged here.'))return;
  run('register_click_n_ship',{...usps,confirm_external:true});
 }
 if(!canManage)return <section className="sc-carrier-labels">
  <h4>Carrier shipping labels</h4><p>A manager may purchase shipping labels after packing, QC and payment verification.</p></section>;
 return <section className="sc-carrier-labels">
  <div className="sc-carrier-head"><div>
   <p className="eyebrow">Shipping · Label purchasing</p>
   <h4>Purchase carrier labels or use USPS Click-N-Ship</h4>
   <p>Keep your existing USPS account. For integrated shipping, EasyPost Wallet can compare USPS and other rates with no software label fee for its first 3,000 monthly Wallet labels (postage still applies).</p>
  </div><span className="sc-carrier-mode">{cfg?.mode==='test'?'EasyPost TEST MODE':cfg?.mode==='production'?'EasyPost LIVE MODE':'No EasyPost connection'}</span></div>
  <div className="sc-carrier-warning">
   <strong>USPS Click-N-Ship and EasyPost are separate purchasing accounts.</strong>
   Buying in one does not transfer your label to the other. Each numbered package needs only ONE postage label. A purchased label does not mark an order shipped.
  </div>
  {readiness.blockers.length>0&&<div className="sc-carrier-warning"><strong>Release checks are not complete:</strong>
   <ul>{readiness.blockers.map((text,i)=><li key={i}>{text}</li>)}</ul></div>}
  <label className="sc-carrier-package">Package number<input type="number" min="1" max="100" value={packageIndex}
    onChange={e=>setPackageIndex(e.target.value)} /></label>
  <div className="sc-carrier-log">
   {shipments.map(s=><button type="button" key={s.id} onClick={()=>setPackageIndex(String(s.package_index))}>
    Package {s.package_index}: EasyPost {s.state}{s.tracking_code?' · '+s.tracking_code:''}</button>)}
   {external.map(s=><button type="button" key={s.id} onClick={()=>setPackageIndex(String(s.package_index))}>
    Package {s.package_index}: USPS Click-N-Ship · {s.tracking_code}</button>)}
  </div>
  {saved?.state==='purchased'&&<div className="sc-carrier-success">
    <strong>{saved.mode==='test'?'Test label generated':'EasyPost postage purchased'}</strong>
    <p>{saved.carrier} / {saved.service} · {usd(saved.amount_usd)} · Tracking: {saved.tracking_code}</p>
    {saved.label_url&&<a href={saved.label_url} rel="noreferrer" target="_blank">View purchased carrier PDF label ↗</a>}
  </div>}
  {uspsSaved&&<div className="sc-carrier-success">
    <strong>USPS Click-N-Ship purchase already recorded</strong>
    <p>USPS tracking: <code>{uspsSaved.tracking_code}</code> · Reference: {uspsSaved.label_reference}
    {uspsSaved.cost_usd!=null?' · '+usd(uspsSaved.cost_usd):''}</p>
    <p>Print the original label from your USPS Click-N-Ship account. Skilled Crafting did not purchase it again.</p>
  </div>}
  {['purchasing','purchase_unknown'].includes(saved?.state)&&<div className="sc-carrier-warning">
   <strong>Purchase outcome needs reconciliation.</strong>
   <p>Do not buy another label for this package until you confirm its state in EasyPost.</p>
   <button type="button" disabled={Boolean(busy)} onClick={()=>run('recover')}>Recover label from EasyPost</button>
  </div>}
  <div className="sc-carrier-tabs">
   <section className="sc-carrier-section">
    <h5>Option A · Use your existing USPS Click-N-Ship account</h5>
    <p>Buy and print from <a href="https://www.usps.com/ship/online-shipping.htm" target="_blank" rel="noreferrer">USPS Click-N-Ship ↗</a>.
     Then record the label's tracking number here. This is a manual link, not a Click-N-Ship API integration.</p>
    {readyForNew&&<form className="sc-carrier-fields" onSubmit={logUsps}>
     <label>USPS tracking number<input required value={usps.tracking_code} onChange={e=>setUsps(v=>({...v,tracking_code:e.target.value}))} placeholder="From purchased Click-N-Ship label" maxLength="45"/></label>
     <label>USPS purchase receipt or label reference<input required value={usps.label_reference} onChange={e=>setUsps(v=>({...v,label_reference:e.target.value}))} maxLength="180"/></label>
     <label>USPS postage paid (USD, optional)<input type="number" min="0" max="2000" step=".01" value={usps.cost_usd} onChange={e=>setUsps(v=>({...v,cost_usd:e.target.value}))}/></label>
     <label>Notes (optional)<textarea rows="2" maxLength="700" value={usps.note} onChange={e=>setUsps(v=>({...v,note:e.target.value}))}/></label>
     <button type="submit" disabled={Boolean(busy)}>Record already-purchased USPS label</button>
    </form>}
   </section>
   <section className="sc-carrier-section">
    <h5>Option B · Compare and purchase with EasyPost Wallet</h5>
    {!cfg?.configured&&<p className="sc-carrier-warning">EasyPost API key and ship-from address aren't configured. You can still record USPS Click-N-Ship purchases above. No EasyPost charges can occur yet.</p>}
    {cfg?.configured&&<p>{cfg.notice} Maximum single-label purchase: {usd(cfg.max_purchase_usd)}.</p>}
    {canQuote&&<form className="sc-carrier-fields" onSubmit={quote}>
     <h6>1. Enter the actual recipient address</h6>
     <div className="sc-carrier-grid">{[
      ['name','Recipient name'],['company','Company (optional)'],['street1','Street address'],
      ['street2','Apartment/suite (optional)'],['city','City'],['state','State (two letters)'],
      ['zip','ZIP code'],['phone','Recipient phone'],
     ].map(([field,label])=><label key={field}>{label}
      <input value={address[field]} required={!['company','street2'].includes(field)}
       onChange={e=>setAddress(v=>({...v,[field]:e.target.value}))} maxLength="100" /></label>)}</div>
     <h6>2. Weigh and measure the packed package</h6>
     <div className="sc-carrier-grid">{[
      ['length','Length (inches)'],['width','Width (inches)'],['height','Height (inches)'],
      ['weight','Total weight (ounces)'],
     ].map(([field,label])=><label key={field}>{label}
      <input type="number" min=".01" max={field==='weight'?'2400':'72'} step=".01" value={parcel[field]}
       onChange={e=>setParcel(v=>({...v,[field]:e.target.value}))} required /></label>)}</div>
     <button type="submit" disabled={Boolean(busy)}>Verify address and get live carrier quotes</button>
    </form>}
    {saved?.state==='quoted'&&<div className="sc-carrier-rates">
     <h6>3. Select rate for package {saved.package_index}</h6>
     <p>Destination: {saved.destination?.name}, {saved.destination?.street1}, {saved.destination?.city}, {saved.destination?.state} {saved.destination?.zip}</p>
     <p>Quote expires {localDate(saved.quote_expires_at)}. Nothing has been purchased yet.</p>
     <label>Show rates<select value={rateType} onChange={e=>setRateType(e.target.value)}>
      <option value="all">All carriers, sorted by price</option><option value="usps">USPS services only</option>
     </select></label>
     {visibleRates.map(r=><label className="sc-carrier-rate" key={r.id}>
      <input type="radio" checked={rateId===r.id} name={'rate-'+packageIndex} onChange={()=>{setRateId(r.id);setAllowBuy(false);}}/>
      <span><strong>{r.carrier} · {r.service}</strong><small>{r.days==null?'Transit estimate unavailable':r.days+' estimated days'}</small></span>
      <strong>{usd(r.amount)}</strong></label>)}
     {!visibleRates.length&&<p>No rates match that carrier filter. View all carrier rates or adjust package details.</p>}
     {rate&&<div className="sc-carrier-approval">
      <p>Selected: <strong>{rate.carrier} {rate.service} — {usd(rate.amount)}</strong></p>
      <label><input type="checkbox" checked={allowBuy} onChange={e=>setAllowBuy(e.target.checked)}/>
       I verified the customer address, packing measurements, carrier/service and exact cost. I authorize the label purchase.
      </label>
      <button type="button" disabled={!canPurchase||Boolean(busy)} onClick={buy}>
       {saved.mode==='production'?'Purchase real postage':'Purchase test label'} — {usd(rate.amount)}
      </button>
      {!cfg?.purchase_enabled&&<p className="sc-carrier-warning">Live purchase disabled until the owner enables it in Netlify after testing.</p>}
     </div>}
    </div>}
   </section>
  </div>
  <p className="sc-carrier-foot">Carrier labels do not create carrier pickups, send customer emails, or update the job's shipped status. Record actual dispatch in the existing fulfillment screen when the parcel is physically accepted by the carrier.</p>
  {message&&<p className="message" role="status">{message}</p>}
 </section>;
}
