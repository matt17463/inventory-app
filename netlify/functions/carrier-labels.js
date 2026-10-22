import {authorizeEmployee,jsonResponse} from './_shared/security.js';
import {carrierConfig,shipFrom,normalizeAddress,normalizeParcel,verifyDestination,quoteParcel,buyParcel,fetchShipment,boughtDetails} from './_shared/easypostCarrier.js';
import {closeoutReadiness} from '../../src/lib/jobCloseout.js';

const idOk=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const pkgOk=x=>Number.isSafeInteger(Number(x))&&Number(x)>=1&&Number(x)<=100;
const errResponse=(event,e)=>jsonResponse(400,{success:false,error:String(e.message||'Carrier request failed').slice(0,420)},event);
async function externalRow(sb,jobId,packageIndex){
 const {data,error}=await sb.from('sc_external_usps_labels').select('*')
  .eq('job_id',jobId).eq('package_index',packageIndex).maybeSingle();
 if(error)throw error;return data;
}
async function row(sb,jobId,packageIndex){
 const {data,error}=await sb.from('sc_carrier_label_jobs').select('*').eq('job_id',jobId).eq('package_index',packageIndex).maybeSingle();
 if(error)throw error;return data;
}
function publicRow(r){
 if(!r)return null;
 return {id:r.id,job_id:r.job_id,package_index:r.package_index,mode:r.mode,state:r.state,
  rate_options:r.rate_options,quote_expires_at:r.quote_expires_at,destination:r.destination,
  parcel:r.parcel,selected_rate_id:r.selected_rate_id,carrier:r.carrier,service:r.service,
  amount_usd:r.amount_usd,label_url:r.label_url,tracking_code:r.tracking_code,
  last_error:r.last_error,updated_at:r.updated_at,purchased_at:r.purchased_at};
}
async function evidence(sb,id){
 const {data:job,error:je}=await sb.from('jobs').select('id,status,production_status,customer_name,woocommerce_order_id,manual_order_id,order_source,woo_payment_status,payment_received').eq('id',id).single();
 if(je||!job)throw Error('Production job unavailable.');
 const [items,qc,packing,pickup,fulfillment]=await Promise.all([
  sb.from('job_items').select('id,quantity,status').eq('job_id',id).limit(600),
  sb.from('phase5_qc_checklists').select('id,passed,qc_completed_at,created_at').eq('job_id',id).order('created_at',{ascending:false}).limit(50),
  sb.from('sc_job_packing_line_events').select('id,job_item_id,packed_quantity,created_at').eq('job_id',id).limit(4000),
  sb.from('sc_job_pickup_acknowledgments').select('id').eq('job_id',id).limit(1),
  sb.from('sc_job_fulfillment_checks').select('kind,carrier_reference').eq('job_id',id).limit(300),
 ]);
 const unavailable={};
 for(const [name,v] of Object.entries({items,qc,packing,pickup,fulfillment})){if(v.error)unavailable[name]=v.error.message;}
 if(items.data?.length>=600)unavailable.items='Too many items to verify.';
 if(packing.data?.length>=4000)unavailable.packing='Packing history too large.';
 const proof=closeoutReadiness({job,items:items.data||[],qc:qc.data||[],
  packing:packing.data||[],pickup:pickup.data||[],fulfillment:fulfillment.data||[],unavailable});
 if(proof.channel!=='unselected')throw Error('This job has already been collected or marked shipped. Review existing fulfillment before buying additional labels.');
 if(!proof.readyForRelease)throw Error('Job not ready for a paid shipping label: '+proof.blockers.join(' '));
 return job;
}
function configSummary(){
 const cfg=carrierConfig();
 const origin=['SC_SHIP_FROM_STREET1','SC_SHIP_FROM_CITY','SC_SHIP_FROM_STATE','SC_SHIP_FROM_ZIP','SC_SHIP_FROM_PHONE'].every(k=>Boolean(process.env[k]));
 return {provider:'EasyPost',mode:cfg.mode,configured:cfg.enabled&&origin,origin_configured:origin,
  purchase_enabled:cfg.enabled&&origin&&cfg.canBuy,max_purchase_usd:Number.isFinite(cfg.maxCost)?cfg.maxCost:40,
  notice:cfg.mode==='test'?'Test labels only — no live postage charges.':'Production postage costs real money. A manager must confirm every label purchase.'};
}
export async function handler(event){
 if(event.httpMethod==='OPTIONS')return jsonResponse(204,{},event);
 if(event.httpMethod!=='POST')return jsonResponse(405,{success:false,error:'Method not allowed'},event);
 let body;try{body=JSON.parse(event.body||'{}');}catch{body={};}
 const action=String(body.action||'');
 const auth=await authorizeEmployee(event,{functionName:'carrier-labels',allowedRoles:['admin','manager']});
 if(!auth.ok)return jsonResponse(auth.statusCode,{success:false,error:auth.message},event);
 const sb=auth.supabase,cfg=carrierConfig();
 try{
  if(action==='config')return jsonResponse(200,{success:true,config:configSummary()},event);
  const id=Number(body.job_id),index=Number(body.package_index||1);
  if(!idOk(id)||!pkgOk(index))throw Error('Choose an existing production job and package 1–100.');
  if(action==='list'){
   const [easypost,external]=await Promise.all([
    sb.from('sc_carrier_label_jobs').select('*').eq('job_id',id).order('package_index'),
    sb.from('sc_external_usps_labels').select('id,job_id,package_index,tracking_code,label_reference,cost_usd,note,recorded_at')
     .eq('job_id',id).order('package_index'),
   ]);
   if(easypost.error)throw easypost.error;
   if(external.error)throw external.error;
   return jsonResponse(200,{success:true,config:configSummary(),
    shipments:(easypost.data||[]).map(publicRow),external_labels:external.data||[]},event);
  }
  if(action==='register_click_n_ship'){
   const job=await evidence(sb,id);
   const prior=await row(sb,id,index),out=await externalRow(sb,id,index);
   if(out)throw Error('This package already has a saved USPS Click-N-Ship label. Do not add it again.');
   if(prior&&prior.state!=='quoted')
    throw Error('This package already has EasyPost postage purchasing/purchased or unresolved. Reconcile it before recording USPS postage.');
   const tracking=String(body.tracking_code||'').trim().replace(/\s/g,'');
   const reference=String(body.label_reference||'').trim();
   const amount=body.cost_usd===''||body.cost_usd===null||body.cost_usd===undefined?null:Number(body.cost_usd);
   if(!/^[A-Z0-9]{10,45}$/i.test(tracking)||reference.length<3||reference.length>180)
    throw Error('Enter the USPS tracking code and a Click-N-Ship purchase reference from the USPS receipt.');
   if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>2000))
    throw Error('USPS postage amount must be 0–2000 USD, or left blank if unknown.');
   if(body.confirm_external!==true)
    throw Error('Confirm that the USPS Click-N-Ship label was actually purchased separately.');
   const result=await sb.from('sc_external_usps_labels').insert({
    job_id:job.id,package_index:index,tracking_code:tracking.toUpperCase(),
    label_reference:reference,cost_usd:amount,note:String(body.note||'').slice(0,700),
    recorded_by:auth.user.id,
   }).select('id,job_id,package_index,tracking_code,label_reference,cost_usd,note,recorded_at').single();
   if(result.error)throw result.error;
   return jsonResponse(200,{success:true,external_label:result.data,
    notice:'USPS Click-N-Ship label recorded. No new postage was purchased here. Verify the printed USPS label and actual carrier acceptance separately.'},event);
  }
  if(!cfg.enabled)throw Error('EasyPost '+cfg.mode+' API key is not configured.');
  if(action==='quote'){
   const job=await evidence(sb,id);
   const external=await externalRow(sb,id,index);
   if(external)throw Error('USPS Click-N-Ship postage is already recorded for this package. No EasyPost label may be bought.');
   const existing=await row(sb,id,index);
   if(existing&&existing.state!=='quoted')throw Error('This package is already purchasing/purchased or needs manual reconciliation. Do not request or buy duplicate postage.');
   const to=normalizeAddress(body.to_address),parcel=normalizeParcel(body.parcel);
   const from=shipFrom();
   // Strict US destination verification and rating. An unverified address cannot be purchased.
   const verified=await verifyDestination(to,cfg);
   const destination=normalizeAddress({...to,...verified,phone:verified.phone||to.phone,name:verified.name||to.name});
   const quoted=await quoteParcel({from,to:destination,parcel,jobId:job.id,packageIndex:index},cfg);
   if(quoted.mode!==cfg.mode)throw Error('Carrier returned an unexpected API mode.');
   const patch={mode:cfg.mode,state:'quoted',provider_shipment_id:quoted.id,
    rate_options:quoted.rates,selected_rate_id:null,carrier:null,service:null,amount_usd:null,
    quote_expires_at:new Date(Date.now()+20*60000).toISOString(),
    destination,parcel,quoted_by:auth.user.id,quoted_at:new Date().toISOString(),
    purchase_started_at:null,purchased_by:null,last_error:null,updated_at:new Date().toISOString()};
   let result;
   if(existing){
    result=await sb.from('sc_carrier_label_jobs').update(patch).eq('id',existing.id).eq('state','quoted').select('*').maybeSingle();
    if(!result.error&&!result.data)throw Error('Another manager started purchasing this label. Refresh before proceeding.');
   }else{
    result=await sb.from('sc_carrier_label_jobs').insert({...patch,job_id:id,package_index:index}).select('*').single();
   }
   if(result.error)throw result.error;
   return jsonResponse(200,{success:true,shipment:publicRow(result.data),
    warning:'Rates expire in 20 minutes. Nothing has been purchased.'},event);
  }
  const current=await row(sb,id,index);
  if(!current)throw Error('Prepare and save a rate quote first.');
  if(current.mode!==cfg.mode)throw Error('Carrier mode changed. Reconfigure before operating on this quote.');
  if(action==='recover'){
   if(!['purchasing','purchase_unknown','purchased'].includes(current.state))throw Error('There is no postage purchase to reconcile.');
   const remote=await fetchShipment(current.provider_shipment_id,cfg);
   const details=boughtDetails(remote);
   if(details){
    const update=await sb.from('sc_carrier_label_jobs').update({...details,state:'purchased',purchased_at:current.purchased_at||new Date().toISOString(),updated_at:new Date().toISOString(),last_error:null})
     .eq('id',current.id).in('state',['purchasing','purchase_unknown','purchased']).select('*').single();
    if(update.error)throw update.error;
    return jsonResponse(200,{success:true,shipment:publicRow(update.data)},event);
   }
   return jsonResponse(409,{success:false,error:'Carrier has not confirmed a purchased label. Do not retry purchasing. Reconcile in EasyPost before releasing the package.'},event);
  }
  if(action!=='buy')throw Error('Unknown carrier action.');
  if(await externalRow(sb,id,index))throw Error('This package has an externally purchased USPS label. Do not buy a second postage label.');
  if(current.state==='purchased')return jsonResponse(200,{success:true,shipment:publicRow(current),already_purchased:true},event);
  if(current.state!=='quoted')throw Error('Purchase state is not safe to retry. Use Recover label / EasyPost dashboard.');
  if(!cfg.canBuy)throw Error('Live label purchases are disabled; set SC_EASYPOST_LIVE_BUY_ENABLED=true after test-mode verification.');
  if(new Date(current.quote_expires_at)<=new Date())throw Error('Quote expired. Request new rates before purchase.');
  const rate=(current.rate_options||[]).find(r=>r.id===body.rate_id);
  if(!rate||rate.currency!=='USD')throw Error('Choose a valid saved carrier rate.');
  const cap=Number.isFinite(cfg.maxCost)&&cfg.maxCost>0?cfg.maxCost:40;
  if(rate.amount>cap)throw Error('Rate exceeds the configured $'+cap.toFixed(2)+' purchase limit.');
  if(body.confirm_buy!==true||String(body.confirm_cost||'')!==Number(rate.amount).toFixed(2))
    throw Error('Explicit confirmation of the exact postage cost is required.');
  await evidence(sb,id); // Re-check QC, packing, source payment and shipment before spending money.
  const claim=await sb.from('sc_carrier_label_jobs').update({state:'purchasing',selected_rate_id:rate.id,
    carrier:rate.carrier,service:rate.service,amount_usd:rate.amount,carrier_account_id:rate.carrier_account_id,
    purchased_by:auth.user.id,purchase_started_at:new Date().toISOString(),updated_at:new Date().toISOString()})
   .eq('id',current.id).eq('state','quoted').gt('quote_expires_at',new Date().toISOString())
   .select('*').maybeSingle();
  if(claim.error)throw claim.error;
  if(!claim.data)throw Error('Another purchase began or quote expired. Refresh. Do not buy again.');
  try{
   const remote=await buyParcel(current.provider_shipment_id,rate.id,cfg);
   const details=boughtDetails(remote);
   if(!details)throw Error('Carrier response did not confirm label/tracking; purchase may still have succeeded.');
   const saved=await sb.from('sc_carrier_label_jobs').update({...details,state:'purchased',purchased_at:new Date().toISOString(),
      last_error:null,updated_at:new Date().toISOString()}).eq('id',current.id).eq('state','purchasing').select('*').single();
   if(saved.error)throw saved.error;
   return jsonResponse(200,{success:true,shipment:publicRow(saved.data),
    notice:'Postage label purchased. This does NOT mean the carrier has received or delivered the parcel.'},event);
  }catch(e){
   await sb.from('sc_carrier_label_jobs').update({state:'purchase_unknown',last_error:String(e.message||'').slice(0,350),updated_at:new Date().toISOString()})
    .eq('id',current.id).eq('state','purchasing');
   throw Error('Label purchase outcome uncertain. Check EasyPost or use Recover label; NEVER retry buying this package automatically. '+String(e.message||''));
  }
 }catch(e){
  console.error('Carrier label operation failed:',action,String(e.message).slice(0,220));
  return errResponse(event,e);
 }
}
